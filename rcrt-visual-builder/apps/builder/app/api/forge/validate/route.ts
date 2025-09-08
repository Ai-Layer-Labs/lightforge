import { NextRequest } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type AnyRecord = Record<string, any>;

interface ValidationError {
  code: string;
  path: string;
  message: string;
  suggestion?: any;
}

interface ValidationResult {
  ok: boolean;
  errors?: ValidationError[];
  summary?: string;
}

// Minimal in-route validator that relies on a lightweight catalog structure
async function loadCatalog(): Promise<AnyRecord> {
  // Search upwards for heroui-templates/ui-components.json to work across different CWDs
  const tried: string[] = [];
  try {
    let dir = process.cwd();
    for (let i = 0; i < 6; i++) {
      const candidate = path.resolve(dir, 'heroui-templates', 'ui-components.json');
      tried.push(candidate);
      try {
        const text = await fs.readFile(candidate, 'utf8');
        const data = JSON.parse(text);
        const map = new Map<string, AnyRecord>();
        for (const rec of data) {
          const type = rec?.context?.component_type;
          if (typeof type === 'string') map.set(type, rec);
        }
        return { map };
      } catch {
        // move one level up and continue
        const parent = path.dirname(dir);
        if (parent === dir) break;
        dir = parent;
      }
    }
  } catch {}
  return { map: new Map<string, AnyRecord>() };
}

function isSerializable(value: any): boolean {
  try {
    JSON.stringify(value);
    return true;
  } catch {
    return false;
  }
}

function validateProps(component: AnyRecord | undefined, props: AnyRecord, basePath: string, errors: ValidationError[]) {
  if (!component) return;
  const schema = component?.context?.props_schema || {};
  const COMMON_ALLOWED = new Set<string>([
    'className', 'style', 'children', 'id', 'key'
  ]);
  // Unknown props
  for (const key of Object.keys(props || {})) {
    if (!schema[key]) {
      const isDataAttr = key.startsWith('data-');
      const isAriaAttr = key.startsWith('aria-');
      if (COMMON_ALLOWED.has(key) || isDataAttr || isAriaAttr) continue;
      errors.push({ code: 'INVALID_PROP_NAME', path: `${basePath}.props.${key}`, message: `Unknown prop '${key}' for component` });
    }
  }
  // Enum/type checks (basic)
  for (const [key, def] of Object.entries<any>(schema)) {
    const val = props?.[key];
    if (val === undefined) continue;
    if (Array.isArray(def?.options) && !def.options.includes(val)) {
      errors.push({ code: 'INVALID_PROP_VALUE', path: `${basePath}.props.${key}`, message: `Invalid value '${val}'`, suggestion: { replace_with: def.default ?? def.options[0] } });
    }
  }
  // Serialization
  if (!isSerializable(props)) {
    errors.push({ code: 'NON_SERIALIZABLE_PROP', path: `${basePath}.props`, message: 'Props must be JSON-serializable' });
  }
}

