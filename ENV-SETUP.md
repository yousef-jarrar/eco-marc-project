# Private configuration

Runtime settings are loaded from `backend/.env` through `backend/config/env.php`. Current database credentials and Google/AI settings were moved there; the existing Cloudinary URL was preserved. Real values were not printed during migration.

Keys used by the application:

- `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`
- `CLOUDINARY_URL`
- `GOOGLE_CLIENT_ID`
- `OLLAMA_URL`, `OLLAMA_MODEL`
- `SESSION_IDLE_TIMEOUT`, `SESSION_ABSOLUTE_TIMEOUT`, `SESSION_COOKIE_PATH`

Use `backend/.env.example` as the shareable template. It contains placeholders, not the current credentials. The real `.env` is ignored by Git and is not tracked. Server-provided environment variables take precedence over file values. Required connection settings have no hardcoded credential fallback.

`GOOGLE_CLIENT_ID` is a public identifier and is intentionally returned to the Google sign-in frontend. Cloudinary secrets and database credentials are never returned. User password hashes remain in MySQL; session identifiers and CSRF tokens remain in PHP sessions rather than being moved to `.env`.

Apache denies access to environment files, config files, Git metadata and private key file extensions. The separate workspace preview server on port 4187 now serves only public frontend folders and approved static formats; backups, scripts, staging folders and private files cannot be downloaded. Private migration backups are outside the XAMPP project and ignored by the workspace's Git rules.

Checks passed: runtime database connection, Cloudinary configuration, Google configuration, a live Ollama reply, missing-key handling, environment precedence, guest authentication/session checks and actual HTTP access restrictions. Application-source scanning found no matching hardcoded password/API-secret assignments or credential URLs. Dependencies, private environment files and backups were excluded from the source scan; this is not a guarantee about all possible secret formats or prior Git history.

No database records or cloud assets were changed by this configuration migration. For deployment, copy the example to `.env` and fill your own values; never publish the real file or private backups.
