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
  const client = useMemo(() => new RcrtClientEnhanced('/api/rcrt'), []);
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [seeded, setSeeded] = useState(false);
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

  const post = useCallback(async (body: any) => {
    return client.createBreadcrumb(body).catch((e: any) => {
      const msg = String(e?.message || e).toLowerCase();
      if (msg.includes('conflict')) return { id: 'exists' } as any;
      throw e;
    });
  }, [client]);

  const ensure = useCallback(async (body: any) => {
    const list = await client.searchBreadcrumbs({ tag: WORKSPACE, schema_name: body.schema_name });
    const match = list.find((b: any) => b.title === body.title);
    if (match) return { id: match.id } as any;
    return post(body);
  }, [client, post]);

  const wipeInstances = useCallback(async () => {
    const list = await client.searchBreadcrumbs({ tag: WORKSPACE });
    const full = list.length ? await client.batchGet(list.map((i: any) => i.id), 'full') : [];
    for (const b of full) {
      const isInstance = b?.schema_name === 'ui.instance.v1' || (Array.isArray(b?.tags) && b.tags.includes('ui:instance'));
      const isState = b?.schema_name === 'ui.state.v1' || (Array.isArray(b?.tags) && b.tags.includes('ui:state'));
      if (isInstance || isState) {
        try { await client.deleteBreadcrumb(b.id); } catch {}
      }
    }
  }, [client]);

  const ensureLayout = useCallback(async () => {
    const list = await client.searchBreadcrumbs({ tag: WORKSPACE });
    const full = list.length ? await client.batchGet(list.map((i: any) => i.id), 'full') : [];
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
      });
    }
  }, [client, post]);

  const seedInitial = useCallback(async () => {
    await ensureLayout();
    // Top bar
    await ensure({
      schema_name: 'ui.instance.v1',
      title: 'Navbar: Agentic',
      tags: [WORKSPACE, 'ui:instance', 'region:top'],
      context: { component_ref: 'Navbar', props: { className: 'z-10', children: 'Agentic Demo' }, order: 0 }
    });
    // Right helper card
    await ensure({
      schema_name: 'ui.instance.v1',
      title: 'Helper',
      tags: [WORKSPACE, 'ui:instance', 'region:right'],
      context: { component_ref: 'Card', props: { className: 'p-4', children: 'Pick a category below. The UI will update live.' }, order: 0 }
    });
    // Shortlist Panel (state pointer)
    await ensure({
      schema_name: 'ui.instance.v1',
      title: 'Shortlist Panel',
      tags: [WORKSPACE, 'ui:instance', 'region:right'],
      context: { component_ref: 'Card', props: { className: 'p-4', state_tag: 'ui:state;component:shortlist', state_prop: 'children' }, order: 10 }
    });
    // Chooser header
    await ensure({
      schema_name: 'ui.instance.v1',
      title: 'Chooser Header',
      tags: [WORKSPACE, 'ui:instance', 'region:content'],
      context: { component_ref: 'Card', props: { className: 'p-2 opacity-80', children: 'Pick a category' }, order: 0 }
    });
    // Seed a results card
    await ensure({
      schema_name: 'ui.instance.v1',
      title: 'Card: Results',
      tags: [WORKSPACE, 'ui:instance', 'region:content'],
      context: { component_ref: 'Card', props: { className: 'p-4', children: 'Results will appear here…' }, order: 3 }
    });
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
    });
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
    });
  }, [ensureLayout, post]);

  const handleSeed = useCallback(async () => {
    setIsBusy(true);
    setError(null);
    try {
      await wipeInstances();
      await seedInitial();
      setSeeded(true);
      if (process.env.NODE_ENV !== 'production') {
        console.log('[seed] workspace:', WORKSPACE);
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setIsBusy(false);
    }
  }, [seedInitial, wipeInstances]);

  // Orchestrator: listen for ui.event.v1 in this workspace and react per walkthrough
  React.useEffect(() => {
    if (!seeded) return;
    const stop = client.startEventStream(
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
            const list = await client.searchBreadcrumbs({ tag: WORKSPACE });
            const full = list.length ? await client.batchGet(list.map((i: any) => i.id), 'full') : [];
            const placeholder = full.find((b: any) => (b?.context?.component_ref === 'Card') && String(b?.title || '').toLowerCase().includes('results'));
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
            const resp = await fetch('/api/forge/apply', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(plan) });
            if (!resp.ok) {
              const text = await resp.text();
              console.error('[orchestrator] apply failed:', resp.status, text);
            } else {
              const json = await resp.json().catch(() => ({}));
              console.log('[orchestrator] apply ok:', json?.context);
            }
          }

          if (eventName === 'onPress' && (ctx?.title === 'Details Clicked' || ev?.product)) {
            const productId = ev?.product || 'item';
            const actions: any[] = [];
            actions.push({ type: 'create_instance', region: 'content', instance: { component_ref: 'Drawer', props: {} } });
            actions.push({ type: 'create_instance', region: 'content', instance: { component_ref: 'Card', props: { className: 'p-4', children: `Specs for ${productId} (demo)` } } });
            const plan = { schema_name: 'ui.plan.v1', title: 'Show details', tags: [WORKSPACE, 'ui:plan'], context: { actions } };
            const resp = await fetch('/api/forge/apply', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(plan) });
            if (!resp.ok) {
              const text = await resp.text();
              console.error('[orchestrator] details apply failed:', resp.status, text);
            }
            await post({ schema_name: 'ui.state.v1', title: `Shortlist: ${productId}`, tags: [WORKSPACE, 'ui:state', 'component:shortlist'], context: { value: `• ${productId}` } });
          }
        } catch (err) {
          // ignore
        }
      },
      { filters: { any_tags: [WORKSPACE] } }
    );
    return () => { try { stop(); } catch {} };
  }, [client, seeded]);

  return (
    <div className="min-h-screen bg-content">
      <div className="container mx-auto p-6">
        <div className="flex items-center gap-3 mb-4">
          <button
            onClick={handleSeed}
            disabled={isBusy}
            className={`px-4 py-2 rounded-md text-white ${isBusy ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
          >
            {isBusy ? 'Seeding…' : 'Seed Agentic Demo'}
          </button>
          <span className="text-sm opacity-75">Workspace: {WORKSPACE}</span>
          {error && <span className="text-sm text-red-400">{error}</span>}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {seeded ? (
            <>
              <div>
                <UILoader workspace={WORKSPACE} />
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


