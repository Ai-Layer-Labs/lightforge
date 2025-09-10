#!/usr/bin/env node
/**
 * Setup Brave Search tool idempotently against a persistent RCRT backend.
 * - Ensures BRAVE_SEARCH_API_KEY secret exists (no env fallback; requires --api-key if missing)
 * - Verifies tool presence by checking for breadcrumbs tagged 'tool:brave_search'
 * - Optionally triggers a test tool.request.v1 to verify end-to-end
 *
 * Usage:
 *   node scripts/setup-brave.js --base-url http://localhost:8081 --token-endpoint /api/auth/token --workspace workspace:tools --api-key YOUR_KEY --test "ebikes 2025"
 *
 * Auth:
 *   - Provide --token-endpoint to fetch a JWT, or
 *   - Provide --token (a JWT string) directly
 */

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const baseUrl = (args['base-url'] || 'http://localhost:8081').replace(/\/$/, '');
  const workspace = args.workspace || 'workspace:tools';
  const tokenEndpoint = args['token-endpoint'];
  const directToken = args.token;
  const apiKeyArg = args['api-key'];
  const doTest = typeof args.test === 'string' ? args.test : undefined;

  const authToken = await resolveToken(baseUrl, tokenEndpoint, directToken);
  const headers = authToken ? { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authToken}` } : { 'Content-Type': 'application/json' };

  log('Base URL:', baseUrl);
  log('Workspace:', workspace);

  // 1) Ensure BRAVE_SEARCH_API_KEY secret exists
  const secretName = 'BRAVE_SEARCH_API_KEY';
  const secret = await findSecret(baseUrl, headers, secretName);
  if (secret) {
    log(`Secret '${secretName}' already exists (id=${secret.id}).`);
  } else {
    if (!apiKeyArg) {
      error(`Secret '${secretName}' is missing. Re-run with --api-key <value>.`);
      process.exit(1);
    }
    const created = await createSecret(baseUrl, headers, secretName, apiKeyArg);
    log(`Created secret '${secretName}' (id=${created.id}).`);
  }

  // 2) Verify tool existence (definition published) via breadcrumb tags
  const hasTool = await hasToolBreadcrumb(baseUrl, headers, 'tool:brave_search');
  if (hasTool) {
    log(`Tool 'brave_search' already registered (found breadcrumbs with tag 'tool:brave_search').`);
  } else {
    log(`Tool 'brave_search' not detected yet. Ensure tools-runner is running; it registers automatically when the secret exists.`);
  }

  // 3) Optionally test tool by emitting a tool.request.v1
  if (doTest) {
    const reqId = await emitToolRequest(baseUrl, headers, workspace, 'brave_search', { query: doTest, count: 5 });
    log(`Emitted test tool.request.v1 (id=${reqId}). Listen for tool.response.v1 via SSE to confirm.`);
  }

  process.exit(0);

  // Helpers
  function parseArgs(argv) {
    const out = {};
    for (let i = 0; i < argv.length; i++) {
      const a = argv[i];
      if (a.startsWith('--')) {
        const [k, v] = a.includes('=') ? a.slice(2).split('=') : [a.slice(2), argv[i+1] && !argv[i+1].startsWith('--') ? argv[++i] : ''];
        out[k] = v === '' ? true : v;
      }
    }
    return out;
  }

  async function resolveToken(baseUrl, tokenEndpoint, token) {
    if (token) return token;
    if (!tokenEndpoint) return undefined;
    const url = tokenEndpoint.startsWith('http') ? tokenEndpoint : `${baseUrl.replace(/\/$/, '')}${tokenEndpoint.startsWith('/') ? '' : '/'}${tokenEndpoint}`;
    try {
      const resp = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' });
      const json = await resp.json().catch(() => ({}));
      return json?.token;
    } catch {
      return undefined;
    }
  }

  async function findSecret(baseUrl, headers, name) {
    const resp = await fetch(`${baseUrl}/secrets`, { headers });
    if (!resp.ok) throw new Error(`List secrets failed: ${resp.status}`);
    const list = await resp.json();
    return Array.isArray(list) ? list.find(s => String(s?.name || '').toLowerCase() === String(name).toLowerCase()) : undefined;
  }

  async function createSecret(baseUrl, headers, name, value) {
    const resp = await fetch(`${baseUrl}/secrets`, { method: 'POST', headers, body: JSON.stringify({ name, value, scope_type: 'tenant' }) });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new Error(`Create secret failed ${resp.status}: ${txt}`);
    }
    return resp.json();
  }

  async function hasToolBreadcrumb(baseUrl, headers, tag) {
    const url = new URL(`${baseUrl}/breadcrumbs`);
    url.searchParams.set('tag', tag);
    const resp = await fetch(url.toString(), { headers });
    if (!resp.ok) throw new Error(`List breadcrumbs failed: ${resp.status}`);
    const arr = await resp.json();
    return Array.isArray(arr) && arr.length > 0;
  }

  async function emitToolRequest(baseUrl, headers, workspace, toolName, input) {
    const body = {
      schema_name: 'tool.request.v1',
      title: `Test: ${toolName}`,
      tags: [workspace, 'tool:request', `tool:${toolName}`],
      context: { tool: toolName, input }
    };
    const resp = await fetch(`${baseUrl}/breadcrumbs`, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!resp.ok) {
      const txt = await resp.text().catch(() => '');
      throw new Error(`Emit tool.request failed ${resp.status}: ${txt}`);
    }
    const json = await resp.json();
    return json?.id;
  }

  function log(...a) { console.log('[setup-brave]', ...a); }
  function error(...a) { console.error('[setup-brave]', ...a); }
})();


