import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthentication } from '../../hooks/useAuthentication';
import { TemplateContext } from '../../utils/TemplateEngine';
import { ActionRunner } from '../../services/ActionRunner';
import { DataLoaderChildren } from './DataLoaderChildren';

interface DataLoaderWrapperProps {
  breadcrumb_search?: {
    schema_name?: string;
    tag?: string;
    any_tags?: string[];
    limit?: number;
  };
  breadcrumb_id?: string;
  as?: string;
  context: TemplateContext;
  actionRunner: ActionRunner;
  childrenDef?: any; // Raw children definition (not yet rendered)
}

/**
 * DataLoaderWrapper - Loads breadcrumbs and injects into children's context
 * This is used by UIRenderer to handle DataLoader components
 */
export function DataLoaderWrapper({
  breadcrumb_search,
  breadcrumb_id,
  as = 'data',
  context,
  actionRunner,
  childrenDef,
}: DataLoaderWrapperProps) {
  const { authenticatedFetch, isAuthenticated } = useAuthentication();

  const dataQuery = useQuery({
    queryKey: ['data-loader', breadcrumb_id || JSON.stringify(breadcrumb_search)],
    queryFn: async () => {
      console.log('🔍 DataLoader querying:', { breadcrumb_id, breadcrumb_search });
      
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

        console.log('🔍 DataLoader searching:', params.toString());
        const response = await authenticatedFetch(`/api/breadcrumbs?${params.toString()}`);
        
        if (!response.ok) {
          console.error('❌ Search failed:', response.status);
          throw new Error('Failed to search breadcrumbs');
        }

        const results = await response.json();
        console.log('📋 DataLoader found', results.length, 'breadcrumbs');
        
        const limit = breadcrumb_search.limit || 10;

        // Load full breadcrumbs
        const fullBreadcrumbs = await Promise.all(
          results.slice(0, limit).map(async (bc: any) => {
            const fullResponse = await authenticatedFetch(`/api/breadcrumbs/${bc.id}/full`);
            return fullResponse.json();
          })
        );

        console.log('✅ DataLoader loaded', fullBreadcrumbs.length, 'full breadcrumbs');
        return fullBreadcrumbs;
      }

      return [];
    },
    enabled: isAuthenticated && (!!breadcrumb_id || !!breadcrumb_search),
    staleTime: 2 * 60 * 1000,
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

  // Merge loaded data into context under the specified name
  const enhancedContext: TemplateContext = {
    ...context,
    [as]: dataQuery.data || [],
  };

  console.log(`📦 DataLoader loaded ${(dataQuery.data || []).length} items as '${as}'`, dataQuery.data);

  // We need to import renderNode here, but that would create circular dependency
  // So we'll export it from UIRenderer
  // For now, just render a message
  if (!childrenDef) {
    return <div className="text-gray-500 text-sm">No children to render</div>;
  }

  // Use a dynamic import to avoid circular dependency
  return <DataLoaderChildren childrenDef={childrenDef} context={enhancedContext} actionRunner={actionRunner} />;
}

