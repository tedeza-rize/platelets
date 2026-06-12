# Configuration Migration

Platelets stores runtime API keys and operational settings in SQLite
`app_settings`.

- API keys are entered during setup and read from the database at runtime.
- AI settings are managed from the sudo AI settings page.
- Operational settings such as private AI base URL allowance, dataset automatic
  updates, KMA polling interval, and Overpass API URL are managed from the sudo
  console.
- Environment variables should be limited to bootstrap values that must exist
  before the database can be opened, such as `PORT` and `PLATELETS_DATA_DIR`.

If an older deployment used API-key or behavior environment variables, sign in
with the sudo account and copy those values into the setup or sudo console
before removing them from the environment.
