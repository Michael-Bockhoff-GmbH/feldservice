// Kalenderansicht fuer geplante Termine (scheduled_start/scheduled_end) -
// unabhaengig von from_time/to_time, die die tatsaechliche Einsatzzeit
// festhalten (siehe site_visit.json). Ein Site Visit ohne scheduled_start
// taucht hier einfach nicht auf - reine Vorausplanung ist optional.
//
// convertToUserTz: true schaltet Frappes eingebaute Zeitzonen-Umrechnung
// ab (frappe/public/js/frappe/views/calendar/calendar.js -> prepare_events:
// "if (!me.field_map.convertToUserTz) d.convertToUserTz = 1;" - ohne diesen
// Wert hier wird IMMER umgerechnet). Diese Umrechnung geht von System
// Settings -> Time Zone aus, nicht von Site Visit Settings -> Time Zone -
// stimmt Erstere nicht mit der tatsaechlichen Zeitzone des Unternehmens
// ueberein, verschiebt sich ein Termin im Kalender um Stunden oder faellt
// sogar aus dem sichtbaren Tag heraus (genau so am 18.09.2026 beobachtet:
// System Settings stand auf "Asia/Kolkata"). Site Visit Settings -> Time
// Zone aendert daran bewusst nichts direkt - stattdessen wird hier einfach
// gar nicht erst umgerechnet, scheduled_start/scheduled_end werden als
// reiner Klartext-Zeitpunkt angezeigt, genau wie im Formular und im
// Dispatch Board (site_visit/page/dispatch_board/) - unabhaengig davon,
// was in System Settings steht.
frappe.views.calendar["Site Visit"] = {
	field_map: {
		start: "scheduled_start",
		end: "scheduled_end",
		id: "name",
		title: "customer_name",
		allDay: "allDay",
		convertToUserTz: true,
	},
	filters: [
		{ fieldtype: "Link", fieldname: "employee", options: "Employee", label: __("Employee") },
		{ fieldtype: "Link", fieldname: "customer", options: "Customer", label: __("Customer") },
	],
	get_events_method: "frappe.desk.calendar.get_events",
};
