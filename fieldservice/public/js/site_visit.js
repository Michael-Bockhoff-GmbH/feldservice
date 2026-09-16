// Zeitblatt wird erst beim Buchen angelegt (serverseitig, siehe hooks.py ->
// doc_events -> fieldservice.site_visit.site_visit.before_submit). Dieses
// Skript setzt nur Feld-Defaults und liefert nach dem Buchen einen Link
// dorthin - keine async Calls vor dem Buchen, um die Race Condition aus
// sales_order.js (Modul Zeit Projekt) nicht zu wiederholen.

frappe.ui.form.on('Site Visit', {
	onload(frm) {
		// Auftrag-Auswahl auf Auftraege des gewaehlten Kunden (und, falls
		// gesetzt, Projekts) einschraenken. Dynamischer Filter - wird bei
		// jedem Oeffnen des Dropdowns neu anhand des aktuellen frm.doc
		// ausgewertet. Ohne customer-Filter wurden hier bislang Auftraege
		// beliebiger Kunden angezeigt, sobald kein Projekt gesetzt war (oder
		// generell, da der Filter selbst bei gesetztem Projekt nie auf den
		// Kunden eingeschraenkt hat).
		frm.set_query('sales_order', () => {
			const filters = {};
			if (frm.doc.customer) filters.customer = frm.doc.customer;
			if (frm.doc.project) filters.project = frm.doc.project;
			return { filters };
		});

		if (!frm.is_new()) return;
		if (!frm.doc.employee) {
			frappe.db.get_value('Employee', { user_id: frappe.session.user, status: 'Active' }, 'name')
				.then((r) => {
					if (r.message && r.message.name) frm.set_value('employee', r.message.name);
				});
		}
		// Kein automatischer Default fuer from_time mehr - das uebernimmt
		// jetzt der Timer (oder die manuelle Eingabe), siehe update_timer_toolbar
		// unten. Ein Default hier wuerde bei Formularoeffnung den falschen
		// Zeitpunkt festlegen, falls der Techniker den Einsatz erst spaeter
		// tatsaechlich beginnt.

		// Ueber die Verknuepfungen-Liste des Projekts angelegt ("+" bei Site
		// Visit): project ist dann schon vorbelegt, aber das Feldevent
		// project() unten feuert dabei nicht (Frappe setzt route_options beim
		// Neuanlegen direkt als Feldwert, nicht ueber set_value). Deshalb hier
		// dieselbe Logik einmal explizit anstossen.
		if (frm.doc.project) fill_from_project(frm);
	},

	project(frm) {
		if (!frm.doc.project) return;
		fill_from_project(frm);
	},

	sales_order(frm) {
		// Kunde (und, falls noch leer, Projekt) aus dem gewaehlten Auftrag
		// uebernehmen - derselbe Grund wie bei project(): der Techniker soll
		// das nicht doppelt eintragen muessen.
		if (!frm.doc.sales_order) return;
		frappe.db.get_value('Sales Order', frm.doc.sales_order, ['customer', 'project']).then((r) => {
			if (!r.message) return;
			if (r.message.customer) frm.set_value('customer', r.message.customer);
			if (r.message.project && !frm.doc.project) frm.set_value('project', r.message.project);
		});
	},

	refresh(frm) {
		frm.dashboard.clear_headline();
		update_timer_toolbar(frm);
		if (frm.doc.docstatus === 0 && !frm.doc.customer_signature) {
			frm.dashboard.set_headline_alert(__('No customer signature captured yet.'), 'orange');
		}
		if (frm.doc.docstatus === 1 && frm.doc.timesheet) {
			frm.add_custom_button(__('Open Timesheet'), () => {
				frappe.set_route('Form', 'Timesheet', frm.doc.timesheet);
			});
		}
		if (frm.doc.docstatus === 0 && !frm.doc.sales_order) {
			frm.add_custom_button(__('New Sales Order'), () => show_create_sales_order_dialog(frm));
		}
	},
});

