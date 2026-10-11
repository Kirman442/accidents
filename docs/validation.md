# Validation — 2026-10-11

- New target: fiambamorokfphkzdjxc, PostgreSQL 17.11.
- Imported 16 standalone tables, 269048 rows, all 14 source columns including geometry. Import was committed as one transaction. Each table has PRIMARY KEY (oid), CHECK (uland = its land), geometry/category/weekday indexes, and read-only SELECT policies for anon/authenticated.
- Each source export matched its exact per-land count.
- Actual production request code loaded coordinates and attributes directly through the new public REST API. Every loaded coordinate and each attribute used by the map matched the source export. Total 269048; sequential verification 20197 ms. This interval is not map readiness or a benchmark.
- API probe requesting 20000 rows from land 05 returned 20000, HTTP 200.
- 12 regression tests passed: server truncation, pagination termination, duplicates/order, table validation, error propagation, cancellation, unsafe IDs, invalid coordinates, land-aware merge, concurrency, combined/null/zero filters.
- Vite production build passed. ESLint src passed with four pre-existing Fast Refresh warnings in legendSelectOptions.prod.jsx.
- Browser: loaded 269048 points, bicycle Without returned 181868 (shown as 181.9K); combining land 05 returned 40047 (40.0K); reset restored 269048. Error UI was also observed before the new tables existed.

These checks confirm this experimental version loads complete data and filters correctly in the observed runs. They do not establish why the original parent-table API intermittently timed out, or guarantee long-term absence of timeouts.
