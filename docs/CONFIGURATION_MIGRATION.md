# Configuration Migration

Platelets stores runtime API keys, alert integrations, and operational settings
in `app_settings`. Environment files are no longer an application configuration
source; only `PORT` is supported for selecting the listening port.

- API keys are entered during setup or from the sudo external-service panel.
- Webhook, web-push, and traffic credentials are managed from the same sudo
  panel.
- Stored secrets are encrypted before they are written to the database.
- The encryption key is generated at `data/.platelets-secret-key`.
- AI behavior and map/import settings are managed from the sudo console.

Before upgrading an older deployment, record any integration values that still
exist only in its environment file. After upgrading, enter them in the sudo
external-service panel and remove the old variables. Back up the complete
`data/` directory because the encrypted settings and their local encryption key
must be restored together.