// Timer fuer die Einsatzzeit - reine Komfortfunktion obendrauf auf from_time/
// to_time, die ganz normale, jederzeit von Hand editierbare Felder bleiben
// (kein read-only). "Start"/"Pause"/"Fortsetzen"/"Stopp" speichern sofort
// (wie ERPNexts eigener Timesheet-Timer in
// erpnext/public/js/projects/timer.js: frm.save() direkt nach dem Setzen von
// from_time) - deshalb sind customer/company/activity_type/sales_order/
// to_time nicht mehr reqd im Feld, sondern erst in before_submit
// (site_visit.py) Pflicht, sonst waere ein Entwurf mit nur laufendem Timer
// gar nicht speicherbar. Ohne das sofortige Speichern ginge der Timer bei
// einem Reload/Schliessen der Seite verloren, weil ein neues, ungespeichertes
// Dokument nur im Browser existiert. 1:1 uebernommen aus fahrtenbuch.js (dort
// ausfuehrlicher kommentiert).
//
// Pausen (Kaffeepause, Notfall bei einem anderen Kunden, ...) landen als
// eigene Zeilen im Feld "breaks" (Kindtabelle "Site Visit Break") statt den
// Zeitraum einfach zu unterbrechen - so bleibt from_time/to_time weiterhin
// der durchgehende Gesamtrahmen des Einsatzes, waehrend site_visit.py beim
// Buchen die Pausen herausrechnet und pro Arbeitsabschnitt einen eigenen
// Timesheet-Eintrag anlegt (siehe _get_work_segments dort).
function update_timer_toolbar(frm) {
	stop_ticking(frm);
	if (frm.doc.docstatus !== 0) return;

	if (!frm.doc.from_time) {
		frm.page.add_button(__('Start Timer'), () => {
			frm.set_value('from_time', frappe.datetime.now_datetime()).then(() => frm.save());
		});
		return;
	}
	if (frm.doc.to_time) return;

	if (get_open_break(frm)) {
		frm.page.add_button(__('Resume Timer'), () => resume_timer(frm));
	} else {
		frm.page.add_button(__('Pause Timer'), () => pause_timer(frm));
	}
	frm.page.add_button(__('Stop Timer'), () => stop_timer(frm));
	start_ticking(frm);
}

// Letzte Pausenzeile, falls sie noch laeuft (kein to_time) - es kann immer
// nur hoechstens eine offene Pause geben, da "Pause Timer" erst wieder
// anklickbar ist, nachdem die vorherige per "Resume Timer" geschlossen wurde.
function get_open_break(frm) {
	const breaks = frm.doc.breaks || [];
	const last = breaks[breaks.length - 1];
	return last && !last.to_time ? last : null;
}

function pause_timer(frm) {
	const dialog = new frappe.ui.Dialog({
		title: __('Pause Timer'),
		fields: [
			{
				fieldname: 'reason',
				fieldtype: 'Select',
				label: __('Reason'),
				options: ['Break', 'Other Customer (Emergency)', 'Other'],
				default: 'Break',
				reqd: 1,
			},
			{
				fieldname: 'note',
				fieldtype: 'Small Text',
				label: __('Note'),
			},
		],
		primary_action_label: __('Pause'),
		primary_action(values) {
			frm.add_child('breaks', {
				from_time: frappe.datetime.now_datetime(),
				reason: values.reason,
				note: values.note,
			});
			frm.refresh_field('breaks');
			dialog.hide();
			frm.save();
		},
	});
	dialog.show();
}

function resume_timer(frm) {
	const open_break = get_open_break(frm);
	if (!open_break) return;
	frappe.model.set_value(open_break.doctype, open_break.name, 'to_time', frappe.datetime.now_datetime());
	frm.save();
}

// Stoppt auch dann, wenn gerade pausiert ist - eine noch offene Pause wird
// dabei auf denselben Zeitpunkt geschlossen wie to_time. Ein "Fortsetzen"
// vor dem Stoppen zu erzwingen, waere reine Schikane, wenn der Einsatz z. B.
// waehrend einer Pause endgueltig endet (der Notfall beim anderen Kunden
// dauert den Rest des Tages).
function stop_timer(frm) {
	const now = frappe.datetime.now_datetime();
	const open_break = get_open_break(frm);
	if (open_break) {
		frappe.model.set_value(open_break.doctype, open_break.name, 'to_time', now);
	}
	frm.set_value('to_time', now).then(() => frm.save());
}

function start_ticking(frm) {
	const tick = () => {
		const state = get_timer_state(frm, Date.now());
		// clear_headline() zuerst: show_message() im Frappe-Layout haengt bei
		// jedem Aufruf nur einen neuen Block an, statt den alten zu ersetzen -
		// ohne das Clear stapeln sich die Meldungen im Sekundentakt.
		frm.dashboard.clear_headline();
		if (state.paused) {
			frm.dashboard.set_headline_alert(
				__('Timer paused ({0}) - worked so far: {1}', [__(state.pause_reason), format_duration(state.worked_ms)]),
				'blue'
			);
		} else {
			frm.dashboard.set_headline_alert(__('Timer running: {0}', [format_duration(state.worked_ms)]), 'orange');
		}
	};
	tick();
	frm.__site_visit_timer = setInterval(tick, 1000);
}

function stop_ticking(frm) {
	if (frm.__site_visit_timer) {
		clearInterval(frm.__site_visit_timer);
		frm.__site_visit_timer = null;
	}
}

