import frappe


def execute():
	"""Site Visit Settings ist ein Single - ein neues Feld mit "default" im
	DocType-JSON fuellt sich fuer einen bereits bestehenden Single-Datensatz
	nicht von selbst (anders als bei neu angelegten Dokumenten). Traegt hier
	den Standardwert nach, aber nur falls noch keiner gesetzt ist. Muss nach
	dem Schema-Sync laufen (post_model_sync), da die Spalte time_zone vorher
	noch nicht existiert."""
	settings = frappe.get_single("Site Visit Settings")
	if not settings.time_zone:
		settings.time_zone = "Europe/Berlin"
		settings.save(ignore_permissions=True)
