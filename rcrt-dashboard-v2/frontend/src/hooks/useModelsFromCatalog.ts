import { useQuery } from '@tanstack/react-query';
import { useAuthentication } from './useAuthentication';

interface Model {
  id: string;
  name: string;
  pricing: {
    prompt: string;
    completion: string;
  };
}

export function useModelsFromCatalog() {
  const { authenticatedFetch, isAuthenticated } = useAuthentication();
  
  return useQuery({
    queryKey: ['openrouter-models'],
    enabled: isAuthenticated, // Only fetch when authenticated
    queryFn: async () => {
      try {
        // Search for models catalog breadcrumb
        // Add include_context=true to get full breadcrumb data
        const response = await authenticatedFetch(
          '/api/breadcrumbs?tag=openrouter:models&include_context=true'
        );
        
        if (!response.ok) {
          throw new Error('Failed to fetch models catalog');
        }
        
        const catalogs = await response.json();
        console.log('[useModelsFromCatalog] API response:', catalogs);
        
        if (catalogs.length === 0) {
          console.warn('No OpenRouter models catalog found');
          // Return default models as fallback
          return [
            { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
            { value: 'anthropic/claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
            { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
            { value: 'openai/gpt-4o', label: 'GPT-4o' },
          ];
        }
        
        // Get the most recent catalog
        const catalog = catalogs.sort((a: any, b: any) => 
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
        )[0];
        
        console.log('[useModelsFromCatalog] Selected catalog:', catalog);
        
        // If context is missing, fetch the full breadcrumb
        if (!catalog.context || !catalog.context.models) {
          console.log('[useModelsFromCatalog] Context missing, fetching full breadcrumb...');
          const fullResponse = await authenticatedFetch(`/api/breadcrumbs/${catalog.id}`);
          if (fullResponse.ok) {
            const fullCatalog = await fullResponse.json();
            console.log('[useModelsFromCatalog] Full breadcrumb:', fullCatalog);
            catalog.context = fullCatalog.context;
          }
        }
        
        console.log('[useModelsFromCatalog] Models in catalog:', catalog.context?.models?.length);
        
        // Transform models to options format
        const models = catalog.context?.models || [];
        const options = models.map((model: Model) => ({
          value: model.id,
          label: model.name || model.id,
          pricing: model.pricing
        }));
        
        console.log('[useModelsFromCatalog] Returning options:', options.length);
        return options;
        
      } catch (error) {
        console.error('Failed to fetch models from catalog:', error);
        // Return default models as fallback
        return [
          { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
          { value: 'anthropic/claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
          { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
          { value: 'openai/gpt-4o', label: 'GPT-4o' },
        ];
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchOnMount: true, // Always check on mount
    refetchOnWindowFocus: true, // Refetch when window gains focus
  });
}