// Rechnet die bislang tatsaechlich gearbeitete Zeit aus from_time und den
// (ggf. noch offenen) Pausen zusammen - Pausenzeit zaehlt nicht mit. Reiner
// Anzeigewert fuer den Timer im Browser; die massgebliche Berechnung beim
// Buchen macht _get_work_segments in site_visit.py.
function get_timer_state(frm, now) {
	const breaks = (frm.doc.breaks || [])
		.slice()
		.sort((a, b) => frappe.datetime.str_to_obj(a.from_time) - frappe.datetime.str_to_obj(b.from_time));

	let cursor = frappe.datetime.str_to_obj(frm.doc.from_time).getTime();
	let worked_ms = 0;

	for (const row of breaks) {
		const break_from = frappe.datetime.str_to_obj(row.from_time).getTime();
		worked_ms += Math.max(0, break_from - cursor);
		if (!row.to_time) {
			return { paused: true, pause_reason: row.reason, worked_ms };
		}
		cursor = frappe.datetime.str_to_obj(row.to_time).getTime();
	}

	worked_ms += Math.max(0, now - cursor);
	return { paused: false, pause_reason: null, worked_ms };
}

function format_duration(total_ms) {
	const total_seconds = Math.max(0, Math.floor(total_ms / 1000));
	const h = String(Math.floor(total_seconds / 3600)).padStart(2, '0');
	const m = String(Math.floor((total_seconds % 3600) / 60)).padStart(2, '0');
	const s = String(total_seconds % 60).padStart(2, '0');
	return `${h}:${m}:${s}`;
}

// Betrag in der Zusatzartikel-Tabelle ist reine Anzeige (qty * rate) - der
// verknuepfte Auftrag rechnet beim Uebernehmen selbst neu (Steuern,
// Preisregeln usw., siehe site_visit.py -> _sync_extra_items_to_sales_order).
frappe.ui.form.on('Site Visit Item', {
	qty(frm, cdt, cdn) {
		update_extra_item_amount(cdt, cdn);
	},
	rate(frm, cdt, cdn) {
		update_extra_item_amount(cdt, cdn);
	},
});

function update_extra_item_amount(cdt, cdn) {
	const row = frappe.get_doc(cdt, cdn);
	const qty = Number(row.qty) || 0;
	const rate = Number(row.rate) || 0;
	frappe.model.set_value(cdt, cdn, 'amount', qty * rate);
}

function show_create_sales_order_dialog(frm) {
	if (!frm.doc.customer) {
		frappe.msgprint(__('Please select a Customer first.'));
		return;
	}
	if (!(frm.doc.extra_items || []).length) {
		frappe.msgprint(__('Add at least one item below before creating a new Sales Order.'));
		return;
	}
	const dialog = new frappe.ui.Dialog({
		title: __('New Sales Order'),
		fields: [{ fieldname: 'po_no', fieldtype: 'Data', label: __('Customer Reference') }],
		primary_action_label: __('Create'),
		primary_action(values) {
			frappe.call({
				method: 'fieldservice.site_visit.site_visit.create_sales_order',
				args: {
					customer: frm.doc.customer,
					company: frm.doc.company,
					project: frm.doc.project,
					po_no: values.po_no,
					items: frm.doc.extra_items.map((row) => ({
						item_code: row.item_code,
						qty: row.qty,
						uom: row.uom,
						rate: row.rate,
					})),
				},
				freeze: true,
				freeze_message: __('Creating Sales Order...'),
				callback(r) {
					if (!r.message) return;
					dialog.hide();
					frm.set_value('sales_order', r.message).then(() => {
						// Diese Zeilen stecken schon im neuen Auftrag - beim
						// Buchen nicht nochmal uebernehmen (added_to_order,
						// siehe site_visit.py -> _sync_extra_items_to_sales_order).
						(frm.doc.extra_items || []).forEach((row) => {
							frappe.model.set_value(row.doctype, row.name, 'added_to_order', 1);
						});
					});
				},
			});
		},
	});
	dialog.show();
}

function fill_from_project(frm) {
	if (!frm.doc.customer) {
		frappe.db.get_value('Project', frm.doc.project, 'customer').then((r) => {
			if (r.message && r.message.customer) frm.set_value('customer', r.message.customer);
		});
	}
	// Genau ein passender Auftrag zum gewaehlten Projekt? Dann gleich
	// uebernehmen. Bei mehreren zeigt der Filter aus onload() nur noch die
	// passenden im Dropdown - der Techniker waehlt dann selbst.
	if (!frm.doc.sales_order) {
		frappe.db.get_list('Sales Order', {
			filters: { project: frm.doc.project, docstatus: ['!=', 2] },
			fields: ['name'],
			limit: 2,
		}).then((rows) => {
			if (rows.length === 1) frm.set_value('sales_order', rows[0].name);
		});
	}
}
