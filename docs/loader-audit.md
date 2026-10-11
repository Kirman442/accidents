# UAD loading experiment

Baseline: accidents commit 457de74. Branch: codex/uad-standalone.

## Findings before changes
- Historical range pages had no ORDER BY; stable pagination was not guaranteed.
- Historical offset advanced by 20000 even when the server returned fewer rows.
- Current loader count-null fallback could prematurely stop after the first page.
- Both versions lacked cancellation and could accept obsolete responses after restart.
- Global oid merging could overwrite another land or silently accept missing attributes.
- Error UI was commented out; current progressive data could be mistaken for complete data after failure.
- Falsy filter checks treated participation value 0 as no filter.

## Experiment decisions
Direct standalone tables; two phases; 20000 requested rows; stable indexed oid ordering; no exact count in map loading; continue until empty, including short pages; 4 concurrent land requests; no automatic retries (timeouts stay observable). Four workers is an experiment setting, not a proven fix. Each ready land publishes immediately as points. Hexagon/Heatmap aggregation starts only after every land has completed coordinate loading. A failed coordinate phase keeps the available points and displays an error; it never marks partial data complete. Each loaded row retains land identity; filters become available only after complete attribute merge. Restart and unmount abort obsolete work.

Offset pagination assumes the imported dataset remains unchanged while loading. Separate phases do not provide a single database snapshot. Live validation compares per-land counts and coordinates with the exported source.

Secrets and imported data stay in ignored data/ and .env.local. Current source checkout and database remain untouched.
