/**
 * UI Loader
 * Reads HeroUI component instances stored as breadcrumbs and renders them.
 */
'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';
import { HeroUIProvider } from '@heroui/react';
import { ComponentRenderer } from './ComponentRenderer';
import { registerHeroUIComponents } from '../registry/registerComponents';

interface UILoaderProps {
  workspace: string;
  rcrtClient?: RcrtClientEnhanced;
  rcrtUrl?: string;
  selector?: any; // Additional search params (e.g., tags)
  className?: string;
  onEvent?: (eventName: string, data: any) => void;
}

export const UILoader: React.FC<UILoaderProps> = ({
  workspace,
  rcrtClient,
  rcrtUrl,
  selector,
  className,
  onEvent
}) => {
  const [instances, setInstances] = useState<any[]>([]);
  const [client, setClient] = useState<RcrtClientEnhanced | null>(null);
  const [layout, setLayout] = useState<any | null>(null);
  const [theme, setTheme] = useState<any | null>(null);
  const [inlineCSS, setInlineCSS] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [allRecords, setAllRecords] = useState<any[]>([]);
  const stopStreamRef = useRef<(() => void) | null>(null);

  // Ensure HeroUI components are registered once
  useEffect(() => {
    registerHeroUIComponents();
  }, []);

  // Initialize client
  useEffect(() => {
    if (rcrtClient) {
      setClient(rcrtClient);
      return;
    }
    const isBrowser = typeof window !== 'undefined';
    const url = isBrowser ? '/api/rcrt' : (rcrtUrl || (process.env.NEXT_PUBLIC_RCRT_URL as string) || 'http://localhost:8081');
    setClient(new RcrtClientEnhanced(url));
  }, [rcrtClient, rcrtUrl]);

  // Load layout, theme, optional inline CSS, and UI instances (summary → full)
  const load = useCallback(async () => {
    if (!client) return;
    setIsLoading(true);
    setError(null);
    try {
      const list = await client.searchBreadcrumbs({ tag: workspace });
      const full = await client.batchGet(list.map((i: any) => i.id), 'full');
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[UILoader] breadcrumbs found:', full.length);
      }
      const hasTag = (b: any, t: string) => Array.isArray(b?.tags) && b.tags.includes(t);
      const layoutBc = full.find((f: any) => f?.schema_name === 'ui.layout.v1' || hasTag(f, 'ui:layout')) || null;
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[UILoader] layout found:', layoutBc?.title, layoutBc?.context?.regions);
      }
      setLayout(layoutBc);
      const themeBc = full.find((f: any) => f?.schema_name === 'ui.theme.v1' || hasTag(f, 'ui:theme')) || null;
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[UILoader] theme found:', themeBc?.title);
      }
      setTheme(themeBc?.context || null);
      const stylesBc = full.find((f: any) => f?.schema_name === 'ui.styles.v1' || hasTag(f, 'ui:styles')) || null;
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[UILoader] styles found:', stylesBc?.title);
      }
      setInlineCSS(stylesBc?.context?.css || null);
      const instances = full.filter((f: any) => f?.schema_name === 'ui.instance.v1' || hasTag(f, 'ui:instance'));
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[UILoader] instances found:', instances.length, instances.map((i: any) => ({ title: i.title, tags: i.tags })));
      }
      instances.sort((a: any, b: any) => {
        const ao = a.context?.order ?? 0;
        const bo = b.context?.order ?? 0;
        if (ao !== bo) return ao - bo;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      });
      setInstances(instances);
      setAllRecords(full);
    } catch (e: any) {
      if (process.env.NODE_ENV !== 'production') {
        console.error('[UILoader] failed to load UI:', e);
      }
      setError(e?.message || String(e));
    } finally {
      setIsLoading(false);
    }
  }, [client, workspace]);

  useEffect(() => {
    if (!client) return;
    load();
  }, [client, workspace, selector, load]);

  // Subscribe to workspace-level SSE and refresh on relevant events
  useEffect(() => {
    if (!client) return;
    // Cleanup previous stream if any
    if (stopStreamRef.current) {
      try { stopStreamRef.current(); } catch {}
      stopStreamRef.current = null;
    }
    const stop = client.startEventStream(
      async (evt: any) => {
        try {
          const t = String(evt?.type || '').toLowerCase();
          if (!t) return;
          if (t.includes('breadcrumb.created') || t.includes('breadcrumb.updated') || t.includes('breadcrumb.deleted')) {
            // Avoid reloading on transient ui.event.v1 events to reduce flicker
            const bid = (evt as any)?.breadcrumb_id || (evt as any)?.id;
            if (bid) {
              try {
                const brief = await client.getBreadcrumb(bid);
                if (brief?.schema_name === 'ui.event.v1') {
                  return;
                }
              } catch {
                // If we can't fetch, fall back to reload
              }
            }
            await load();
          }
        } catch {}
      },
      { filters: { any_tags: [workspace] } }
    );
    stopStreamRef.current = stop;
    return () => {
      try { stop(); } catch {}
      stopStreamRef.current = null;
    };
  }, [client, workspace, load]);

  if (!client) return null;

  if (isLoading) {
    return (
      <div className={className || ''} style={{ padding: 16 }}>Loading UI…</div>
    );
  }

  if (error) {
    return (
      <div className={className || ''} style={{ padding: 16, color: '#f87171' }}>
        Error loading UI: {error}
      </div>
    );
  }

  // Region-aware rendering using simple regions in layout.context.regions
  const LayoutContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const containerClass = layout?.context?.container?.className || '';
    const userStyle = (layout?.context?.container?.style || {}) as React.CSSProperties;
    const containerStyle: React.CSSProperties = {
      color: (userStyle as any).color ?? '#ffffff',
      ...userStyle,
    };
    return <div className={`${className || ''} ${containerClass}`.trim()} style={containerStyle}>{children}</div>;
  };

  const Region: React.FC<{ name: string }> = ({ name }) => {
    const regionClass = layout?.context?.regionStyles?.[name]?.className || '';
    const regionStyle = layout?.context?.regionStyles?.[name]?.style || {};
    const regionItems = instances.filter((bc) => bc.tags?.includes(`region:${name}`));
    console.debug(`[Region ${name}] items:`, regionItems.length, regionItems.map((i: any) => i.title));
    if (regionItems.length === 0) {
      return (
        <div data-region={name} className={regionClass} style={regionStyle}>
          <div style={{ padding: 12, opacity: 0.8, color: '#ffffff' }}>No components in region "{name}".</div>
        </div>
      );
    }
    return (
      <div data-region={name} className={regionClass} style={regionStyle}>
        {regionItems
          .map((bc) => (
            <ComponentRenderer
              key={bc.id}
              breadcrumb={bc}
              rcrtClient={client!}
              workspace={workspace}
              onEvent={onEvent}
              subscribeUpdates={false}
              resolvePointer={(tagString: string, preferredSchema?: string) => {
                const tokens = String(tagString || '')
                  .split(';')
                  .map((t) => t.trim())
                  .filter(Boolean);
                if (tokens.length === 0) return undefined as any;
                const candidates = allRecords.filter((rec) => Array.isArray(rec?.tags) && tokens.every((t) => rec.tags.includes(t)));
                if (preferredSchema) {
                  const hit = candidates.find((r) => r?.schema_name === preferredSchema);
                  if (hit) return hit;
                }
                return candidates[0];
              }}
            />
          ))}
      </div>
    );
  };

  const AppShell: React.FC = () => {
    const regions = (layout?.context?.regions as string[]) || [];
    if (!layout || regions.length === 0) {
      return (
        <LayoutContainer>
          <div style={{ padding: 16, opacity: 0.9, color: '#f87171' }}>
            Missing required layout breadcrumb (schema_name: "ui.layout.v1") for workspace "{workspace}".
          </div>
        </LayoutContainer>
      );
    }
    return (
      <LayoutContainer>
        {regions.map((region) => (
          <Region key={region} name={region} />
        ))}
      </LayoutContainer>
    );
  };

  // Inject inline CSS once
  const StyleTag = inlineCSS ? <style id="rcrt-inline-css">{inlineCSS}</style> : null;

  // Wrap with HeroUIProvider using theme if present
  if (theme) {
    return (
      <HeroUIProvider theme={theme}>
        {StyleTag}
        <AppShell />
      </HeroUIProvider>
    );
  }
  return (
    <>
      {StyleTag}
      <AppShell />
    </>
  );
};


