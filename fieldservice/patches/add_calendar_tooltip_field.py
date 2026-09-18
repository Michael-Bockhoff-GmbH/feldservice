import frappe


def execute():
	"""Site Visit Settings ist ein Single - ein neues Feld mit "default" im
	DocType-JSON fuellt sich fuer einen bereits bestehenden Single-Datensatz
	nicht von selbst. Traegt hier den Standardwert nach, aber nur falls noch
	keiner gesetzt ist. Muss nach dem Schema-Sync laufen (post_model_sync),
	da die Spalte calendar_tooltip_field vorher noch nicht existiert."""
	settings = frappe.get_single("Site Visit Settings")
	if not settings.calendar_tooltip_field:
		settings.calendar_tooltip_field = "Project"
		settings.save(ignore_permissions=True)
