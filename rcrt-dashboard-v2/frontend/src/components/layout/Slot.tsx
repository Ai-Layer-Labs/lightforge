import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Slot as SlotType } from '../../types/layout';
import { useAuthentication } from '../../hooks/useAuthentication';
import { DynamicConfigForm } from '../forms/DynamicConfigForm';
import { Card } from '../ui/Card';
import clsx from 'clsx';

interface SlotProps {
  slot: SlotType;
}

/**
 * Slot component renders content from breadcrumbs into page layouts
 * Supports different render modes: config_form, display, card, custom
 */
export function Slot({ slot }: SlotProps) {
  const { authenticatedFetch, isAuthenticated } = useAuthentication();

  // Load breadcrumb(s) for this slot
  const breadcrumbQuery = useQuery({
    queryKey: ['slot-breadcrumb', slot.id || JSON.stringify(slot.breadcrumb_search)],
    queryFn: async () => {
      // If specific breadcrumb ID is provided
      if (slot.breadcrumb_id) {
        const response = await authenticatedFetch(`/api/breadcrumbs/${slot.breadcrumb_id}/full`);
        if (!response.ok) {
          throw new Error('Failed to load breadcrumb');
        }
        return [await response.json()];
      }

      // If breadcrumb search is provided
      if (slot.breadcrumb_search) {
        const params = new URLSearchParams();
        if (slot.breadcrumb_search.schema_name) {
          params.append('schema_name', slot.breadcrumb_search.schema_name);
        }
        if (slot.breadcrumb_search.tag) {
          params.append('tag', slot.breadcrumb_search.tag);
        }
        if (slot.breadcrumb_search.any_tags) {
          slot.breadcrumb_search.any_tags.forEach(tag => params.append('tag', tag));
        }

        const response = await authenticatedFetch(`/api/breadcrumbs?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to search breadcrumbs');
        }

        const results = await response.json();
        const limit = slot.breadcrumb_search.limit || 10;
        
        // Load full breadcrumbs
        const fullBreadcrumbs = await Promise.all(
          results.slice(0, limit).map(async (bc: any) => {
            const fullResponse = await authenticatedFetch(`/api/breadcrumbs/${bc.id}/full`);
            return fullResponse.json();
          })
        );
        
        return fullBreadcrumbs;
      }

      return [];
    },
    enabled: isAuthenticated && (!!slot.breadcrumb_id || !!slot.breadcrumb_search),
    staleTime: 2 * 60 * 1000,
  });

  // Loading state
  if (breadcrumbQuery.isLoading) {
    return (
      <div className={clsx('slot-loading', slot.className)} style={slot.props?.style}>
        <div className="animate-spin w-6 h-6 border-2 border-rcrt-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  // Error state
  if (breadcrumbQuery.error) {
    return (
      <div className={clsx('slot-error', slot.className)} style={slot.props?.style}>
        <p className="text-red-400 text-sm">Failed to load content</p>
      </div>
    );
  }

  const breadcrumbs = breadcrumbQuery.data || [];

  // No data
  if (breadcrumbs.length === 0) {
    return (
      <div className={clsx('slot-empty', slot.className)} style={slot.props?.style}>
        <p className="text-gray-500 text-sm">No content available</p>
      </div>
    );
  }

  // Render based on mode
  const renderMode = slot.render_mode || 'display';

  switch (renderMode) {
    case 'config_form':
      // Render dynamic config form (for tools)
      return (
        <div className={clsx('slot-config-form', slot.className)} style={slot.props?.style}>
          {breadcrumbs.map(bc => (
            <div key={bc.id}>
              <DynamicConfigForm
                tool={bc}
                config={{}}
                onConfigChange={() => {}}
                secrets={[]}
                onSave={() => {}}
                onCancel={() => {}}
              />
            </div>
          ))}
        </div>
      );

    case 'card':
      // Render as cards
      return (
        <div className={clsx('slot-cards flex flex-wrap gap-4', slot.className)} style={slot.props?.style}>
          {breadcrumbs.map(bc => (
            <Card
              key={bc.id}
              type="breadcrumb"
              title={bc.title}
              description={bc.context?.description}
              tags={bc.tags}
            />
          ))}
        </div>
      );

    case 'display':
    default:
      // Default display mode - show formatted data
      return (
        <div className={clsx('slot-display space-y-4', slot.className)} style={slot.props?.style}>
          {breadcrumbs.map(bc => (
            <div key={bc.id} className="bg-white/5 border border-white/10 rounded-lg p-4">
              <h3 className="text-white font-semibold mb-2">{bc.title}</h3>
              {bc.context && (
                <pre className="text-xs text-gray-400 overflow-x-auto">
                  {JSON.stringify(bc.context, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      );
  }
}

