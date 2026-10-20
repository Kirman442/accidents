import { setTimeout as sleep } from 'node:timers/promises';
import { pathToFileURL } from 'node:url';

export async function checkDatabase({
  env = process.env,
  request = fetch,
  wait = sleep,
} = {}) {
  const url = new URL(env.SUPABASE_URL || env.VITE_SUPABASE_URL);
  const key = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY;
  if (url.protocol !== 'https:' || !url.hostname.endsWith('.supabase.co') ||
      url.username || url.password || !key) {
    throw new Error('Set a valid HTTPS Supabase project URL and anon/publishable key.');
  }

  const endpoint = new URL('/rest/v1/unfallatlas_partitioned', url.origin);
  endpoint.search = new URLSearchParams({ select: 'oid', uland: 'eq.12', limit: '1' });

  for (let attempt = 1; attempt <= 3; attempt++) {
    let response;
    try {
      response = await request(endpoint, {
        headers: { apikey: key, Accept: 'application/json' },
        signal: AbortSignal.timeout(15_000),
        redirect: 'error',
      });
    } catch {
      if (attempt === 3) throw new Error('Database request failed after 3 attempts (network or timeout).');
      await wait(attempt * 2000);
      continue;
    }

    if (!response.ok) {
      const retryable = response.status === 429 || response.status >= 500;
      await response.body?.cancel();
      if (!retryable || attempt === 3) {
        throw new Error(`Database request returned HTTP ${response.status}.`);
      }
      await wait(attempt * 2000);
      continue;
    }

    let rows;
    try {
      rows = await response.json();
    } catch {
      throw new Error('Database returned invalid JSON.');
    }
    if (!Array.isArray(rows) || rows.length !== 1 || rows[0]?.oid == null) {
      throw new Error('Expected one database record with an oid; check data and read permissions.');
    }
    return { attempts: attempt };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const { attempts } = await checkDatabase();
    console.log(`${new Date().toISOString()} Database read OK (one record, ${attempts} attempt(s)).`);
  } catch (error) {
    // Do not print response bodies, credentials, or raw network errors.
    console.error(error instanceof TypeError ? 'Invalid Supabase URL configuration.' : error.message);
    process.exitCode = 1;
  }
}
