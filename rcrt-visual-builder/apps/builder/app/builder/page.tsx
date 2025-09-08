'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';
import { ComponentRegistry } from '@rcrt-builder/heroui-breadcrumbs/src/registry/ComponentRegistry';
import { registerHeroUIComponents } from '@rcrt-builder/heroui-breadcrumbs/src/registry/registerComponents';

const UILoader = dynamic(
  () => import('@rcrt-builder/heroui-breadcrumbs/src/renderer/UILoader').then(m => m.UILoader),
  { ssr: false }
);
const ComposedHeroUIDemos = dynamic(
  () => import('@rcrt-builder/heroui-breadcrumbs/src/custom/ComposedHeroUIDemos').then(m => m.ComposedHeroUIDemos),
  { ssr: false }
);

function getDefaultProps(name: string): any {
  switch (name) {
    case 'Button': return { color: 'primary', children: 'Button' };
    case 'Input': return { label: 'Label', placeholder: 'Type here' };
    case 'Card': return { className: 'p-4', children: 'Card content' };
    case 'Tabs': return { children: 'Tabs' };
    case 'Progress': return { value: 50, 'aria-label': 'Progress' } as any;
    case 'Chip': return { color: 'success', children: 'Chip' };
    case 'Avatar': return { name: 'A' } as any;
    case 'Select': return { label: 'Select', placeholder: 'Pick' };
    case 'Textarea': return { label: 'Message', placeholder: 'Enter text' };
    case 'Switch': return { defaultSelected: true };
    case 'Slider': return { defaultValue: 30, 'aria-label': 'Slider' } as any;
    case 'RadioGroup': return { label: 'Options' } as any;
    case 'NumberInput': return { label: 'Amount', defaultValue: 1 } as any;
    case 'Checkbox': return { children: 'Check me' };
    case 'Alert': return { title: 'Alert', color: 'warning' } as any;
    case 'Navbar': return { children: 'Navbar' } as any;
    case 'Breadcrumbs': return { 'aria-label': 'Breadcrumb', className: '' } as any;
    case 'Divider': return {};
    case 'Image': return { src: 'https://picsum.photos/400/200', alt: 'Placeholder', width: 400, height: 200 } as any;
    case 'Autocomplete': return { label: 'Autocomplete', placeholder: 'Type…' } as any;
    case 'DatePicker': return { label: 'Date Picker' } as any;
    case 'DateInput': return { label: 'Date' } as any;
    case 'DateRangePicker': return { label: 'Date Range' } as any;
    case 'TimeInput': return { label: 'Time' } as any;
    default: return { children: name } as any;
  }
}

const EXCLUDE = new Set<string>([
  'NavbarBrand','NavbarContent','NavbarItem','NavbarMenuToggle','NavbarMenu','NavbarMenuItem',
  'DropdownTrigger','DropdownMenu','DropdownItem','DropdownSection',
  'PopoverTrigger','PopoverContent', 'Popover',
  'Dropdown',
  'Drawer',
  'DrawerContent','DrawerHeader','DrawerBody','DrawerFooter',
  'AccordionItem','ListboxItem','ListboxSection','BreadcrumbItem',
  // Complex, slot-based or tree-required components that can't be rendered with flat props
  'Table',
  'Radio',
  'Modal'
]);

export default function BuilderPage() {
  const client = useMemo(() => new RcrtClientEnhanced('/api/rcrt'), []);
  const workspace = 'workspace:builder-gallery';
  const [seeded, setSeeded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const seed = useCallback(async () => {
    try {
      registerHeroUIComponents();
      const list = await client.searchBreadcrumbs({ tag: workspace });
      const full = list.length ? await client.batchGet(list.map((i: any) => i.id), 'full') : [];

      // Ensure layout exists
      const hasLayout = full.some((b: any) => b?.schema_name === 'ui.layout.v1' || (Array.isArray(b?.tags) && b.tags.includes('ui:layout')));
      if (!hasLayout) {
        await client.createBreadcrumb({
          schema_name: 'ui.layout.v1',
          title: 'Gallery Layout',
          tags: [workspace, 'ui:layout'],
          context: { regions: ['content'], container: { className: 'min-h-screen bg-content' }, regionStyles: { content: { className: 'container mx-auto p-6 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6' } } }
        });
      }

      // Remove or fix problematic existing instances (Divider children, excluded components)
      for (const b of full) {
        const isInstance = b?.schema_name === 'ui.instance.v1' || (Array.isArray(b?.tags) && b.tags.includes('ui:instance'));
        const name = b?.context?.component_ref as string | undefined;
        if (isInstance && name && EXCLUDE.has(name)) {
          await client.deleteBreadcrumb(b.id);
          continue;
        }
        if (isInstance && name === 'Divider') {
          await client.deleteBreadcrumb(b.id);
          continue;
        }
        if (isInstance && name === 'Image') {
          await client.deleteBreadcrumb(b.id);
          continue;
        }
      }

      // Build set of existing safe component instances
      const existingSafe = new Set<string>();
      for (const b of full) {
        const isInstance = b?.schema_name === 'ui.instance.v1' || (Array.isArray(b?.tags) && b.tags.includes('ui:instance'));
        const name = b?.context?.component_ref as string | undefined;
        if (isInstance && name && !EXCLUDE.has(name)) existingSafe.add(name);
      }

      const all = ComponentRegistry.getTypes().filter(t => !EXCLUDE.has(t));
      let order = 0;
      for (const name of all) {
        if (existingSafe.has(name)) continue;
        await client.createBreadcrumb({
          schema_name: 'ui.instance.v1',
          title: `${name} Demo`,
          tags: [workspace, 'ui:instance', 'region:content'],
          context: { component_ref: name, props: getDefaultProps(name), order: order++ }
        });
      }
      setSeeded(true);
    } catch (e: any) {
      setError(e?.message || String(e));
    }
  }, [client]);

  useEffect(() => { seed(); }, [seed]);

  if (error) {
    return <div className="p-6 text-red-500">{error}</div>;
  }

  return (
    <div className="min-h-screen bg-content">
      <div className="container mx-auto p-6">
        <h1 className="text-2xl font-semibold mb-4">HeroUI Component Gallery</h1>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <div>
            <h2 className="text-lg font-semibold mb-2">Composed Demos</h2>
            <ComposedHeroUIDemos />
          </div>
          <div>
            <h2 className="text-lg font-semibold mb-2">Instances via UILoader</h2>
            {!seeded ? <div className="text-sm opacity-80">Seeding gallery…</div> : <UILoader workspace={workspace} />}
          </div>
        </div>
      </div>
    </div>
  );
}


