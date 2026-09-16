from fieldservice.install import _home_workspace_enable


def execute():
	"""after_install legt die Home-Shortcuts nur bei einer Neuinstallation an -
	fuer Benches, auf denen die App schon vor dieser Aenderung installiert
	war, holt dieser Patch das einmalig nach (bench migrate fuehrt
	after_install nicht erneut aus)."""
	_home_workspace_enable()
