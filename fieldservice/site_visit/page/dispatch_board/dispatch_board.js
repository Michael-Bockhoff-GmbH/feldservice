// Einsatzplan: alle Techniker nebeneinander - siehe dispatch_board.py fuer
// den Hintergrund (kein FullCalendar-Resource-Plugin verfuegbar/lizenziert,
// daher eine eigene, bewusst einfache Seite statt einer echten
// Kalenderbibliothek). Tag/Arbeitswoche/Woche/Monat sind vier Ansichten
// desselben Datenabrufs (get_dispatch_board_data liefert einfach den
// jeweils benoetigten Zeitraum).
//
// Verschieben bestehender Termine per Drag&Drop gibt es bewusst nicht -
// siehe README.md "Einsatzplan" fuer die Begruendung. Einen NEUEN Termin
// per Ziehen in der Tagesansicht anzulegen ist dagegen einfach genug (kein
// Server-Zustand, der sich beim Ziehen selbst aendern koennte) und spart
// gegenueber Klicken+Zeit-Eintippen einen Schritt.

const DAY_START_HOUR = 7;
const DAY_END_HOUR = 19;
const VIEW_MODES = ['Day', 'Work Week', 'Week', 'Month'];
const DRAG_SNAP_MINUTES = 15;

frappe.pages['dispatch-board'].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __('Dispatch Board'),
		single_column: true,
	});

	const state = { date: frappe.datetime.get_today(), view: 'Day' };

	const date_field = page.add_field({
		fieldname: 'date',
		label: __('Date'),
		fieldtype: 'Date',
		default: state.date,
		change() {
			state.date = date_field.get_value() || frappe.datetime.get_today();
			render(page, state);
		},
	});

	const view_field = page.add_field({
		fieldname: 'view',
		label: __('View'),
		fieldtype: 'Select',
		options: VIEW_MODES.join('\n'),
		default: state.view,
		change() {
			state.view = view_field.get_value() || 'Day';
			render(page, state);
		},
	});

	page.add_inner_button(__('Today'), () => {
		state.date = frappe.datetime.get_today();
		date_field.set_value(state.date);
	});
	page.add_inner_button('<', () => {
		state.date = shift_date(state.date, state.view, -1);
		date_field.set_value(state.date);
	});
	page.add_inner_button('>', () => {
		state.date = shift_date(state.date, state.view, 1);
		date_field.set_value(state.date);
	});
	page.add_inner_button(__('Refresh'), () => render(page, state));

	page.main.append('<div class="dispatch-board-body"></div>');
	render(page, state);

	// go_to_day(): von einer Monatszelle aus direkt in die Tagesansicht
	// dieses Tages springen.
	page.go_to_day = (date_str) => {
		state.date = date_str;
		state.view = 'Day';
		date_field.set_value(state.date);
		view_field.set_value(state.view);
	};
};

function shift_date(date, view, direction) {
	if (view === 'Work Week' || view === 'Week') return frappe.datetime.add_days(date, direction * 7);
	if (view === 'Month') return add_months(date, direction);
	return frappe.datetime.add_days(date, direction);
}

function add_months(date_str, months) {
	const d = frappe.datetime.str_to_obj(date_str);
	d.setDate(1);
	d.setMonth(d.getMonth() + months);
	return format_date(d);
}

function format_date(date_obj) {
	const y = date_obj.getFullYear();
	const m = String(date_obj.getMonth() + 1).padStart(2, '0');
	const d = String(date_obj.getDate()).padStart(2, '0');
	return `${y}-${m}-${d}`;
}

// Montag als Wochenstart (uebliche Konvention hierzulande).
function get_days_for_range(state) {
	if (state.view === 'Day') {
		return [state.date];
	}

	if (state.view === 'Work Week' || state.view === 'Week') {
		const d = frappe.datetime.str_to_obj(state.date);
		const days_since_monday = (d.getDay() + 6) % 7;
		const monday = frappe.datetime.add_days(state.date, -days_since_monday);
		const span = state.view === 'Work Week' ? 5 : 7;
		const days = [];
		for (let i = 0; i < span; i++) days.push(frappe.datetime.add_days(monday, i));
		return days;
	}

	// Month
	const d = frappe.datetime.str_to_obj(state.date);
	const first = new Date(d.getFullYear(), d.getMonth(), 1);
	const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
	const days = [];
	let cursor = format_date(first);
	const last_str = format_date(last);
	while (cursor <= last_str) {
		days.push(cursor);
		cursor = frappe.datetime.add_days(cursor, 1);
	}
	return days;
}

function render(page, state) {
	const $body = page.main.find('.dispatch-board-body');
	$body.html(`<div class="text-muted padding">${__('Loading...')}</div>`);

	const days = get_days_for_range(state);

	frappe.call({
		method: 'fieldservice.site_visit.dispatch_board.get_dispatch_board_data',
		args: { start_date: days[0], end_date: days[days.length - 1] },
		callback(r) {
			const data = r.message || { technicians: [], visits: [] };
			if (state.view === 'Month') {
				$body.html(build_month_html(data, days));
				wire_month_clicks($body, page);
			} else {
				$body.html(build_timeline_html(data, days));
				wire_timeline_clicks($body, page, days, state.view === 'Day');
			}
		},
	});
}

