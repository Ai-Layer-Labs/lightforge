import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthentication } from '../../hooks/useAuthentication';
import { TemplateContext } from '../../utils/TemplateEngine';
import { ActionRunner } from '../../services/ActionRunner';

interface DataLoaderProps {
  breadcrumb_search?: {
    schema_name?: string;
    tag?: string;
    any_tags?: string[];
    limit?: number;
  };
  breadcrumb_id?: string;
  as?: string; // Variable name to expose data as (default: 'data')
  context: TemplateContext;
  actionRunner: ActionRunner;
  children?: React.ReactNode;
}

/**
 * DataLoader - Load breadcrumbs and pass to children
 * Usage in breadcrumb:
 * {
 *   "DataLoader": {
 *     "breadcrumb_search": {
 *       "schema_name": "tool.code.v1",
 *       "tag": "llm"
 *     },
 *     "as": "providers",
 *     "children": [...]
 *   }
 * }
 */
export function DataLoader({
  breadcrumb_search,
  breadcrumb_id,
  as = 'data',
  context,
  actionRunner,
  children,
}: DataLoaderProps) {
  const { authenticatedFetch, isAuthenticated } = useAuthentication();

  const dataQuery = useQuery({
    queryKey: ['data-loader', breadcrumb_id || JSON.stringify(breadcrumb_search)],
    queryFn: async () => {
      if (breadcrumb_id) {
        const response = await authenticatedFetch(`/api/breadcrumbs/${breadcrumb_id}/full`);
        if (!response.ok) {
          throw new Error('Failed to load breadcrumb');
        }
        return [await response.json()];
      }

      if (breadcrumb_search) {
        const params = new URLSearchParams();
        if (breadcrumb_search.schema_name) {
          params.append('schema_name', breadcrumb_search.schema_name);
        }
        if (breadcrumb_search.tag) {
          params.append('tag', breadcrumb_search.tag);
        }
        if (breadcrumb_search.any_tags) {
          breadcrumb_search.any_tags.forEach(tag => params.append('tag', tag));
        }

        const response = await authenticatedFetch(`/api/breadcrumbs?${params.toString()}`);
        if (!response.ok) {
          throw new Error('Failed to search breadcrumbs');
        }

        const results = await response.json();
        const limit = breadcrumb_search.limit || 10;

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
    enabled: isAuthenticated && (!!breadcrumb_id || !!breadcrumb_search),
  });

  if (dataQuery.isLoading) {
    return (
      <div className="flex items-center justify-center p-4">
        <div className="animate-spin w-6 h-6 border-2 border-rcrt-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (dataQuery.error) {
    return (
      <div className="text-red-400 text-sm p-4">
        Failed to load data: {(dataQuery.error as Error).message}
      </div>
    );
  }

  // This component is a marker - the actual rendering with data is done in UIRenderer
  // Data will be available as context[as]
  return <>{children}</>;
}

