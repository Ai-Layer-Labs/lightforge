import { useQuery } from '@tanstack/react-query';
import { useAuthentication } from './useAuthentication';

interface ModelsCatalogEntry {
  id: string;
  name?: string;
  description?: string;
  pricing?: {
    prompt?: string;
    completion?: string;
    currency?: string;
  };
  context_length?: number;
  top_provider?: {
    max_completion_tokens?: number;
    is_moderated?: boolean;
  };
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
  };
  supported_parameters?: string[];
}

interface ModelOption {
  value: string;
  label: string;
  description?: string;
  pricing?: {
    prompt?: string;
    completion?: string;
    currency?: string;
  };
  provider?: string;
  contextLength?: number;
  supportsTools?: boolean;
  supportsVision?: boolean;
}

const FALLBACK_MODELS: ModelOption[] = [
  { value: 'google/gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
  { value: 'anthropic/claude-3-haiku-20240307', label: 'Claude 3 Haiku' },
  { value: 'openai/gpt-4o-mini', label: 'GPT-4o Mini' },
  { value: 'openai/gpt-4o', label: 'GPT-4o' },
];

const formatPricePerMillion = (value?: string) => {
  if (!value) return undefined;
  const numeric = Number(value);
  if (Number.isNaN(numeric)) return undefined;
  const perMillion = numeric * 1_000_000;
  const formatted = perMillion >= 100
    ? perMillion.toFixed(0)
    : perMillion >= 10
      ? perMillion.toFixed(1)
      : perMillion.toFixed(2);
  return `$${formatted}`;
};

const buildLabel = (entry: ModelsCatalogEntry) => {
  const displayName = entry.name?.trim() || entry.id;
  const provider = entry.id.includes('/') ? entry.id.split('/')[0] : undefined;
  const promptCost = formatPricePerMillion(entry.pricing?.prompt);
  const completionCost = formatPricePerMillion(entry.pricing?.completion);
  const priceSegment = promptCost && completionCost
    ? `${promptCost}/${completionCost} per 1M tokens`
    : promptCost
      ? `${promptCost} per 1M prompt tokens`
      : completionCost
        ? `${completionCost} per 1M completion tokens`
        : undefined;

  return [displayName, provider, priceSegment].filter(Boolean).join(' • ');
};

const mapModelsToOptions = (models: ModelsCatalogEntry[]): ModelOption[] => {
  return models
    .filter(model => model?.id)
    .map(model => ({
      value: model.id,
      label: buildLabel(model),
      description: model.description,
      pricing: model.pricing,
      provider: model.id.includes('/') ? model.id.split('/')[0] : undefined,
      contextLength: model.context_length,
      supportsTools: model.supported_parameters?.includes('tools') ?? false,
      supportsVision: model.architecture?.input_modalities?.includes('image') ?? false,
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
};

const fetchDirectOpenRouterModels = async (): Promise<ModelOption[]> => {
  try {
    console.log('[useModelsFromCatalog] Fetching models directly from OpenRouter API...');
    const response = await fetch('https://openrouter.ai/api/v1/models', {
      headers: { Accept: 'application/json' },
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API responded with ${response.status}`);
    }

    const payload = await response.json();
    const models = Array.isArray(payload?.data) ? payload.data : [];
    console.log(`[useModelsFromCatalog] Received ${models.length} models from OpenRouter API`);

    const filteredModels = models.filter((model: ModelsCatalogEntry & { pricing?: { prompt?: string; completion?: string } }) => {
      const promptCost = Number(model.pricing?.prompt ?? 0);
      const completionCost = Number(model.pricing?.completion ?? 0);
      // Skip models without pricing info or extremely high cost
      return (promptCost > 0 || completionCost > 0) && (promptCost + completionCost) < 0.1;
    });

    return mapModelsToOptions(filteredModels);
  } catch (error) {
    console.warn('[useModelsFromCatalog] Direct OpenRouter fetch failed:', error);
    return [];
  }
};

export function useModelsFromCatalog() {
  const { authenticatedFetch, isAuthenticated } = useAuthentication();

  return useQuery<ModelOption[]>({
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

        if (!Array.isArray(catalogs) || catalogs.length === 0) {
          console.warn('No OpenRouter models catalog found in breadcrumbs');
          const directModels = await fetchDirectOpenRouterModels();
          return directModels.length > 0 ? directModels : FALLBACK_MODELS;
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

        const options = Array.isArray(catalog.context?.models)
          ? mapModelsToOptions(catalog.context.models as ModelsCatalogEntry[])
          : [];

        if (options.length === 0) {
          console.warn('OpenRouter models catalog breadcrumb had no models, falling back to direct fetch');
          const directModels = await fetchDirectOpenRouterModels();
          return directModels.length > 0 ? directModels : FALLBACK_MODELS;
        }

        console.log('[useModelsFromCatalog] Returning options from catalog:', options.length);
        return options;

      } catch (error) {
        console.error('Failed to fetch models from catalog:', error);
        const directModels = await fetchDirectOpenRouterModels();
        return directModels.length > 0 ? directModels : FALLBACK_MODELS;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    cacheTime: 10 * 60 * 1000, // 10 minutes
    refetchOnMount: true, // Always check on mount
    refetchOnWindowFocus: true, // Refetch when window gains focus
  });
}
