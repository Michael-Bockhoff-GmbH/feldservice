"""Kilometerberechnung ueber die OpenRouteService-API (openrouteservice.org).

Zwei Schritte pro Berechnung: Geocoding (Adresstext -> Koordinaten) ueber
den /geocode/search-Endpunkt, dann die eigentliche Route ueber
/v2/directions/driving-car. Beides mit demselben API-Key (Site Visit
Settings -> OpenRouteService API Key).

Bewusst kein Caching von Koordinaten hier - Adressen aendern sich selten
genug, dass der zusaetzliche Code (inkl. Invalidierung) den API-Aufruf
nicht aufwiegt. Ein Fehlschlag (kein Key, Adresse nicht gefunden, Netzwerk)
wirft frappe.ValidationError mit einer fuer den Techniker verstaendlichen
Meldung - die Kilometerberechnung ist eine Komfortfunktion, kein Teil der
before_submit-Pflichtpruefung, ein Site Visit laesst sich auch ohne
Kilometer buchen.
"""

import frappe
from frappe import _

GEOCODE_URL = "https://api.openrouteservice.org/geocode/search"
DIRECTIONS_URL = "https://api.openrouteservice.org/v2/directions/driving-car"
REQUEST_TIMEOUT = 10


def get_start_address(doc):
	"""Startadresse fuer die Kilometerberechnung: Ueberschreibung am Site
	Visit selbst, sonst die in Site Visit Settings hinterlegte
	Standard-Startadresse, sonst die Standardadresse der Firma."""
	if doc.start_address:
		return doc.start_address

	settings = frappe.get_cached_doc("Site Visit Settings")
	if settings.default_start_address:
		return settings.default_start_address

	from frappe.contacts.doctype.address.address import get_default_address

	return get_default_address("Company", doc.company)


def calculate_distance_km(doc):
	"""Berechnet die Fahrstrecke (km, einfache Strecke) von der
	Startadresse zur Kundenadresse des Site Visit. Wirft
	frappe.ValidationError mit verstaendlicher Meldung bei fehlendem
	API-Key, fehlender/nicht auffindbarer Adresse oder API-Fehler."""
	settings = frappe.get_cached_doc("Site Visit Settings")
	if not settings.ors_api_key:
		frappe.throw(
			_("No OpenRouteService API key configured. Set one in Site Visit Settings."), title=_("Mileage")
		)

	start_address = get_start_address(doc)
	if not start_address:
		frappe.throw(
			_(
				"No start address found. Set a Start Address on the Site Visit, a Default Start "
				"Address in Site Visit Settings, or a default address on the Company."
			),
			title=_("Mileage"),
		)

	from frappe.contacts.doctype.address.address import get_default_address

	customer_address = get_default_address("Customer", doc.customer)
	if not customer_address:
		frappe.throw(_("Customer {0} has no address on file.").format(doc.customer), title=_("Mileage"))

	start_coords = _geocode(start_address, settings.ors_api_key)
	end_coords = _geocode(customer_address, settings.ors_api_key)
	return _route_distance_km(start_coords, end_coords, settings.ors_api_key)


def _address_text(address_name):
	address = frappe.get_cached_doc("Address", address_name)
	parts = [address.address_line1, address.address_line2, address.city, address.pincode, address.country]
	return ", ".join(part for part in parts if part)


def _geocode(address_name, api_key):
	text = _address_text(address_name)
	response = requests_get(
		GEOCODE_URL,
		params={"api_key": api_key, "text": text, "size": 1},
	)
	features = response.get("features") or []
	if not features:
		frappe.throw(_("Could not find coordinates for address {0}.").format(address_name), title=_("Mileage"))
	# GeoJSON: [longitude, latitude]
	return features[0]["geometry"]["coordinates"]


def _route_distance_km(start_coords, end_coords, api_key):
	response = requests_post(
		DIRECTIONS_URL,
		headers={"Authorization": api_key, "Content-Type": "application/json"},
		json={"coordinates": [start_coords, end_coords]},
	)
	try:
		distance_m = response["routes"][0]["summary"]["distance"]
	except (KeyError, IndexError) as e:
		frappe.throw(_("OpenRouteService did not return a route between the two addresses."), title=_("Mileage"))
	return round(distance_m / 1000, 1)


def requests_get(url, params):
	import requests

	try:
		r = requests.get(url, params=params, timeout=REQUEST_TIMEOUT)
		r.raise_for_status()
	except requests.RequestException as e:
		frappe.throw(_("OpenRouteService request failed: {0}").format(e), title=_("Mileage"))
	return r.json()


def requests_post(url, headers, json):
	import requests

	try:
		r = requests.post(url, headers=headers, json=json, timeout=REQUEST_TIMEOUT)
		r.raise_for_status()
	except requests.RequestException as e:
		frappe.throw(_("OpenRouteService request failed: {0}").format(e), title=_("Mileage"))
	return r.json()


@frappe.whitelist()
def calculate_distance(site_visit):
	"""Fuer den "Kilometer berechnen"-Knopf im Formular."""
	doc = frappe.get_doc("Site Visit", site_visit)
	doc.check_permission("write")
	km = calculate_distance_km(doc)
	doc.db_set("distance_km", km)
	return km
