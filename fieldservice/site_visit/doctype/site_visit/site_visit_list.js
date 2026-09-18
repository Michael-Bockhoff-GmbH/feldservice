// Schneller Zugriff auf den Einsatzplan (Dispatch Board) direkt aus der
// normalen Listenansicht heraus, statt nur ueber Home/die "Site Visits"-
// Workspace - automatisch anhand des Dateinamens geladen (kein Eintrag in
// hooks.py noetig, derselbe Mechanismus wie bei site_visit_calendar.js).
frappe.listview_settings['Site Visit'] = {
	onload(listview) {
		listview.page.add_inner_button(__('Dispatch Board'), () => {
			frappe.set_route(['dispatch-board']);
		});
	},
};
