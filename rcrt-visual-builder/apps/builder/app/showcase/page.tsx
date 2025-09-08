/**
 * HeroUI Components Showcase
 * Demonstrates the full range of HeroUI components available through UI Forge
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

const SHOWCASE_WORKSPACE = 'workspace:showcase';

export default function ShowcasePage() {
  const [isSeeding, setIsSeeding] = useState(false);
  const [seeded, setSeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const client = useMemo(() => new RcrtClientEnhanced('/api/rcrt'), []);

  const ensureBreadcrumb = useCallback(async (body: any) => {
    const existing = await client.searchBreadcrumbs({ 
      tag: SHOWCASE_WORKSPACE, 
      schema_name: body.schema_name 
    });
    const match = existing.find((b: any) => b.title === body.title);
    if (match) return { id: match.id };

    try {
      return await client.createBreadcrumb(body);
    } catch (e: any) {
      const msg = String(e?.message || e).toLowerCase();
      if (msg.includes('conflict') || msg.includes('duplicate')) {
        return { id: 'exists' };
      }
      throw e;
    }
  }, [client]);

  const handleSeed = useCallback(async () => {
    setIsSeeding(true);
    setError(null);
    try {
      // Layout with multiple regions for component categories
      await ensureBreadcrumb({
        schema_name: 'ui.layout.v1',
        title: 'Showcase Layout',
        tags: [SHOWCASE_WORKSPACE, 'ui:layout'],
        context: {
          regions: ['header', 'hero', 'forms', 'display', 'feedback', 'navigation', 'overlays', 'data'],
          container: { className: 'min-h-screen bg-gradient-to-br from-background to-content1' },
          regionStyles: {
            header: { className: 'sticky top-0 z-50 backdrop-blur-lg border-b border-divider' },
            hero: { className: 'container mx-auto px-6 py-12 text-center' },
            forms: { className: 'container mx-auto px-6 py-8' },
            display: { className: 'container mx-auto px-6 py-8 bg-content2/50' },
            feedback: { className: 'container mx-auto px-6 py-8' },
            navigation: { className: 'container mx-auto px-6 py-8 bg-content2/50' },
            overlays: { className: 'container mx-auto px-6 py-8' },
            data: { className: 'container mx-auto px-6 py-8 bg-content2/50' }
          }
        }
      });

      // Theme with modern design
      await ensureBreadcrumb({
        schema_name: 'ui.theme.v1',
        title: 'Showcase Theme',
        tags: [SHOWCASE_WORKSPACE, 'ui:theme'],
        context: {
          className: 'light',
          layout: { 
            radius: 'lg',
            borderWidth: 'small'
          },
          colors: { 
            primary: '#006FEE',
            secondary: '#9333ea',
            success: '#17c964',
            warning: '#f5a524',
            danger: '#f31260'
          }
        }
      });

      // Custom styles
      await ensureBreadcrumb({
        schema_name: 'ui.styles.v1',
        title: 'Showcase Styles',
        tags: [SHOWCASE_WORKSPACE, 'ui:styles'],
        context: {
          css: `
            .showcase-section { margin-bottom: 3rem; }
            .showcase-title { font-size: 2rem; font-weight: 700; margin-bottom: 1.5rem; }
            .showcase-grid { display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); }
            .showcase-item { padding: 1rem; border-radius: 0.75rem; background: var(--heroui-content1); }
          `
        }
      });

      // Header with Navbar
      await ensureBreadcrumb({
        schema_name: 'ui.instance.v1',
        title: 'Navbar: Showcase',
        tags: [SHOWCASE_WORKSPACE, 'ui:instance', 'region:header'],
        context: {
          component_ref: 'Navbar',
          props: { 
            children: 'HeroUI Components Showcase',
            isBordered: true,
            maxWidth: 'full'
          },
          order: 0
        }
      });

      // Hero Section
      await ensureBreadcrumb({
        schema_name: 'ui.instance.v1',
        title: 'Hero Title',
        tags: [SHOWCASE_WORKSPACE, 'ui:instance', 'region:hero'],
        context: {
          component_ref: 'Card',
          props: { 
            className: 'showcase-title text-4xl font-bold bg-transparent shadow-none',
            children: '🎨 HeroUI Component Gallery'
          },
          order: 0
        }
      });

      await ensureBreadcrumb({
        schema_name: 'ui.instance.v1',
        title: 'Hero Subtitle',
        tags: [SHOWCASE_WORKSPACE, 'ui:instance', 'region:hero'],
        context: {
          component_ref: 'Chip',
          props: { 
            color: 'primary',
            variant: 'flat',
            size: 'lg',
            children: '210+ Beautiful Components'
          },
          order: 1
        }
      });

      // Forms Section
      await ensureBreadcrumb({
        schema_name: 'ui.instance.v1',
        title: 'Forms Title',
        tags: [SHOWCASE_WORKSPACE, 'ui:instance', 'region:forms'],
        context: {
          component_ref: 'Divider',
          props: { className: 'my-4' },
          order: 0
        }
      });

      await ensureBreadcrumb({
        schema_name: 'ui.instance.v1',
        title: 'Input Demo',
        tags: [SHOWCASE_WORKSPACE, 'ui:instance', 'region:forms'],
        context: {
          component_ref: 'Input',
          props: { 
            label: 'Email',
            placeholder: 'Enter your email',
            variant: 'bordered',
            color: 'primary',
            className: 'max-w-xs'
          },
          order: 1
        }
      });

      await ensureBreadcrumb({
        schema_name: 'ui.instance.v1',
        title: 'Textarea Demo',
        tags: [SHOWCASE_WORKSPACE, 'ui:instance', 'region:forms'],
        context: {
          component_ref: 'Textarea',
          props: { 
            label: 'Description',
            placeholder: 'Enter your description',
            variant: 'faded',
            className: 'max-w-xs'
          },
          order: 2
        }
      });

      await ensureBreadcrumb({
        schema_name: 'ui.instance.v1',
        title: 'Switch Demo',
        tags: [SHOWCASE_WORKSPACE, 'ui:instance', 'region:forms'],
        context: {
          component_ref: 'Switch',
          props: { 
            defaultSelected: true,
            color: 'success',
            children: 'Enable notifications'
          },
          order: 3
        }
      });

      await ensureBreadcrumb({
        schema_name: 'ui.instance.v1',
        title: 'Slider Demo',
        tags: [SHOWCASE_WORKSPACE, 'ui:instance', 'region:forms'],
        context: {
          component_ref: 'Slider',
          props: { 
            label: 'Volume',
            step: 0.01,
            maxValue: 1,
            minValue: 0,
            defaultValue: 0.7,
            className: 'max-w-md'
          },
          order: 4
        }
      });

      // Display Section
      await ensureBreadcrumb({
        schema_name: 'ui.instance.v1',
        title: 'Avatar Demo',
        tags: [SHOWCASE_WORKSPACE, 'ui:instance', 'region:display'],
        context: {
          component_ref: 'Avatar',
          props: { 
            src: 'https://i.pravatar.cc/150?u=a042581f4e29026024d',
            size: 'lg',
            isBordered: true,
            color: 'primary'
          },
          order: 0
        }
      });

      await ensureBreadcrumb({
        schema_name: 'ui.instance.v1',
        title: 'Badge Demo',
        tags: [SHOWCASE_WORKSPACE, 'ui:instance', 'region:display'],
        context: {
          component_ref: 'Badge',
          props: { 
            content: '5',
            color: 'danger',
            shape: 'circle',
            children: 'Notifications'
          },
          order: 1
        }
      });

      await ensureBreadcrumb({
        schema_name: 'ui.instance.v1',
        title: 'Code Demo',
        tags: [SHOWCASE_WORKSPACE, 'ui:instance', 'region:display'],
        context: {
          component_ref: 'Code',
          props: { 
            color: 'primary',
            children: 'npm install @heroui/react'
          },
          order: 2
        }
      });

      await ensureBreadcrumb({
        schema_name: 'ui.instance.v1',
        title: 'Kbd Demo',
        tags: [SHOWCASE_WORKSPACE, 'ui:instance', 'region:display'],
        context: {
          component_ref: 'Kbd',
          props: { 
            children: 'Ctrl+K'
          },
          order: 3
        }
      });

      await ensureBreadcrumb({
        schema_name: 'ui.instance.v1',
        title: 'User Demo',
        tags: [SHOWCASE_WORKSPACE, 'ui:instance', 'region:display'],
        context: {
          component_ref: 'User',
          props: { 
            name: 'Jane Doe',
            description: 'Product Designer',
            avatarProps: {
              src: 'https://i.pravatar.cc/150?u=a04258114e29026702d'
            }
          },
          order: 4
        }
      });

      // Feedback Section
      await ensureBreadcrumb({
        schema_name: 'ui.instance.v1',
        title: 'Progress Demo',
        tags: [SHOWCASE_WORKSPACE, 'ui:instance', 'region:feedback'],
        context: {
          component_ref: 'Progress',
          props: { 
            value: 70,
            color: 'primary',
            showValueLabel: true,
            className: 'max-w-md'
          },
          order: 0
        }
      });

      await ensureBreadcrumb({
        schema_name: 'ui.instance.v1',
        title: 'CircularProgress Demo',
        tags: [SHOWCASE_WORKSPACE, 'ui:instance', 'region:feedback'],
        context: {
          component_ref: 'CircularProgress',
          props: { 
            value: 80,
            color: 'success',
            showValueLabel: true,
            size: 'lg'
          },
          order: 1
        }
      });

      await ensureBreadcrumb({
        schema_name: 'ui.instance.v1',
        title: 'Spinner Demo',
        tags: [SHOWCASE_WORKSPACE, 'ui:instance', 'region:feedback'],
        context: {
          component_ref: 'Spinner',
          props: { 
            color: 'warning',
            size: 'lg',
            label: 'Loading...'
          },
          order: 2
        }
      });

      await ensureBreadcrumb({
        schema_name: 'ui.instance.v1',
        title: 'Skeleton Demo',
        tags: [SHOWCASE_WORKSPACE, 'ui:instance', 'region:feedback'],
        context: {
          component_ref: 'Skeleton',
          props: { 
            className: 'rounded-lg',
            children: 'Loading content...'
          },
          order: 3
        }
      });

      // Navigation Section
      await ensureBreadcrumb({
        schema_name: 'ui.instance.v1',
        title: 'Pagination Demo',
        tags: [SHOWCASE_WORKSPACE, 'ui:instance', 'region:navigation'],
        context: {
          component_ref: 'Pagination',
          props: { 
            total: 10,
            initialPage: 1,
            color: 'primary',
            variant: 'flat'
          },
          order: 0
        }
      });

      await ensureBreadcrumb({
        schema_name: 'ui.instance.v1',
        title: 'Tabs Demo',
        tags: [SHOWCASE_WORKSPACE, 'ui:instance', 'region:navigation'],
        context: {
          component_ref: 'Tabs',
          props: { 
            color: 'primary',
            variant: 'underlined',
            children: 'Tab Navigation'
          },
          order: 1
        }
      });

      await ensureBreadcrumb({
        schema_name: 'ui.instance.v1',
        title: 'Link Demo',
        tags: [SHOWCASE_WORKSPACE, 'ui:instance', 'region:navigation'],
        context: {
          component_ref: 'Link',
          props: { 
            href: '#',
            color: 'secondary',
            underline: 'hover',
            children: 'Visit HeroUI Docs'
          },
          order: 2
        }
      });

      // Data Display Section
      await ensureBreadcrumb({
        schema_name: 'ui.instance.v1',
        title: 'Card Demo',
        tags: [SHOWCASE_WORKSPACE, 'ui:instance', 'region:data'],
        context: {
          component_ref: 'Card',
          props: { 
            className: 'p-6 max-w-md',
            isPressable: true,
            isHoverable: true,
            children: 'Interactive Card - Click me!'
          },
          order: 0
        }
      });

      await ensureBreadcrumb({
        schema_name: 'ui.instance.v1',
        title: 'Tooltip Demo',
        tags: [SHOWCASE_WORKSPACE, 'ui:instance', 'region:data'],
        context: {
          component_ref: 'Tooltip',
          props: { 
            content: 'This is a helpful tooltip',
            color: 'primary',
            children: 'Hover over me'
          },
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
      <div className="flex items-center justify-between p-4 border-b border-divider bg-background/60 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <button
            onClick={handleSeed}
            disabled={isSeeding}
            className={`px-6 py-2 rounded-lg font-medium text-white transition-all ${
              isSeeding 
                ? 'bg-default-400 cursor-not-allowed' 
                : 'bg-primary hover:bg-primary-600 shadow-lg hover:shadow-xl'
            }`}
          >
            {isSeeding ? 'Seeding…' : seeded ? 'Re-seed Showcase' : 'Seed HeroUI Showcase'}
          </button>
          <span className="text-sm opacity-75">Workspace: {SHOWCASE_WORKSPACE}</span>
        </div>
        {error && <span className="text-sm text-danger">{error}</span>}
      </div>

      <div className="flex-1">
        {seeded ? (
          <UILoader workspace={SHOWCASE_WORKSPACE} />
        ) : (
          <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
            <div className="text-4xl mb-4">🎨</div>
            <h2 className="text-2xl font-bold mb-2">HeroUI Components Showcase</h2>
            <p className="text-default-500 mb-6 text-center max-w-md">
              Experience the full range of HeroUI components dynamically rendered through the UI Forge system.
            </p>
            <button
              onClick={handleSeed}
              disabled={isSeeding}
              className="px-8 py-3 bg-primary text-white rounded-lg font-medium hover:bg-primary-600 transition-all shadow-lg hover:shadow-xl"
            >
              Get Started
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
