// Default Start Address: derselbe Freitext-mit-Sofortsuche-Mechanismus wie
// start_address/customer_address_override auf Site Visit (siehe dort für
// die ausführliche Begründung, inkl. warum die eigene search_addresses()
// statt Frappes eingebauter Adress-Autovervollständigung verwendet wird)
// - kein Address-Datensatz nötig.
frappe.ui.form.on('Site Visit Settings', {
	onload(frm) {
		frm.set_query('default_start_address', () => 'fieldservice.site_visit.mileage.search_addresses');
		const field = frm.get_field('default_start_address');
		if (field) field.df.ignore_validation = 1;
	},
});
