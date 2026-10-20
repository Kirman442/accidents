import test from 'node:test';
import assert from 'node:assert/strict';
import { checkDatabase } from './supabase-keepalive.mjs';

const env = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'test-key' };

test('reads just one oid from the selected land, without requesting a count', async () => {
  await checkDatabase({ env, request: async (url, options) => {
    assert.equal(url.pathname, '/rest/v1/unfallatlas_partitioned');
    assert.equal(url.searchParams.get('limit'), '1');
    assert.equal(url.searchParams.get('uland'), 'eq.12');
    assert.equal(url.searchParams.get('select'), 'oid');
    assert.deepEqual(options.headers, { apikey: 'test-key', Accept: 'application/json' });
    assert.equal(options.redirect, 'error');
    return Response.json([{ oid: 123 }]);
  } });
});

test('retries transient HTTP and network errors', async () => {
  let calls = 0;
  const delays = [];
  const result = await checkDatabase({ env, wait: async ms => delays.push(ms), request: async () => {
    calls++;
    if (calls === 1) return new Response('', { status: 503 });
    if (calls === 2) throw new Error('network');
    return Response.json([{ oid: 123 }]);
  } });
  assert.equal(result.attempts, 3);
  assert.deepEqual(delays, [2000, 4000]);
});

test('fails after three network errors without exposing their contents', async () => {
  let calls = 0;
  await assert.rejects(checkDatabase({ env, wait: async () => {}, request: async () => {
    calls++;
    throw new Error('sensitive details');
  } }), /failed after 3 attempts/);
  assert.equal(calls, 3);
});

test('does not retry permission failures', async () => {
  let calls = 0;
  await assert.rejects(checkDatabase({ env, request: async () => {
    calls++;
    return new Response('sensitive details', { status: 401 });
  } }), /HTTP 401/);
  assert.equal(calls, 1);
});

test('rejects empty responses and invalid JSON', async () => {
  for (const response of [Response.json([]), new Response('not JSON'), Response.json([{ other: 1 }])]) {
    await assert.rejects(checkDatabase({ env, request: async () => response }));
  }
});

test('rejects unsafe configuration before making a request', async () => {
  for (const url of ['http://example.supabase.co', 'https://example.org', 'https://user:pass@example.supabase.co']) {
    await assert.rejects(checkDatabase({
      env: { ...env, SUPABASE_URL: url },
      request: async () => assert.fail('must not send credentials'),
    }), /valid HTTPS/);
  }
});
