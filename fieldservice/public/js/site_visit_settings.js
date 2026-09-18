// Default Start Address: derselbe Freitext-mit-Sofortsuche-Mechanismus wie
// start_address/customer_address_override auf Site Visit (siehe dort für
// die ausführliche Begründung, inkl. warum die eigene search_addresses()
// statt Frappes eingebauter Adress-Autovervollständigung verwendet wird)
// - kein Address-Datensatz nötig.
frappe.ui.form.on('Site Visit Settings', {
	onload(frm) {
		frm.set_query('default_start_address', () => 'fieldservice.site_visit.mileage.search_addresses');
		const field = frm.get_field('default_start_address');
		if (!field) return;
		field.df.ignore_validation = 1;
		debounce_address_field(field);
	},
});

// Siehe site_visit.js fuer die ausfuehrliche Begruendung.
function debounce_address_field(field, delay = 400) {
	let timer = null;
	const original = field.execute_query_if_exists.bind(field);
	field.execute_query_if_exists = function (term) {
		clearTimeout(timer);
		timer = setTimeout(() => original(term), delay);
	};
}