function withTimeout(ms: number): AbortSignal {
  const ctrl = new AbortController();
  setTimeout(() => ctrl.abort(), ms).unref?.();
  return ctrl.signal;
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const actions: AnyRecord[] = Array.isArray(body?.context?.actions) ? body.context.actions : [];
  const workspace: string | undefined = Array.isArray(body?.tags) ? body.tags.find((t: string) => t.startsWith('workspace:')) : undefined;

  const errors: ValidationError[] = [];
  const catalog = await loadCatalog();
  const hasCatalog = catalog && catalog.map && typeof catalog.map.size === 'number' && catalog.map.size > 0;

  // Try to resolve layout regions for the workspace (single fetch if possible)
  let layoutRegions: string[] | undefined;
  if (workspace) {
    try {
      const base = new URL('/api/rcrt/', req.url).toString().replace(/\/$/, '');
      const listResp = await fetch(`${base}/breadcrumbs?tag=${encodeURIComponent(workspace)}`, { signal: withTimeout(2000) });
      if (listResp.ok) {
        const list = await listResp.json();
        const layoutSummary = Array.isArray(list) ? list.find((i: any) => Array.isArray(i?.tags) && i.tags.includes('ui:layout')) : undefined;
        if (layoutSummary?.id) {
          const fullResp = await fetch(`${base}/breadcrumbs/${layoutSummary.id}/full`, { signal: withTimeout(2000) });
          if (fullResp.ok) {
            const full = await fullResp.json();
            const regions = full?.context?.regions;
            if (Array.isArray(regions)) layoutRegions = regions.filter((r: any) => typeof r === 'string');
          }
        }
      }
    } catch {
      // ignore region discovery failures; remain best-effort
    }
  }

  if (!workspace) {
    errors.push({ code: 'MISSING_WORKSPACE_TAG', path: 'tags', message: 'Plan must include a workspace:* tag' });
  }

  // Regions are not known here; UI can provide layout context later or a future enhancement can fetch it
  for (let i = 0; i < actions.length; i++) {
    const act = actions[i];
    const basePath = `context.actions[${i}]`;
    switch (act?.type) {
      case 'create_instance': {
        const region: string | undefined = act?.region;
        if (!region) {
          errors.push({ code: 'MISSING_REGION', path: `${basePath}.region`, message: 'region is required' });
        }
        if (region && Array.isArray(layoutRegions) && !layoutRegions.includes(region)) {
          errors.push({ code: 'UNKNOWN_REGION', path: `${basePath}.region`, message: `Unknown region '${region}'`, suggestion: { replace_with: layoutRegions[0] } });
        }
        const inst = act?.instance || {};
        const ref: string | undefined = inst?.component_ref;
        if (!ref) {
          errors.push({ code: 'MISSING_COMPONENT_REF', path: `${basePath}.instance.component_ref`, message: 'component_ref is required' });
        } else {
          const comp = catalog.map.get(ref);
          if (!comp && hasCatalog) {
            errors.push({ code: 'UNKNOWN_COMPONENT_TYPE', path: `${basePath}.instance.component_ref`, message: `Unknown component_ref '${ref}'` });
          }
          validateProps(comp, inst?.props || {}, `${basePath}.instance`, errors);
        }
        break;
      }
      case 'create_instance_from_template': {
        // For now, just require template_id and allow overrides
        if (!act?.template_id) {
          errors.push({ code: 'MISSING_TEMPLATE_ID', path: `${basePath}.template_id`, message: 'template_id is required' });
        }
        if (!act?.region) {
          errors.push({ code: 'MISSING_REGION', path: `${basePath}.region`, message: 'region is required' });
        }
        if (act?.region && Array.isArray(layoutRegions) && !layoutRegions.includes(act.region)) {
          errors.push({ code: 'UNKNOWN_REGION', path: `${basePath}.region`, message: `Unknown region '${act.region}'`, suggestion: { replace_with: layoutRegions[0] } });
        }
        if (act?.overrides?.props && !isSerializable(act.overrides.props)) {
          errors.push({ code: 'NON_SERIALIZABLE_PROP', path: `${basePath}.overrides.props`, message: 'Props must be JSON-serializable' });
        }
        break;
      }
      case 'update_instance': {
        if (!act?.id) {
          errors.push({ code: 'MISSING_ID', path: `${basePath}.id`, message: 'id is required for update' });
        }
        if (!isSerializable(act?.updates || {})) {
          errors.push({ code: 'NON_SERIALIZABLE_PROP', path: `${basePath}.updates`, message: 'updates must be serializable' });
        }
        break;
      }
      case 'delete_instance': {
        if (!act?.id) {
          errors.push({ code: 'MISSING_ID', path: `${basePath}.id`, message: 'id is required for delete' });
        }
        break;
      }
      default:
        errors.push({ code: 'UNSUPPORTED_ACTION', path: basePath, message: `Unsupported action type '${act?.type}'` });
    }
  }

  const result: ValidationResult = {
    ok: errors.length === 0,
    errors: errors.length ? errors : undefined,
    summary: errors.length ? `${errors.length} errors found` : 'ok'
  };

  const resp = {
    schema_name: 'ui.validation.v1',
    title: 'UI Plan Validation',
    tags: [workspace || 'workspace:unknown', 'ui:validation'],
    context: result
  };

  return new Response(JSON.stringify(resp), { status: 200, headers: { 'content-type': 'application/json' } });
}


