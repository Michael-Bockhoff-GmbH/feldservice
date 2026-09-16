from frappe.custom.doctype.custom_field.custom_field import create_custom_fields

from fieldservice.install import CUSTOM_FIELDS


def execute():
	"""after_install legt CUSTOM_FIELDS nur bei einer Neuinstallation an -
	fuer Benches, auf denen die App schon vor diesem Custom Field
	installiert war, holt dieser Patch das einmalig nach (bench migrate
	fuehrt after_install nicht erneut aus)."""
	create_custom_fields({"Timesheet Detail": CUSTOM_FIELDS["Timesheet Detail"]}, ignore_validate=True)
