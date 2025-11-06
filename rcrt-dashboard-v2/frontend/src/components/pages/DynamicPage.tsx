import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { PageLayout } from '../../types/layout';
import { useAuthentication } from '../../hooks/useAuthentication';
import { useUIState } from '../../hooks/useUIState';
import { useAction } from '../../hooks/useAction';
import { Header } from '../ui/Header';
import { Section } from '../layout/Section';
import { Slot } from '../layout/Slot';
import { UIRenderer } from '../ui/UIRenderer';
import { TemplateContext } from '../../utils/TemplateEngine';

interface DynamicPageProps {
  pageLayout: any; // Can be page.layout.v1 or ui.page.v1
}

/**
 * DynamicPage renders pages based on breadcrumb definitions
 * Supports both:
 * - page.layout.v1 (old system with sections/slots)
 * - ui.page.v1 (new system with HeroUI JSON + state + actions)
 */
export function DynamicPage({ pageLayout }: DynamicPageProps) {
  console.log('🎨 Rendering dynamic page:', pageLayout.title, pageLayout.schema_name);

  // Check if this is a ui.page.v1 (new system)
  if (pageLayout.schema_name === 'ui.page.v1' || pageLayout.context?.ui) {
    return <UIPage pageLayout={pageLayout} />;
  }

  // Otherwise render as page.layout.v1 (old system)
  return <LayoutPage pageLayout={pageLayout} />;
}

/**
 * Render ui.page.v1 pages (new system with UIRenderer)
 */
function UIPage({ pageLayout }: { pageLayout: any }) {
  const { authenticatedFetch, isAuthenticated } = useAuthentication();
  const stateRef = pageLayout.context.state_ref;

  // Load UI state if specified
  const {
    state,
    loading: stateLoading,
    updateState,
    stateManager,
  } = useUIState(stateRef || 'temp:no-state', {});

  // Create action runner with named actions from page
  const { actionRunner } = useAction(stateManager, stateRef);
  
  // Set named actions from page definition
  React.useEffect(() => {
    if (pageLayout.context.actions) {
      actionRunner.setNamedActions(pageLayout.context.actions);
    }
  }, [pageLayout.context.actions, actionRunner]);

  // Load data sources
  const dataSourcesQuery = useQuery({
    queryKey: ['page-data-sources', pageLayout.id],
    queryFn: async () => {
      const dataSources = pageLayout.context.data_sources || {};
      const loadedData: Record<string, any> = {};

      for (const [key, searchDef] of Object.entries(dataSources)) {
        const search = (searchDef as any).breadcrumb_search;
        if (!search) continue;

        const params = new URLSearchParams();
        if (search.schema_name) params.append('schema_name', search.schema_name);
        if (search.tag) params.append('tag', search.tag);

        const response = await authenticatedFetch(`/api/breadcrumbs?${params.toString()}`);
        if (response.ok) {
          const results = await response.json();
          
          // Load full breadcrumbs
          const fullBreadcrumbs = await Promise.all(
            results.slice(0, search.limit || 10).map(async (bc: any) => {
              const fullResponse = await authenticatedFetch(`/api/breadcrumbs/${bc.id}/full`);
              return fullResponse.json();
            })
          );

          loadedData[key] = fullBreadcrumbs;
        }
      }

      return loadedData;
    },
    enabled: isAuthenticated && !!pageLayout.context.data_sources,
  });

  if (stateLoading || dataSourcesQuery.isLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-rcrt">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-rcrt-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-rcrt-primary">Loading page...</p>
        </div>
      </div>
    );
  }

  // Build template context with safe fallbacks
  const context: TemplateContext = {
    state: state || { currentStep: 1 }, // Provide safe default
    data: dataSourcesQuery.data || {},
  };

  // Render UI from breadcrumb definition
  const uiDefinition = pageLayout.context.ui;

  // Show loading if state is not yet ready
  if (!state && stateRef) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-gradient-rcrt">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-rcrt-primary border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-rcrt-primary">Loading page state...</p>
        </div>
      </div>
    );
  }

  return (
    <UIRenderer
      definition={uiDefinition}
      context={context}
      actionRunner={actionRunner}
    />
  );
}

/**
 * Render page.layout.v1 pages (old system)
 */
function LayoutPage({ pageLayout }: { pageLayout: PageLayout }) {
  const { layout, metadata } = pageLayout.context;

  return (
    <div className="w-full h-full flex flex-col bg-gradient-rcrt">
      <Header />
      
      <div className="flex-1 overflow-auto p-8">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-3xl font-bold text-white mb-4">
            {pageLayout.title}
          </h1>
          
          {metadata?.description && (
            <p className="text-gray-300 mb-8">
              {metadata.description}
            </p>
          )}

          {/* Render dynamic layout */}
          <div className={`dynamic-layout layout-${layout.type}`}>
            {layout.sections.map((section, index) => (
              <Section key={section.id || index} section={section}>
                {section.slots && section.slots.map((slot, slotIndex) => (
                  <Slot key={slot.id || slotIndex} slot={slot} />
                ))}
              </Section>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}


