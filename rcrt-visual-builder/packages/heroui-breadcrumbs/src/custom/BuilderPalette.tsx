'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { RcrtClientEnhanced } from '@rcrt-builder/sdk';

type AnyRecord = Record<string, any>;

interface TemplateItem {
  id: string;
  title: string;
  tags: string[];
  context: {
    component_type: string;
    default_props?: AnyRecord;
    preview_asset_tag?: string;
    description?: string;
  };
}

interface AssetItem {
  id: string;
  title: string;
  tags: string[];
  context: {
    kind?: string;
    content_type?: string;
    url?: string;
    data_base64?: string;
    width?: number;
    height?: number;
    alt?: string;
  };
}

export interface BuilderPaletteProps {
  workspace: string;
  rcrtClient: RcrtClientEnhanced;
  className?: string;
}

export const BuilderPalette: React.FC<BuilderPaletteProps> = ({ workspace, rcrtClient, className }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [assets, setAssets] = useState<AssetItem[]>([]);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setIsLoading(true);
        setError(null);
        // Load all builder workspace items then filter in-memory
        const list = await rcrtClient.searchBreadcrumbs({ tag: 'workspace:builder' });
        const full = await rcrtClient.batchGet(list.map((i: any) => i.id), 'full');
        const tmpl = full.filter((b: any) => b?.schema_name === 'ui.template.v1' || (Array.isArray(b?.tags) && b.tags.includes('ui:template')));
        const ast = full.filter((b: any) => b?.schema_name === 'ui.asset.v1' || (Array.isArray(b?.tags) && b.tags.includes('ui:asset')));
        if (!cancelled) {
          setTemplates(tmpl as any);
          setAssets(ast as any);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || String(e));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [rcrtClient]);

  const assetByTag = useMemo(() => {
    const map = new Map<string, AssetItem>();
    for (const a of assets) {
      for (const t of a.tags || []) {
        if (t.startsWith('asset:')) {
          map.set(t, a);
        }
      }
    }
    return map;
  }, [assets]);

  // Only allow top-level-safe components to be instantiated directly
  const allowedTopLevel = useMemo(() => new Set<string>([
    'Button','Card','Input','Select','Modal','Table','Tabs','Badge','Tooltip','Progress',
    'Checkbox','CheckboxGroup','Radio','RadioGroup','Switch','Slider','Textarea','Autocomplete',
    'DatePicker','DateInput','DateRangePicker','TimeInput','NumberInput','Avatar','AvatarGroup',
    'Chip','Divider','Link','User','Code','Kbd','Image','Snippet','Breadcrumbs','Pagination',
    'Skeleton','Spinner','CircularProgress','Alert','ScrollShadow','Spacer','Popover','Drawer',
    'Accordion','Listbox','Calendar','RangeCalendar','Navbar'
  ]), []);

  const safeTemplates = useMemo(() => {
    return templates.filter(t => allowedTopLevel.has(t?.context?.component_type));
  }, [templates, allowedTopLevel]);

  const handleAdd = async (t: TemplateItem) => {
    try {
      setIsLoading(true);
      await rcrtClient.createBreadcrumb({
        schema_name: 'ui.instance.v1',
        title: `${t.context.component_type}: from ${t.title}`,
        tags: [workspace, 'ui:instance', 'region:content'],
        context: {
          component_ref: t.context.component_type,
          props: t.context.default_props || {},
          created_from_template: t.id,
          order: 0
        }
      });
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddAll = async () => {
    setIsLoading(true);
    try {
      for (const t of safeTemplates) {
        await rcrtClient.createBreadcrumb({
          schema_name: 'ui.instance.v1',
          title: `${t.context.component_type}: from ${t.title}`,
          tags: [workspace, 'ui:instance', 'region:content'],
          context: {
            component_ref: t.context.component_type,
            props: t.context.default_props || {},
            created_from_template: t.id,
            order: 0
          }
        });
      }
    } catch (e: any) {
      setError(e?.message || String(e));
    } finally {
      setIsLoading(false);
    }
  };

  const renderPreview = (t: TemplateItem) => {
    const tag = t.context.preview_asset_tag;
    const asset = tag ? assetByTag.get(tag) : undefined;
    if (asset?.context?.data_base64) {
      const src = `data:${asset.context.content_type || 'image/svg+xml'};base64,${asset.context.data_base64}`;
      return <img src={src} alt={asset.context.alt || t.title} style={{ width: '100%', height: 96, objectFit: 'cover', borderRadius: 6 }} />;
    }
    if (asset?.context?.url) {
      return <img src={asset.context.url} alt={asset.context.alt || t.title} style={{ width: '100%', height: 96, objectFit: 'cover', borderRadius: 6 }} />;
    }
    return (
      <div style={{ height: 96, borderRadius: 6, background: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9ca3af', fontSize: 12 }}>
        {t.context.component_type}
      </div>
    );
  };

  return (
    <div className={className} data-builder-palette>
      <div style={{ padding: 8, fontSize: 12, opacity: 0.8 }}>Palette</div>
      {isLoading && <div style={{ padding: 8, fontSize: 12 }}>Loading…</div>}
      {error && <div style={{ padding: 8, fontSize: 12, color: '#f87171' }}>{error}</div>}
      <div style={{ padding: 8, display: 'flex', gap: 8 }}>
        <button onClick={handleAddAll} disabled={isLoading} style={{ fontSize: 12, padding: '6px 10px', borderRadius: 6, background: '#10b981', color: 'white' }}>Add All (safe)</button>
        <div style={{ fontSize: 12, opacity: 0.7 }}>Showing {safeTemplates.length} / {templates.length} templates</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12, padding: 8 }}>
        {safeTemplates.map((t) => (
          <div key={t.id} style={{ border: '1px solid #374151', borderRadius: 8, overflow: 'hidden', background: '#0b0f19' }}>
            {renderPreview(t)}
            <div style={{ padding: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4 }}>{t.title.replace(/^Template:\s*/, '')}</div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => handleAdd(t)} style={{ fontSize: 12, padding: '4px 8px', borderRadius: 6, background: '#2563eb', color: 'white' }}>Add</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};


