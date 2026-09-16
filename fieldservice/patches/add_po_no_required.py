from fieldservice.install import _po_no_required_enable


def execute():
	"""after_install macht Customer Reference nur bei einer Neuinstallation
	verpflichtend - fuer Benches, auf denen die App schon vor dieser
	Aenderung installiert war, holt dieser Patch das einmalig nach (bench
	migrate fuehrt after_install nicht erneut aus)."""
	_po_no_required_enable()
