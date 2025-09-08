import { NextRequest } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Forward-applies a validated plan by calling the RCRT backend via the local proxy
export async function POST(req: NextRequest) {
  const plan = await req.json().catch(() => ({}));
  const tags: string[] = Array.isArray(plan?.tags) ? plan.tags : [];
  const workspace = tags.find((t) => t.startsWith('workspace:')) || 'workspace:unknown';

  const actions: any[] = Array.isArray(plan?.context?.actions) ? plan.context.actions : [];
  const planIdem = plan?.context?.idempotency_key ? String(plan.context.idempotency_key) : undefined;

  const created: any[] = [];
  const updated: any[] = [];
  const deleted: any[] = [];
  const errors: any[] = [];

  const base = new URL('/api/rcrt/', req.url).toString().replace(/\/$/, '');
  const timeoutMs = 4000;
  const timeout = () => {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), timeoutMs).unref?.();
    return ctrl.signal;
  };

  for (let i = 0; i < actions.length; i++) {
    const act = actions[i];
    try {
      switch (act?.type) {
        case 'create_instance': {
          const body = {
            schema_name: 'ui.instance.v1',
            title: `${act.instance?.component_ref || 'Component'} Instance`,
            tags: [workspace, 'ui:instance', `region:${act.region || 'content'}`],
            context: {
              component_ref: act.instance?.component_ref,
              props: act.instance?.props || {},
              bindings: act.instance?.bindings || {},
              order: act.instance?.order ?? 0
            }
          };
          const idemKey = act?.idempotency_key || planIdem || `ui.create.${workspace}.${Date.now()}.${i}`;
          const resp = await fetch(`${base}/breadcrumbs`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'Idempotency-Key': String(idemKey) },
            body: JSON.stringify(body),
            signal: timeout()
          });
          if (!resp.ok) throw new Error(await resp.text());
          const createdRes = await resp.json();
          console.log('[forge/apply] created:', createdRes?.id, body?.title);
          created.push(createdRes);
          break;
        }
        case 'create_instance_from_template': {
          // Minimal clone; in a future enhancement, fetch template to merge defaults
          const body = {
            schema_name: 'ui.instance.v1',
            title: `From Template ${act.template_id}`,
            tags: [workspace, 'ui:instance', `region:${act.region || 'content'}`],
            context: {
              component_ref: act?.overrides?.component_ref,
              props: act?.overrides?.props || {},
              bindings: act?.overrides?.bindings || {},
              created_from_template: act.template_id,
              order: act?.overrides?.order ?? 0
            }
          };
          const idemKey = act?.idempotency_key || planIdem || `ui.createFromTemplate.${workspace}.${Date.now()}.${i}`;
          const resp = await fetch(`${base}/breadcrumbs`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', 'Idempotency-Key': String(idemKey) },
            body: JSON.stringify(body),
            signal: timeout()
          });
          if (!resp.ok) throw new Error(await resp.text());
          const createdRes = await resp.json();
          console.log('[forge/apply] created from template:', createdRes?.id, body?.title);
          created.push(createdRes);
          break;
        }
        case 'update_instance': {
          const respGet = await fetch(`${base}/breadcrumbs/${act.id}`, { signal: timeout() });
          if (!respGet.ok) throw new Error(await respGet.text());
          const cur = await respGet.json();
          const resp = await fetch(`${base}/breadcrumbs/${act.id}`, {
            method: 'PATCH',
            headers: { 'content-type': 'application/json', 'If-Match': String(cur.version) },
            body: JSON.stringify({ context: { ...(cur.context || {}), ...(act.updates?.context || {}), props: { ...(cur?.context?.props || {}), ...(act.updates?.props || {}) }, bindings: { ...(cur?.context?.bindings || {}), ...(act.updates?.bindings || {}) } } }),
            signal: timeout()
          });
          if (!resp.ok) throw new Error(await resp.text());
          console.log('[forge/apply] updated:', act.id);
          updated.push({ id: act.id });
          break;
        }
        case 'delete_instance': {
          const resp = await fetch(`${base}/breadcrumbs/${act.id}`, { method: 'DELETE', signal: timeout() });
          if (!resp.ok) throw new Error(await resp.text());
          console.log('[forge/apply] deleted:', act.id);
          deleted.push({ id: act.id });
          break;
        }
        default:
          throw new Error(`Unsupported action: ${act?.type}`);
      }
    } catch (e: any) {
      console.error('[forge/apply] action error idx', i, e?.message || String(e));
      errors.push({ index: i, error: e?.message || String(e) });
    }
  }

  const result = {
    schema_name: 'ui.plan.result.v1',
    title: 'UI Plan Apply Result',
    tags,
    context: { ok: errors.length === 0, created, updated, deleted, errors }
  };

  return new Response(JSON.stringify(result), { status: 200, headers: { 'content-type': 'application/json' } });
}


