/**
 * Demo Page
 * Seeds a demo workspace with HeroUI components via breadcrumbs and renders them with UILoader.
 */

'use client';

import React, { useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';

// Client-only UILoader to avoid SSR issues
const UILoader = dynamic(
  () => import('@rcrt-builder/heroui-breadcrumbs/src/renderer/UILoader').then(m => m.UILoader),
  { 
    ssr: false,
    loading: () => <div className="p-4">Loading UI components...</div>
  }
);

const DEMO_WORKSPACE = 'workspace:demo';

export default function DemoPage() {
  const [isSeeding, setIsSeeding] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const client = useMemo(() => new RcrtClientEnhanced('/api/rcrt'), []);

  const ensureBreadcrumb = useCallback(async (body: any) => {
    // Check existence first to avoid 409 conflicts on repeated seeds
    const existing = await client.searchBreadcrumbs({ tag: DEMO_WORKSPACE, schema_name: body.schema_name });
    const match = existing.find((b: any) => b.title === body.title);
    if (match) return { id: match.id } as any;

    try {
      return await client.createBreadcrumb(body);
    } catch (e: any) {
      const msg = String(e?.message || e).toLowerCase();
      if (msg.includes('conflict') || msg.includes('duplicate')) {
        return { id: 'exists' } as any;
      }
      throw e;
    }
  }, [client]);

  const handleSeed = useCallback(async () => {
    setIsSeeding(true);
    setError(null);
    try {
      // Layout
      await ensureBreadcrumb({
        schema_name: 'ui.layout.v1',
        title: 'Demo Layout',
        tags: [DEMO_WORKSPACE, 'ui:layout'],
        context: {
          regions: ['top', 'content', 'right'],
          container: { className: 'min-h-screen flex flex-col bg-content' },
          regionStyles: {
            top: { className: 'border-b border-default bg-background p-3 flex items-center gap-3' },
            content: { className: 'flex-1 container mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6' },
            right: { className: 'w-full lg:w-80 p-3 border-l border-default' }
          }
        }
      });

      // Theme
      await ensureBreadcrumb({
        schema_name: 'ui.theme.v1',
        title: 'Demo Theme',
        tags: [DEMO_WORKSPACE, 'ui:theme'],
        context: {
          className: 'light',
          layout: { radius: 10 },
          colors: { primary: '#0072f5', secondary: '#7828c8', success: '#17c964' }
        }
      });

      // Inline CSS
      await ensureBreadcrumb({
        schema_name: 'ui.styles.v1',
        title: 'Demo Inline CSS',
        tags: [DEMO_WORKSPACE, 'ui:styles'],
        context: {
          css: '.container{max-width:1200px;} .demo-card{box-shadow:0 8px 24px rgba(0,0,0,0.15);}'
        }
      });

      // Instances (Navbar)
      await ensureBreadcrumb({
        schema_name: 'ui.instance.v1',
        title: 'Navbar: Demo',
        tags: [DEMO_WORKSPACE, 'ui:instance', 'region:top'],
        context: {
          component_ref: 'Navbar',
          props: { children: 'RCRT Demo', shouldHideOnScroll: false },
          order: 0
        }
      });

      // Instances (Content - Cards, Tabs, Buttons)
      await ensureBreadcrumb({
        schema_name: 'ui.instance.v1',
        title: 'Card: Welcome',
        tags: [DEMO_WORKSPACE, 'ui:instance', 'region:content'],
        context: {
          component_ref: 'Card',
          props: { className: 'demo-card p-6 col-span-2', children: 'Welcome to the RCRT Demo UI' },
          order: 1
        }
      });

      await ensureBreadcrumb({
        schema_name: 'ui.instance.v1',
        title: 'Tabs: Showcase',
        tags: [DEMO_WORKSPACE, 'ui:instance', 'region:content'],
        context: {
          component_ref: 'Tabs',
          props: {
            variant: 'solid',
            color: 'primary',
            className: 'p-2',
            // Using plain children text just to show component renders; complex nested children not supported via generic renderer yet
            children: 'Tabs Component'
          },
          order: 2
        }
      });

      await ensureBreadcrumb({
        schema_name: 'ui.instance.v1',
        title: 'Button: Primary',
        tags: [DEMO_WORKSPACE, 'ui:instance', 'region:content'],
        context: {
          component_ref: 'Button',
          props: { color: 'primary', size: 'md', children: 'Primary Button' },
          bindings: {
            onPress: {
              action: 'emit_breadcrumb',
              payload: {
                schema_name: 'ui.event.v1',
                title: 'Demo Button Pressed',
                tags: [DEMO_WORKSPACE, 'ui:event'],
                context: { message: 'Primary button pressed' }
              }
            }
          },
          order: 3
        }
      });

      await ensureBreadcrumb({
        schema_name: 'ui.instance.v1',
        title: 'Chip: Status',
        tags: [DEMO_WORKSPACE, 'ui:instance', 'region:right'],
        context: {
          component_ref: 'Chip',
          props: { color: 'success', variant: 'flat', children: 'Live' },
          order: 0
        }
      });

      await ensureBreadcrumb({
        schema_name: 'ui.instance.v1',
        title: 'Card: Info',
        tags: [DEMO_WORKSPACE, 'ui:instance', 'region:right'],
        context: {
          component_ref: 'Card',
          props: { className: 'p-4', children: 'This panel is rendered from breadcrumbs.' },
          order: 1
        }
      });

      setSeeded(true);
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setIsSeeding(false);
    }
  }, [ensureBreadcrumb]);

  return (
    <div className="flex flex-col min-h-screen">
      <div className="flex items-center gap-3 p-4 border-b border-default">
        <button
          onClick={handleSeed}
          disabled={isSeeding}
          className={`px-4 py-2 rounded-md text-white ${isSeeding ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'}`}
        >
          {isSeeding ? 'Seeding…' : seeded ? 'Re-seed Demo' : 'Seed Demo UI'}
        </button>
        <span className="text-sm opacity-75">Workspace: {DEMO_WORKSPACE}</span>
        {error && <span className="text-sm text-red-400">{error}</span>}
      </div>

      <div className="flex-1">
        {seeded ? (
          <UILoader workspace={DEMO_WORKSPACE} />
        ) : (
          <div className="p-6 text-sm opacity-80">Click "Seed Demo UI" to create breadcrumbs and render the demo.</div>
        )}
      </div>
    </div>
  );
}


