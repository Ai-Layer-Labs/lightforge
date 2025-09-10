'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';

const UILoader = dynamic(
  () => import('@rcrt-builder/heroui-breadcrumbs/src/renderer/UILoader').then(m => m.UILoader),
  { ssr: false }
);

const WORKSPACE = 'workspace:agentic-demo';

export default function AgenticDemoPage() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  // Fix: RcrtClientEnhanced expects up to 3 arguments, not 4
  const client = useMemo(
    () =>
      new RcrtClientEnhanced(
        '/api/rcrt',
        authToken ? 'jwt' : 'disabled',
        authToken || undefined
      ),
    [authToken]
  );
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);
  const [uiClient, setUiClient] = useState<RcrtClientEnhanced | null>(null);
  const applyClientRef = useRef<RcrtClientEnhanced | null>(null);
  const [showPanel, setShowPanel] = useState(false);
  const [planText, setPlanText] = useState<string>(() => JSON.stringify({
    schema_name: 'ui.plan.v1',
    title: 'Build chooser',
    tags: [WORKSPACE, 'ui:plan'],
    context: {
      actions: [
        { type: 'create_instance', region: 'content', instance: { component_ref: 'Card', props: { className: 'p-4', children: 'Pick a category' }, order: 0 } },
        { type: 'create_instance', region: 'content', instance: { component_ref: 'Button', props: { color: 'primary', children: 'Gaming' }, order: 1 } },
        { type: 'create_instance', region: 'content', instance: { component_ref: 'Button', props: { color: 'secondary', children: 'Ultrabook' }, order: 2 } }
      ]
    }
  }, null, 2));
  const [validation, setValidation] = useState<any | null>(null);
  const [applyResult, setApplyResult] = useState<any | null>(null);
  const [working, setWorking] = useState(false);

  // Fetch token on mount
  React.useEffect(() => {
    if (!authToken) {
      fetch('/api/auth/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })
        .then(res => res.json())
        .then(data => {
          if (data?.token) {
            setAuthToken(data.token);
          }
        })
        .catch(err => {
          console.error('Failed to fetch token:', err);
          setError('Failed to fetch authentication token');
        });
    }
  }, [authToken]);

  const post = useCallback(async (body: any, cli?: RcrtClientEnhanced) => {
    const c = cli || client;
    return c.createBreadcrumb(body).catch((e: any) => {
      const msg = String(e?.message || e).toLowerCase();
      if (msg.includes('conflict')) return { id: 'exists' } as any;
      throw e;
    });
  }, [client]);

  const ensure = useCallback(async (body: any, cli?: RcrtClientEnhanced) => {
    const c = cli || client;
    const list = await c.searchBreadcrumbs({ tag: WORKSPACE, schema_name: body.schema_name });
    const match = list.find((b: any) => b.title === body.title);
    if (match) return { id: match.id } as any;
    return post(body, c);
  }, [client, post]);

  const wipeInstances = useCallback(async (cli?: RcrtClientEnhanced) => {
    const c = cli || client;
    const list = await c.searchBreadcrumbs({ tag: WORKSPACE });
    const full = list.length ? await c.batchGet(list.map((i: any) => i.id), 'context') : [];
    for (const b of full) {
      const isInstance = b?.schema_name === 'ui.instance.v1' || (Array.isArray(b?.tags) && b.tags.includes('ui:instance'));
      const isState = b?.schema_name === 'ui.state.v1' || (Array.isArray(b?.tags) && b.tags.includes('ui:state'));
      if (isInstance || isState) {
        try { await c.deleteBreadcrumb(b.id); } catch {}
      }
    }
  }, [client]);

  const ensureLayout = useCallback(async (cli?: RcrtClientEnhanced) => {
    const c = cli || client;
    const list = await c.searchBreadcrumbs({ tag: WORKSPACE });
    const full = list.length ? await c.batchGet(list.map((i: any) => i.id), 'context') : [];
    const hasTag = (b: any, t: string) => Array.isArray(b?.tags) && b.tags.includes(t);
    const layout = full.find((f: any) => f?.schema_name === 'ui.layout.v1' || hasTag(f, 'ui:layout'));
    if (!layout) {
      await post({
        schema_name: 'ui.layout.v1',
        title: 'Agentic Demo Layout',
        tags: [WORKSPACE, 'ui:layout'],
        context: {
          regions: ['top', 'content', 'right'],
          container: { className: 'min-h-screen bg-content' },
          regionStyles: {
            top: { className: 'border-b p-3' },
            content: { className: 'container mx-auto p-6 grid grid-cols-1 gap-6' },
            right: { className: 'w-full lg:w-96 p-3 border-l' }
          }
        }
      }, c);
    }
  }, [client, post]);

  const seedInitial = useCallback(async (cli?: RcrtClientEnhanced) => {
    const c = cli || client;
    await ensureLayout(c);
    // Top bar
    await ensure({
      schema_name: 'ui.instance.v1',
      title: 'Navbar: Agentic',
      tags: [WORKSPACE, 'ui:instance', 'region:top'],
      context: { component_ref: 'Navbar', props: { className: 'z-10', children: 'Agentic Demo' }, order: 0 }
    }, c);
    // Right helper card
    await ensure({
      schema_name: 'ui.instance.v1',
      title: 'Helper',
      tags: [WORKSPACE, 'ui:instance', 'region:right'],
      context: { component_ref: 'Card', props: { className: 'p-4', children: 'Pick a category below. The UI will update live.' }, order: 0 }
    }, c);
    // Shortlist Panel (state pointer)
    await ensure({
      schema_name: 'ui.instance.v1',
      title: 'Shortlist Panel',
      tags: [WORKSPACE, 'ui:instance', 'region:right'],
      context: { component_ref: 'Card', props: { className: 'p-4', state_tag: 'ui:state;component:shortlist', state_prop: 'children' }, order: 10 }
    }, c);
    // Chooser header
    await ensure({
      schema_name: 'ui.instance.v1',
      title: 'Chooser Header',
      tags: [WORKSPACE, 'ui:instance', 'region:content'],
      context: { component_ref: 'Card', props: { className: 'p-2 opacity-80', children: 'Pick a category' }, order: 0 }
    }, c);
    // Seed a results card
    await ensure({
      schema_name: 'ui.instance.v1',
      title: 'Card: Results',
      tags: [WORKSPACE, 'ui:instance', 'region:content'],
      context: { component_ref: 'Card', props: { className: 'p-4', children: 'Results will appear here…' }, order: 3 }
    }, c);
    // Seed category chooser buttons with bindings that emit ui.event.v1
    await ensure({
      schema_name: 'ui.instance.v1',
      title: 'Button: Gaming',
      tags: [WORKSPACE, 'ui:instance', 'region:content'],
      context: {
        component_ref: 'Button',
        props: { color: 'primary', children: 'Gaming' },
        bindings: { onPress: { action: 'emit_breadcrumb', payload: { schema_name: 'ui.event.v1', title: 'Category Chosen', tags: [WORKSPACE, 'ui:event'], context: { category: 'gaming' } } } },
        order: 1
      }
    }, c);
    await ensure({
      schema_name: 'ui.instance.v1',
      title: 'Button: Ultrabook',
      tags: [WORKSPACE, 'ui:instance', 'region:content'],
      context: {
        component_ref: 'Button',
        props: { color: 'secondary', children: 'Ultrabook' },
        bindings: { onPress: { action: 'emit_breadcrumb', payload: { schema_name: 'ui.event.v1', title: 'Category Chosen', tags: [WORKSPACE, 'ui:event'], context: { category: 'ultrabook' } } } },
        order: 2
      }
    }, c);
  }, [client, ensureLayout, post]);

  const handleSeed = useCallback(async () => {
    setIsBusy(true);
    setError(null);
    try {
      // Wait for auth token to be available
      if (!authToken) {
        setError('Waiting for authentication...');
        return;
      }
      
      // Use the existing client which already has the token
      setUiClient(client);
      applyClientRef.current = new RcrtClientEnhanced('/api', 'jwt', authToken);
      
      await wipeInstances(client);
      await seedInitial(client);
      setSeeded(true);
      if (process.env.NODE_ENV !== 'production') {
        console.log('[seed] workspace:', WORKSPACE);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setIsBusy(false);
    }
  }, [seedInitial, wipeInstances, client, authToken]);

  // Orchestrator: listen for ui.event.v1 in this workspace and react per walkthrough
  React.useEffect(() => {
    if (!seeded || !authToken) return;
    const stop = (client as any).startEventStream(
      async (evt: any) => {
        try {
          const data: any = (evt && (evt as any).data) || evt;
          const type: string | undefined = (data && data.type) || ((evt as any)?.type as any);
          // Server publishes 'breadcrumb.updated' on create; accept both
          if (type !== 'breadcrumb.created' && type !== 'breadcrumb.updated') return;

          let schema: string | undefined = data?.schema_name;
          const bId: string | undefined = data?.breadcrumb_id;
          if (!schema && bId) {
            try { const brief = await client.getBreadcrumb(bId); schema = brief?.schema_name; } catch {}
          }
          if (schema !== 'ui.event.v1') return;

          const ctx = (data?.context || {}) as any;
          const eventName = ctx?.event_name;
          const ev = (ctx?.event_data || {}) as any;
          const category = (ctx?.category as string | undefined) || (ev?.category as string | undefined);

          if (eventName === 'onPress' && (category === 'gaming' || category === 'ultrabook')) {
            const actions: any[] = [];
            const list1 = await client.searchBreadcrumbs({ tag: WORKSPACE });
            const ctxs1 = list1.length ? await client.batchGet(list1.map((i: any) => i.id), 'context') : [];
            const placeholder = ctxs1.find((b: any) => (b?.context?.component_ref === 'Card') && String(b?.title || '').toLowerCase().includes('results'));
            if (placeholder) {
              actions.push({ type: 'update_instance', id: placeholder.id, updates: { props: { children: '' } } });
            }
            const results = category === 'gaming'
              ? [
                  { title: 'Acer Nitro X – $1099', image: 'https://picsum.photos/seed/acer/400/200' },
                  { title: 'Lenovo Legion Lite – $1199', image: 'https://picsum.photos/seed/legion/400/200' }
                ]
              : [
                  { title: 'ASUS ZenBook Air – $1150', image: 'https://picsum.photos/seed/asus/400/200' },
                  { title: 'HP Spectre Slim – $1190', image: 'https://picsum.photos/seed/hp/400/200' }
                ];
            for (const r of results) {
              actions.push({ type: 'create_instance', region: 'content', instance: { component_ref: 'Card', props: { className: 'p-4', children: r.title } } });
              actions.push({ type: 'create_instance', region: 'content', instance: { component_ref: 'Image', props: { src: r.image, alt: r.title, width: 400, height: 200 } } });
              actions.push({ type: 'create_instance', region: 'content', instance: { component_ref: 'Button', props: { variant: 'flat', children: 'Details' }, bindings: { onPress: { action: 'emit_breadcrumb', payload: { schema_name: 'ui.event.v1', title: 'Details Clicked', tags: [WORKSPACE, 'ui:event'], context: { product: r.title.toLowerCase().split(' ')[0] } } } } } });
            }
            const plan = { schema_name: 'ui.plan.v1', title: 'Render results', tags: [WORKSPACE, 'ui:plan'], context: { actions } };
            if (process.env.NODE_ENV !== 'production') {
              console.log('[orchestrator] applying plan:', plan);
            }
            try {
              const json = await (applyClientRef.current as any)?.applyPlan(plan);
              console.log('[orchestrator] apply ok:', json?.context);
            } catch (e: any) {
              console.error('[orchestrator] apply failed:', e?.message || String(e));
            }
          }

          if (eventName === 'onPress' && (ctx?.title === 'Details Clicked' || ev?.product)) {
            const productId = ev?.product || 'item';
            const actions: any[] = [];
            actions.push({ type: 'create_instance', region: 'content', instance: { component_ref: 'Drawer', props: {} } });
            actions.push({ type: 'create_instance', region: 'content', instance: { component_ref: 'Card', props: { className: 'p-4', children: `Specs for ${productId} (demo)` } } });
            const plan = { schema_name: 'ui.plan.v1', title: 'Show details', tags: [WORKSPACE, 'ui:plan'], context: { actions } };
            try {
              await (applyClientRef.current as any)?.applyPlan(plan);
            } catch (e: any) {
              console.error('[orchestrator] details apply failed:', e?.message || String(e));
            }
            await post({ schema_name: 'ui.state.v1', title: `Shortlist: ${productId}`, tags: [WORKSPACE, 'ui:state', 'component:shortlist'], context: { value: `• ${productId}` } });
          }
        } catch (err) {
          // ignore
        }
      },
      { filters: { any_tags: [WORKSPACE] }, token: authToken || undefined } as any
    );
    return () => { try { stop(); } catch {} };
  }, [client, seeded, authToken]);

  return (
    <div className="min-h-screen bg-content">
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={handleSeed}
            disabled={isBusy || !authToken}
            className={`px-4 py-2 rounded-md text-white ${isBusy ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {isBusy ? 'Seeding…' : !authToken ? 'Token pending...' : 'Seed Agentic Demo'}
          </button>
          <span className="text-sm opacity-75">Workspace: {WORKSPACE}</span>
          {error && <span className="text-sm text-red-400">{error}</span>}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {seeded ? (
            <>
              <div>
                <UILoader workspace={WORKSPACE} rcrtClient={uiClient || client} />
              </div>
              <div>
                <div className="border border-default rounded-lg overflow-hidden">
                  <div className="px-3 py-2 text-sm opacity-80">Plan Panel</div>
                  <textarea className="w-full h-64 p-3 text-sm bg-background border-t border-default outline-none"
                    value={planText} onChange={(e) => setPlanText(e.target.value)} />
                  <div className="p-3 flex gap-2">
                    <button
                      className="text-sm px-3 py-1.5 rounded bg-sky-600 text-white disabled:opacity-50"
                      disabled={working}
                      onClick={async () => {
                        setWorking(true); setValidation(null); setApplyResult(null);
                        try {
                          try { JSON.parse(planText); } catch { setValidation({ context: { ok: false, errors: [{ code: 'INVALID_JSON', path: 'body', message: 'Plan is not valid JSON' }] } }); return; }
                          const resp = await fetch('/api/forge/validate', { method: 'POST', headers: { 'content-type': 'application/json' }, body: planText });
                          const json = await resp.json().catch(() => ({}));
                          setValidation(json);
                        } finally { setWorking(false); }
                      }}
                    >Validate</button>
                    <button
                      className="text-sm px-3 py-1.5 rounded bg-emerald-600 text-white disabled:opacity-50"
                      disabled={working || validation?.context?.ok !== true}
                      onClick={async () => {
                        setWorking(true); setApplyResult(null);
                        try {
                          const resp = await fetch('/api/forge/apply', { method: 'POST', headers: { 'content-type': 'application/json' }, body: planText });
                          const json = await resp.json().catch(() => ({}));
                          setApplyResult(json);
                        } finally { setWorking(false); }
                      }}
                    >Apply</button>
                  </div>
                  <div className="px-3 pb-3 text-xs space-y-2">
                    {validation && <div>Validation: {validation?.context?.ok ? 'ok' : 'failed'}</div>}
                    {applyResult && <div>Applied: {applyResult?.context?.ok ? 'ok' : 'errors'}</div>}
                  </div>
                </div>
              </div>
            </>
          ) : (
            <div className="text-sm opacity-80">Click seed to create layout and starter components, then live updates will stream via SSE.</div>
          )}
        </div>
      </div>
    </div>
  );
}


