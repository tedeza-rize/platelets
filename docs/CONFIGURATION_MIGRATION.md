# Configuration Migration

Platelets stores runtime API keys and operational settings in SQLite
`app_settings`.

- API keys are entered during setup and read from the database at runtime.
- Stored API key values are encrypted before they are written to
  `app_settings`. Set `PLATELETS_SECRET_KEY` to a long random value to make the
  encryption key stable across deployments. If it is not set, Platelets creates
  a local `.platelets-secret-key` file in `PLATELETS_DATA_DIR`.
- AI settings are managed from the sudo AI settings page.
- Operational settings such as private AI base URL allowance, dataset automatic
  updates, KMA polling interval, and Overpass API URL are managed from the sudo
  console.
- Environment variables should be limited to bootstrap values that must exist
  before the database can be opened, such as `PORT`, `PLATELETS_DATA_DIR`, and
  `PLATELETS_SECRET_KEY`.

If an older deployment used API-key or behavior environment variables, sign in
with the sudo account and copy those values into the setup or sudo console
before removing them from the environment.

Existing setup records that still contain plaintext API keys are migrated
automatically the next time runtime API keys are read. If
`PLATELETS_SECRET_KEY` changes after encryption, previously stored API keys can
no longer be decrypted and must be re-entered.
