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

## Binary data preparation

Run RUN_PREPARE_BINARY.cmd for local desktop export of the audited dataset to Parquet and Arrow. See docs/binary-dataset.md for compression profiles, five-decimal runtime coordinates, full-precision archives, validation and recorded loader proposals. No database or production changes.

## Local file-loader comparison

A separate diagnostic page compares actual Parquet and Arrow decoding, progressive land display, four-worker filtering, analytics and fleet rates. Run npm run build and npm run preview -- --host 127.0.0.1 --port 5186 --strictPort, then open http://127.0.0.1:5186/accidents/benchmark.html. See docs/file-benchmark.md for setup, measured results and limits. Generated data stays local; production remains unchanged.

## Step 01 — Loader and cache (2026-10-11)

The current file-loader entry point is /accidents/files.html: selected-year Arrow+Brotli or Parquet, four persistent workers, progressive land display and an LRU data-buffer budget of 100/32 MiB. Source data now lives outside Git in the adjacent UAD_data folder. Run the preview on port 5187. No Supabase environment is needed for this page.

See README_01_step_Loader_and_cache.md for the step report and archive workflow, and docs/progress.md for the overall journal. Archives stay local in UAD_data/NN_step_Name.zip; data, credentials, dependencies and build output are excluded. The existing Supabase map and benchmark remain separate entry points.

## Step 02 — Overview and fleet (2026-10-11)

The file page now starts with a 26 KB public summary bundle: annual Unfallatlas totals for 2020–2025, severity, overlapping participant groups, land comparisons and crashes involving Pkw per 10,000 registered Pkw. All 119 national/land fleet snapshots from 2020–2026 are included. The overview remains available independently of map loading and LRU clearing. Selected land persists when switching year/source/budget.

Regenerate the small tracked public bundle with `node scripts/prepare-overview.mjs <complete binary export folder>`, then test and build. Full source datasets stay outside Git in UAD_data. See README_02_step_Overview_and_fleet.md for inputs, checksum validation, formulas, browser checks and the local archive `02_step_Overview_and_fleet.zip`. Arbitrary combined filters remain step 03; publication requires separate approval.

## Step 03 — Analytics mockups (2026-10-11)

Standalone review screens are saved in `prototypes/overview-mockup.html` and `prototypes/time-mockup.html`. The second screen uses verified joint time aggregates, calendar-adjusted weekday/weekend profiles and participant/period selection. These are design prototypes; the application loader and map remain at step 02.

The proposed generic filter implementation was deferred pending analytics decisions. See `docs/analytics-candidates.md` for the appendable candidate register and `README_03_step_Analytics_mockups.md` for scope, data checks and local archive `03_step_Analytics_mockups.zip`.

## Step 04 — Severity and conditions (2026-10-11)

The third standalone prototype is `prototypes/severity-mockup.html`: outcome categories, annual shares, lighting/road comparisons and joint cells with actual counts. All three prototypes now retain the header controls while scrolling. Candidate C17 records weekday/hour maxima and minima for later discussion. See README_04_step_Severity_and_conditions.md and docs/analytics-candidates.md. Local archive: `04_step_Severity_and_conditions.zip`.


## Шаг 05 — Map mockup · 2026-10-11

База `efebdda`. Четвёртый макет с настоящими точками, рабочими годом и землёй; переходы сохраняют контекст исследования. Header закреплён, дополнительные фильтры и карточка пока для обсуждения. C18 «Сравнения и рейтинги» отложен. Проверены сборка, ESLint, 30 тестов, числа карты, переходы и узкий экран. Ограничения iframe/кеша и локального запуска: `README_05_step_Map_mockup.md`. Полный локальный снимок: `UAD_data/05_step_Map_mockup.zip`.


## Шаг 06 — Map filters and cache · 2026-10-12

База 5e9679b. Реальные фильтры, фасетные счётчики, маски workers и GPU-отбор. Смена земли без повторной загрузки, годы из LRU 100/32 МиБ; актуальный год из каталога. 36 тестов, сборка, ESLint и CSV/браузерные сверки прошли. Правила: docs/map-filters.md. Проверки и ограничения: README_06_step_Map_filters_and_cache.md. Локальный архив: UAD_data/06_step_Map_filters_and_cache.zip.
