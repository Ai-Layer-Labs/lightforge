/**
 * UI Loader
 * Reads HeroUI component instances stored as breadcrumbs and renders them.
 */
'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
  useEffect(() => {
    if (!client) return;
    const load = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const list = await client.searchBreadcrumbs({ tag: workspace });
        const full = await client.batchGet(list.map((i: any) => i.id), 'full');
        console.debug('[UILoader] breadcrumbs found:', full.length);
        const hasTag = (b: any, t: string) => Array.isArray(b?.tags) && b.tags.includes(t);
        const layoutBc = full.find((f: any) => f?.schema_name === 'ui.layout.v1' || hasTag(f, 'ui:layout')) || null;
        console.debug('[UILoader] layout found:', layoutBc?.title, layoutBc?.context?.regions);
        setLayout(layoutBc);
        const themeBc = full.find((f: any) => f?.schema_name === 'ui.theme.v1' || hasTag(f, 'ui:theme')) || null;
        console.debug('[UILoader] theme found:', themeBc?.title);
        setTheme(themeBc?.context || null);
        const stylesBc = full.find((f: any) => f?.schema_name === 'ui.styles.v1' || hasTag(f, 'ui:styles')) || null;
        console.debug('[UILoader] styles found:', stylesBc?.title);
        setInlineCSS(stylesBc?.context?.css || null);
        const instances = full.filter((f: any) => f?.schema_name === 'ui.instance.v1' || hasTag(f, 'ui:instance'));
        console.debug('[UILoader] instances found:', instances.length, instances.map((i: any) => ({ title: i.title, tags: i.tags })));
        instances.sort((a: any, b: any) => {
          const ao = a.context?.order ?? 0;
          const bo = b.context?.order ?? 0;
          if (ao !== bo) return ao - bo;
          return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        });
        setInstances(instances);
      } catch (e: any) {
        console.error('[UILoader] failed to load UI:', e);
        setError(e?.message || String(e));
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [client, workspace, selector]);

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