// --- Tag/Arbeitswoche/Woche: gemeinsame Zeitachsen-Darstellung ---------

function build_timeline_html(data, days) {
	if (!data.technicians.length) {
		return `<div class="text-muted padding">${__('No active technicians found.')}</div>`;
	}

	const visits_by_employee = {};
	(data.visits || []).forEach((v) => {
		(visits_by_employee[v.employee] = visits_by_employee[v.employee] || []).push(v);
	});

	const rows = data.technicians
		.map((tech) => {
			const blocks = (visits_by_employee[tech.name] || [])
				.map((v) => render_block(v, days))
				.join('');
			return `
				<div class="dispatch-row">
					<div class="dispatch-row-label">${frappe.utils.escape_html(tech.employee_name)}</div>
					<div class="dispatch-row-track" data-employee="${tech.name}">${render_day_dividers(days)}${blocks}</div>
				</div>`;
		})
		.join('');

	return `<div class="dispatch-board-grid">${render_ruler(days)}${rows}</div>`;
}

function render_ruler(days) {
	const day_width = 100 / days.length;
	if (days.length === 1) {
		const hours = [];
		for (let h = DAY_START_HOUR; h <= DAY_END_HOUR; h++) {
			hours.push(`<span style="left:${hour_to_percent(h)}%">${String(h).padStart(2, '0')}:00</span>`);
		}
		return `<div class="dispatch-row dispatch-ruler"><div class="dispatch-row-label"></div><div class="dispatch-row-track">${hours.join('')}</div></div>`;
	}

	const labels = days
		.map((day, i) => {
			const label = frappe.datetime.str_to_obj(day).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
			return `<span style="left:${i * day_width}%;width:${day_width}%" class="dispatch-day-label">${label}</span>`;
		})
		.join('');
	return `<div class="dispatch-row dispatch-ruler"><div class="dispatch-row-label"></div><div class="dispatch-row-track">${labels}</div></div>`;
}

function render_day_dividers(days) {
	if (days.length <= 1) return '';
	const day_width = 100 / days.length;
	let html = '';
	for (let i = 1; i < days.length; i++) {
		html += `<div class="dispatch-day-divider" style="left:${i * day_width}%"></div>`;
	}
	return html;
}

function render_block(visit, days) {
	const day_width = 100 / days.length;
	const day_index = days.indexOf((visit.scheduled_start || '').slice(0, 10));
	if (day_index === -1) return ''; // ueber Mitternacht hinausreichende Termine werden hier nicht dargestellt

	const start_f = time_to_fraction(visit.scheduled_start);
	const end_f = time_to_fraction(visit.scheduled_end);
	const left = day_index * day_width + start_f * day_width;
	const width = Math.max((end_f - start_f) * day_width, days.length > 1 ? 1 : 2);
	const status_class = visit.docstatus === 1 ? 'dispatch-block-submitted' : 'dispatch-block-draft';
	const conflict_class = visit.has_conflict ? 'dispatch-block-conflict' : '';
	const time_label = frappe.datetime.str_to_user(visit.scheduled_start).split(' ')[1] || '';
	const label = `${visit.customer_name || visit.customer || ''} (${time_label})`;
	return `
		<div class="dispatch-block ${status_class} ${conflict_class}"
			style="left:${left}%;width:${width}%"
			data-name="${visit.name}"
			title="${frappe.utils.escape_html(label)}">
			${frappe.utils.escape_html(visit.customer_name || visit.customer || visit.name)}
		</div>`;
}

