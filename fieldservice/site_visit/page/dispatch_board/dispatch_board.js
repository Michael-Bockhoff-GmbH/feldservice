// Einsatzplan: alle Techniker nebeneinander fuer einen Tag - siehe
// dispatch_board.py fuer den Hintergrund (kein FullCalendar-Resource-Plugin
// verfuegbar/lizenziert, daher eine eigene, bewusst einfache Seite statt
// einer echten Kalenderbibliothek). Kein Drag&Drop - siehe README.md
// "Einsatzplan" fuer die Begruendung; ein Klick auf einen Termin oder eine
// freie Stelle reicht fuer die paar Techniker, die diese App verwaltet.

const DAY_START_HOUR = 7;
const DAY_END_HOUR = 19;

frappe.pages['dispatch-board'].on_page_load = function (wrapper) {
	const page = frappe.ui.make_app_page({
		parent: wrapper,
		title: __('Dispatch Board'),
		single_column: true,
	});

	const state = { date: frappe.datetime.get_today() };

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

	page.add_inner_button(__('Today'), () => {
		state.date = frappe.datetime.get_today();
		date_field.set_value(state.date);
	});
	page.add_inner_button('<', () => {
		state.date = frappe.datetime.add_days(state.date, -1);
		date_field.set_value(state.date);
	});
	page.add_inner_button('>', () => {
		state.date = frappe.datetime.add_days(state.date, 1);
		date_field.set_value(state.date);
	});
	page.add_inner_button(__('Refresh'), () => render(page, state));

	page.main.append('<div class="dispatch-board-body"></div>');
	render(page, state);
};

function render(page, state) {
	const $body = page.main.find('.dispatch-board-body');
	$body.html(`<div class="text-muted padding">${__('Loading...')}</div>`);

	frappe.call({
		method: 'fieldservice.site_visit.dispatch_board.get_dispatch_board_data',
		args: { date: state.date },
		callback(r) {
			const data = r.message || { technicians: [], visits: [] };
			$body.html(build_html(data));
			wire_clicks($body, state);
		},
	});
}

function build_html(data) {
	if (!data.technicians.length) {
		return `<div class="text-muted padding">${__('No active technicians found.')}</div>`;
	}

	const visits_by_employee = {};
	(data.visits || []).forEach((v) => {
		(visits_by_employee[v.employee] = visits_by_employee[v.employee] || []).push(v);
	});

	const rows = data.technicians
		.map((tech) => {
			const blocks = (visits_by_employee[tech.name] || []).map((v) => render_block(v)).join('');
			return `
				<div class="dispatch-row">
					<div class="dispatch-row-label">${frappe.utils.escape_html(tech.employee_name)}</div>
					<div class="dispatch-row-track" data-employee="${tech.name}">${blocks}</div>
				</div>`;
		})
		.join('');

	return `<div class="dispatch-board-grid">${render_ruler()}${rows}</div>`;
}

function render_ruler() {
	const hours = [];
	for (let h = DAY_START_HOUR; h <= DAY_END_HOUR; h++) {
		hours.push(`<span style="left:${hour_to_percent(h)}%">${String(h).padStart(2, '0')}:00</span>`);
	}
	return `<div class="dispatch-row dispatch-ruler"><div class="dispatch-row-label"></div><div class="dispatch-row-track">${hours.join('')}</div></div>`;
}

function render_block(visit) {
	const left = time_to_percent(visit.scheduled_start);
	const width = Math.max(time_to_percent(visit.scheduled_end) - left, 2);
	const status_class = visit.docstatus === 1 ? 'dispatch-block-submitted' : 'dispatch-block-draft';
	const conflict_class = visit.has_conflict ? 'dispatch-block-conflict' : '';
	const label = `${visit.customer_name || visit.customer || ''} (${frappe.datetime.str_to_user(visit.scheduled_start).split(' ')[1] || ''})`;
	return `
		<div class="dispatch-block ${status_class} ${conflict_class}"
			style="left:${left}%;width:${width}%"
			data-name="${visit.name}"
			title="${frappe.utils.escape_html(label)}">
			${frappe.utils.escape_html(visit.customer_name || visit.customer || visit.name)}
		</div>`;
}

function wire_clicks($body, state) {
	$body.find('.dispatch-block').on('click', function (e) {
		e.stopPropagation();
		frappe.set_route('Form', 'Site Visit', $(this).data('name'));
	});

	$body.find('.dispatch-row-track[data-employee]').on('click', function (e) {
		if ($(e.target).closest('.dispatch-block').length) return;
		const employee = $(this).data('employee');
		const offset = e.offsetX / $(this).width();
		const hour = DAY_START_HOUR + offset * (DAY_END_HOUR - DAY_START_HOUR);
		const clicked = frappe.datetime.get_datetime_as_string(
			`${state.date} ${String(Math.floor(hour)).padStart(2, '0')}:00:00`
		);
		frappe.new_doc('Site Visit', { employee, scheduled_start: clicked });
	});
}

function hour_to_percent(hour) {
	return ((hour - DAY_START_HOUR) / (DAY_END_HOUR - DAY_START_HOUR)) * 100;
}

function time_to_percent(datetime_str) {
	if (!datetime_str) return 0;
	const dt = frappe.datetime.str_to_obj(datetime_str);
	const hour = dt.getHours() + dt.getMinutes() / 60;
	return Math.min(Math.max(hour_to_percent(hour), 0), 100);
}
