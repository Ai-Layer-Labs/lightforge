import React from 'react';
import { useParams, Navigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAuthentication } from '../../hooks/useAuthentication';
import { PageLayout } from '../../types/layout';
import { DynamicPage } from '../pages/DynamicPage';

/**
 * DynamicPageLoader fetches and renders pages defined as breadcrumbs
 * URL pattern: /:pageName -> searches for page.layout.v1 with tag "page:{pageName}"
 */
export function DynamicPageLoader() {
  const { pageName } = useParams<{ pageName: string }>();
  const { authenticatedFetch, isAuthenticated } = useAuthentication();

  const pageQuery = useQuery({
    queryKey: ['dynamic-page', pageName],
    queryFn: async (): Promise<PageLayout | null> => {
      if (!pageName) return null;

      console.log('📄 Loading dynamic page:', pageName);

      // Try ui.page.v1 first (new system), then fall back to page.layout.v1 (old system)
      for (const schemaName of ['ui.page.v1', 'page.layout.v1']) {
        const searchParams = new URLSearchParams();
        searchParams.append('schema_name', schemaName);
        searchParams.append('tag', `page:${pageName}`);

        const response = await authenticatedFetch(`/api/breadcrumbs?${searchParams.toString()}`);
        
        if (!response.ok) {
          continue;
        }

        const pages = await response.json();

        if (pages.length > 0) {
          // Load full page breadcrumb
          const pageId = pages[0].id;
          const fullResponse = await authenticatedFetch(`/api/breadcrumbs/${pageId}/full`);
          
          if (!fullResponse.ok) {
            throw new Error('Failed to load page details');
          }

          const pageBreadcrumb = await fullResponse.json();
          console.log(`✅ Page loaded (${schemaName}):`, pageBreadcrumb.title);
          
          return pageBreadcrumb;
        }
      }

      console.warn(`⚠️ No page found for: ${pageName}`);
      return null;
    },
    enabled: isAuthenticated && !!pageName,
    staleTime: 2 * 60 * 1000, // 2 minutes
    retry: 1,
  });

  // Loading state
  if (pageQuery.isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-rcrt">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-rcrt-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-rcrt-primary">Loading page...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (pageQuery.error) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-rcrt">
        <div className="text-center text-red-400">
          <p className="text-xl mb-2">❌ Failed to Load Page</p>
          <p className="text-sm opacity-75">{(pageQuery.error as Error).message}</p>
          <button
            onClick={() => pageQuery.refetch()}
            className="mt-4 px-4 py-2 bg-red-500/20 border border-red-400/50 rounded text-red-300 hover:bg-red-500/30"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // Page not found - show error instead of redirecting (to avoid infinite loops)
  if (!pageQuery.data) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-rcrt">
        <div className="text-center max-w-md">
          <p className="text-xl text-yellow-400 mb-4">📄 Page Not Found</p>
          <p className="text-gray-400 mb-2">
            No page breadcrumb found for: <code className="text-rcrt-primary">/{pageName}</code>
          </p>
          <p className="text-sm text-gray-500 mb-6">
            Create a breadcrumb with schema <code>ui.page.v1</code> or <code>page.layout.v1</code> and tag <code>page:{pageName}</code>
          </p>
          <button
            onClick={() => window.location.href = '/dashboard'}
            className="px-6 py-2 bg-rcrt-primary text-black rounded hover:bg-rcrt-primary/80 transition-colors"
          >
            Go to Dashboard
          </button>
        </div>
      </div>
    );
  }

  // Render the page
  return <DynamicPage pageLayout={pageQuery.data} />;
}

