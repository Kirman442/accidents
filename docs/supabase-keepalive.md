# Scheduled Supabase database check

The workflow reads one `oid` from `unfallatlas_partitioned`, filtered to `uland=12`.
It never writes data or downloads the complete dataset. A successful run requires
one actual record, so an empty response caused by read policies is not treated as success.

## Enable on GitHub

1. Add the script, test, and workflow to the repository's default branch.
2. In Settings > Secrets and variables > Actions, add repository secrets:
   - `SUPABASE_URL`: the HTTPS project URL used by the application.
   - `SUPABASE_ANON_KEY`: the application's anon key or a publishable key with
     permission to read the same data. Do not use the database password or service role key.
3. Open Actions > Supabase database check > Run workflow and verify success.
4. Enable GitHub Actions failure notifications in your account notification settings.

The schedule makes three requests each day, at different times on each weekday.
All cron times are UTC; local Berlin times change with daylight saving time.
Network failures, HTTP 429, and server errors get up to two retries. Other HTTP
errors, invalid JSON, and missing records fail the job. Logs omit keys and data.

## Local use (Node.js 24)

```powershell
node --test scripts/supabase-keepalive.test.mjs
node --use-system-ca --env-file=.env scripts/supabase-keepalive.mjs
```

The script also accepts the existing `VITE_SUPABASE_URL` and
`VITE_SUPABASE_ANON_KEY` variables for local use. Never commit `.env`.
The local command uses the system certificate store, which is needed on Windows
setups with a locally trusted HTTPS proxy. TLS verification remains enabled.

## Limits

Supabase evaluates low database activity over a seven-day window. Its docs say a
few database requests daily are typically enough, but publish no exact threshold.
This check does not guarantee prevention of pausing, and does not resume a project
that is already paused. Paid plans are exempt from inactivity pausing.

GitHub may delay or drop scheduled jobs. Public repositories have their scheduled
workflows disabled after 60 days without repository activity; the scheduled runs
alone should not be relied on to prevent this. Check the workflow periodically.
There are no automatic commits to keep the repository active.

Sources:
- https://supabase.com/docs/guides/platform/free-project-pausing
- https://docs.github.com/en/actions/reference/workflows-and-actions/events-that-trigger-workflows#schedule
