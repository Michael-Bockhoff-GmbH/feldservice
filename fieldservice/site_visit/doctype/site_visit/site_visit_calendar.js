// Kalenderansicht fuer geplante Termine (scheduled_start/scheduled_end) -
// unabhaengig von from_time/to_time, die die tatsaechliche Einsatzzeit
// festhalten (siehe site_visit.json). Ein Site Visit ohne scheduled_start
// taucht hier einfach nicht auf - reine Vorausplanung ist optional.
frappe.views.calendar["Site Visit"] = {
	field_map: {
		start: "scheduled_start",
		end: "scheduled_end",
		id: "name",
		title: "customer_name",
		allDay: "allDay",
	},
	filters: [
		{ fieldtype: "Link", fieldname: "employee", options: "Employee", label: __("Employee") },
		{ fieldtype: "Link", fieldname: "customer", options: "Customer", label: __("Customer") },
	],
	get_events_method: "frappe.desk.calendar.get_events",
};
