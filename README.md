# UAD: standalone land-table experiment

Isolated accidents branch based on commit 457de74; corrected filtering is carried over from 6a743a3. The current accidents checkout and source Supabase are not modified.

## Run locally

Copy .env.example to .env.local and enter the new project URL and publishable key. Never put a database password or service-role key in a VITE variable.

Run npm ci, npm test and npm run dev -- --port 5175. Open http://127.0.0.1:5175/accidents/.

## Loading

The application reads unfallatlas_uland_01 through unfallatlas_uland_16 directly. These must be standalone tables with a unique oid index and public read access. No parent table or API view is needed. Coordinates load before attributes. Each completed land is shown immediately as points; aggregation starts only after all coordinates are complete, with four concurrent land tasks and requested pages of 20000 rows. Rows are ordered by oid, offset advances by the actual response length, and an empty page ends a land. No exact count or automatic retries are used by the map. Dataset must remain unchanged during a load.

Filters preserve Alle / Mit / Ohne: null is All and zero is Without. They are disabled until the attribute merge is complete. Request failures are displayed with a retry button; obsolete loads are cancelled.

## Data transfer

The scripts are guarded to the original and new project references for this experiment. Credentials are read only from ignored local files.

- scripts/transfer-data.mjs export reads the source sibling accidents/.env and exports all columns to data/transfer.
- scripts/transfer-data.mjs import reads data/uad_settings.txt and creates standalone tables in the new project in one transaction. It refuses existing table names; do not rerun after a successful import.
- scripts/transfer-data.mjs verify compares the actual production loader results with the export, per row and land.
- scripts/db-check.mjs checks the target connection and schema.

Use node --use-system-ca when required by the Windows certificate configuration. Import requires psql; UAD_PSQL can override the default local executable. Geometry is transferred through GeoJSON into PostGIS. Source count/export/verification files remain local and are not committed.

See docs/loader-audit.md and docs/validation.md for findings and verified results.

## Analytics preparation

See docs/analytics-dataset.md for local preparation of Unfallatlas 2020-2025 and KBA FZ 1 snapshots 2020-2026. Generated datasets stay under ignored data/; preparation does not modify Supabase or the published map.
