from fieldservice.install import _home_workspace_enable


def execute():
	"""HOME_SHORTCUTS bekam den neuen 'Dispatch Board'-Eintrag - selbes
	Muster wie add_home_workspace_shortcuts.py; _home_workspace_enable()
	ist idempotent (ueberspringt vorhandene Labels), daher hier gefahrlos
	erneut aufrufbar, auch auf Benches, die den urspruenglichen Patch schon
	liefen."""
	_home_workspace_enable()
