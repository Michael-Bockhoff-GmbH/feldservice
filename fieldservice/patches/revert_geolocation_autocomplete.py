import frappe


def execute():
	"""Der fruehere Patch add_geolocation_autocomplete (jetzt entfernt)
	aktivierte Frappes eingebaute Adress-Autovervollstaendigung (Kern-
	Doctype "Geolocation Settings") mit dem Kern-Provider "Nomatim" -
	dessen Anbindung schickt keinen User-Agent-Header mit, was Nominatims
	Nutzungsbedingungen verlangen, und wird deshalb mit 403 Forbidden
	abgelehnt (reproduziert am 17.09.2026 - siehe search_addresses() in
	site_visit/mileage.py fuer die eigene, funktionierende Anbindung, die
	diese App jetzt stattdessen verwendet).

	Schaltet die Einstellung nur ab, wenn sie noch exakt der von jenem
	Patch gesetzte Provider/Basis-URL ist - eine inzwischen von Hand
	anders konfigurierte Autovervollstaendigung (z. B. Geoapify mit
	eigenem Key) bleibt unangetastet."""
	settings = frappe.get_single("Geolocation Settings")
	if settings.provider == "Nomatim" and settings.base_url == "https://nominatim.openstreetmap.org":
		settings.enable_address_autocompletion = 0
		settings.save(ignore_permissions=True)
