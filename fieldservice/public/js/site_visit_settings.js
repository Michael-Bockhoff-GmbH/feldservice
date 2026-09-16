// Default Start Address: derselbe Freitext-mit-Sofortsuche-Mechanismus wie
// start_address/customer_address_override auf Site Visit (siehe dort für
// die ausführliche Begründung) - kein Address-Datensatz nötig.
frappe.ui.form.on('Site Visit Settings', {
	onload(frm) {
		frm.set_query('default_start_address', () => 'frappe.integrations.doctype.geolocation_settings.geolocation_settings.autocomplete');
		const field = frm.get_field('default_start_address');
		if (field) field.df.ignore_validation = 1;
	},

	default_start_address(frm) {
		const value = frm.doc.default_start_address;
		if (!value) return;
		let parsed;
		try {
			parsed = JSON.parse(value);
		} catch (e) {
			return;
		}
		const parts = [parsed.address_line1, parsed.pincode, parsed.city, parsed.state, parsed.country].filter(Boolean);
		if (parts.length) frm.set_value('default_start_address', parts.join(', '));
	},
});