function wire_timeline_clicks($body, page, days, allow_drag_create) {
	$body.find('.dispatch-block').on('click', function (e) {
		e.stopPropagation();
		frappe.set_route('Form', 'Site Visit', $(this).data('name'));
	});

	const $tracks = $body.find('.dispatch-row-track[data-employee]');

	if (!allow_drag_create) {
		// Arbeitswoche/Woche: ein Klick legt einen Termin mit Standarddauer an
		// (Ziehen ueber mehrere Tage waere mehrdeutig - dafuer erst in die
		// Tagesansicht wechseln).
		$tracks.on('click', function (e) {
			if ($(e.target).closest('.dispatch-block').length) return;
			const employee = $(this).data('employee');
			const x = e.pageX - $(this).offset().left;
			const day_position = (x / $(this).width()) * days.length; // 0..days.length
			const day_index = Math.min(Math.max(Math.floor(day_position), 0), days.length - 1);
			const fraction_within_day = day_position - day_index; // 0..1
			const hour = snap_hour(DAY_START_HOUR + fraction_within_day * (DAY_END_HOUR - DAY_START_HOUR));
			create_new_visit(employee, days[day_index], hour, hour + 1);
		});
		return;
	}

	// Tagesansicht: Ziehen spannt den Zeitraum auf, ein einfacher Klick (ohne
	// nennenswerte Bewegung) legt wie bisher einen Termin mit einer Stunde
	// Standarddauer an. mousemove/mouseup haengen am document (nicht an der
	// nur ~44px hohen Zeile) - sonst wuerde ein schneller/diagonaler Zug die
	// Zeile verlassen und den Vorgang abbrechen, bevor losgelassen wurde.
	$tracks.each(function () {
		const $track = $(this);
		const employee = $track.data('employee');
		let dragging = false;
		let start_x = null;
		let $selection = null;

		function x_from_event(e) {
			return e.pageX - $track.offset().left;
		}

		function on_move(e) {
			if (!dragging) return;
			const current_x = clamp(x_from_event(e), 0, $track.width());
			$selection.css({ left: Math.min(start_x, current_x), width: Math.abs(current_x - start_x) });
		}

		function on_up(e) {
			if (!dragging) return;
			dragging = false;
			$(document).off('mousemove.dispatch-drag', on_move).off('mouseup.dispatch-drag', on_up);

			const end_x = clamp(x_from_event(e), 0, $track.width());
			const track_width = $track.width();
			const from_hour = snap_hour(x_to_hour(Math.min(start_x, end_x), track_width));
			let to_hour = snap_hour(x_to_hour(Math.max(start_x, end_x), track_width));
			if (to_hour - from_hour < 0.25) to_hour = from_hour + 1; // reiner Klick -> 1h Standarddauer
			if ($selection) $selection.remove();
			create_new_visit(employee, days[0], from_hour, to_hour);
		}

		$track.on('mousedown', function (e) {
			if ($(e.target).closest('.dispatch-block').length) return;
			dragging = true;
			start_x = x_from_event(e);
			$selection = $('<div class="dispatch-drag-selection"></div>').appendTo($track);
			$selection.css({ left: start_x, width: 0 });
			$(document).on('mousemove.dispatch-drag', on_move).on('mouseup.dispatch-drag', on_up);
			e.preventDefault();
		});
	});
}

function clamp(value, min, max) {
	return Math.min(Math.max(value, min), max);
}

function x_to_hour(x, track_width) {
	const fraction = track_width ? x / track_width : 0;
	return DAY_START_HOUR + fraction * (DAY_END_HOUR - DAY_START_HOUR);
}

function snap_hour(hour) {
	const snap = DRAG_SNAP_MINUTES / 60;
	return Math.round(hour / snap) * snap;
}

function create_new_visit(employee, day, from_hour, to_hour) {
	const to_time_str = (hour) => {
		const h = Math.floor(hour);
		const m = Math.round((hour - h) * 60);
		return `${day} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00`;
	};
	frappe.new_doc('Site Visit', {
		employee,
		scheduled_start: to_time_str(from_hour),
		scheduled_end: to_time_str(to_hour),
	});
}

function hour_to_percent(hour) {
	return ((hour - DAY_START_HOUR) / (DAY_END_HOUR - DAY_START_HOUR)) * 100;
}

function time_to_fraction(datetime_str) {
	if (!datetime_str) return 0;
	const dt = frappe.datetime.str_to_obj(datetime_str);
	const hour = dt.getHours() + dt.getMinutes() / 60;
	return Math.min(Math.max(hour_to_percent(hour) / 100, 0), 1);
}

// --- Monatsansicht: pro Tag nur ein Zaehl-Badge, keine Zeitachse -------

function build_month_html(data, days) {
	if (!data.technicians.length) {
		return `<div class="text-muted padding">${__('No active technicians found.')}</div>`;
	}

	const visits_by_employee_day = {};
	(data.visits || []).forEach((v) => {
		const day = (v.scheduled_start || '').slice(0, 10);
		const key = `${v.employee}::${day}`;
		(visits_by_employee_day[key] = visits_by_employee_day[key] || []).push(v);
	});

	const header = days
		.map((day) => `<div class="dispatch-month-cell dispatch-month-header">${frappe.datetime.str_to_obj(day).getDate()}</div>`)
		.join('');

	const rows = data.technicians
		.map((tech) => {
			const cells = days
				.map((day) => {
					const visits = visits_by_employee_day[`${tech.name}::${day}`] || [];
					if (!visits.length) return `<div class="dispatch-month-cell" data-date="${day}"></div>`;
					const has_conflict = visits.some((v) => v.has_conflict);
					const conflict_class = has_conflict ? 'dispatch-block-conflict' : '';
					return `<div class="dispatch-month-cell" data-date="${day}"><span class="dispatch-month-badge ${conflict_class}">${visits.length}</span></div>`;
				})
				.join('');
			return `
				<div class="dispatch-month-row">
					<div class="dispatch-row-label">${frappe.utils.escape_html(tech.employee_name)}</div>
					<div class="dispatch-month-cells">${cells}</div>
				</div>`;
		})
		.join('');

	return `
		<div class="dispatch-board-grid dispatch-month-grid">
			<div class="dispatch-month-row"><div class="dispatch-row-label"></div><div class="dispatch-month-cells">${header}</div></div>
			${rows}
		</div>`;
}

function wire_month_clicks($body, page) {
	$body.find('.dispatch-month-cell[data-date]').on('click', function () {
		page.go_to_day($(this).data('date'));
	});
}
