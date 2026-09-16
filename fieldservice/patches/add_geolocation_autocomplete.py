from fieldservice.install import _geolocation_autocomplete_enable


def execute():
	"""after_install aktiviert die Adress-Autovervollstaendigung nur bei
	einer Neuinstallation - fuer Benches, auf denen die App schon vor
	dieser Aenderung installiert war, holt dieser Patch das einmalig nach
	(bench migrate fuehrt after_install nicht erneut aus)."""
	_geolocation_autocomplete_enable()
