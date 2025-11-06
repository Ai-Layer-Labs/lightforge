import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useAuthentication } from './useAuthentication';
import { Scene3DConfig, defaultScene3DConfig } from '../components/panels/Scene3DControls';
import { Breadcrumb } from '../types/rcrt';

/**
 * Hook for managing persistent 3D configuration stored as RCRT breadcrumbs
 * Implements "breadcrumb everything" philosophy
 */
export function use3DConfig() {
  const { authenticatedFetch, isAuthenticated } = useAuthentication();
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<Scene3DConfig>(defaultScene3DConfig);
  
  // Load 3D config from breadcrumbs
  const configQuery = useQuery({
    queryKey: ['dashboard-3d-config'],
    queryFn: async (): Promise<Scene3DConfig> => {
      console.log('🎛️ Loading 3D config from breadcrumbs...');
      
      try {
        // Search for dashboard 3D config breadcrumb
        const response = await authenticatedFetch('/api/breadcrumbs');
        if (!response.ok) {
          throw new Error(`Failed to load breadcrumbs: ${response.statusText}`);
        }
        
        const breadcrumbs = await response.json();
        const configBreadcrumb = breadcrumbs.find((b: Breadcrumb) => 
          b.title === 'Dashboard 3D Configuration' && 
          b.tags?.includes('dashboard:3d:config')
        );
        
        if (configBreadcrumb) {
          console.log('✅ Found 3D config breadcrumb:', configBreadcrumb.id);
          
          // Get full context
          const detailResponse = await authenticatedFetch(`/api/breadcrumbs/${configBreadcrumb.id}/full`);
          if (detailResponse.ok) {
            const detail = await detailResponse.json();
            if (detail.context?.config) {
              console.log('🎛️ Loaded 3D config from breadcrumb:', detail.context.config);
              console.log('🔮 Cluster balls setting:', detail.context.config.showClusterBalls);
              return detail.context.config;
            }
          }
        }
        
        console.log('🎛️ No 3D config found, using defaults');
        return defaultScene3DConfig;
        
      } catch (error) {
        console.warn('Failed to load 3D config:', error);
        return defaultScene3DConfig;
      }
    },
    staleTime: 10 * 60 * 1000, // 10 minutes
    retry: 1,
    enabled: isAuthenticated, // Only run after authentication
  });
  
  // Save 3D config to breadcrumbs
  const saveConfigMutation = useMutation({
    mutationFn: async (newConfig: Scene3DConfig) => {
      console.log('💾 Saving 3D config to breadcrumb:', newConfig);
      console.log('🔮 Saving cluster balls setting:', newConfig.showClusterBalls);
      
      // First, try to find existing config breadcrumb
      console.log('🔍 Searching for existing 3D config breadcrumb...');
      const searchResponse = await authenticatedFetch('/api/breadcrumbs');
      let existingId: string | null = null;
      let existingVersion: number = 1;
      
      if (searchResponse.ok) {
        const breadcrumbs = await searchResponse.json();
        console.log(`📋 Found ${breadcrumbs.length} total breadcrumbs`);
        
        // Debug: Show all breadcrumb schemas and tags
        const configSchemas = breadcrumbs.filter((b: Breadcrumb) => b.schema_name?.includes('config'));
        console.log('📋 All config schemas found:', configSchemas.map(b => ({ title: b.title, schema: b.schema_name, tags: b.tags })));
        
        // Debug: Show all breadcrumbs with "3D" or "Configuration" in title
        const titleMatches = breadcrumbs.filter((b: Breadcrumb) => 
          b.title?.includes('3D') || b.title?.includes('Configuration')
        );
        console.log('📋 Title matches for 3D/Configuration:', titleMatches.map(b => ({ id: b.id, title: b.title, schema: b.schema_name, tags: b.tags })));
        
        // Find config breadcrumbs using only fields available in list response (title and tags)
        const configBreadcrumbs = breadcrumbs.filter((b: Breadcrumb) => 
          b.title === 'Dashboard 3D Configuration' &&
          b.tags?.includes('dashboard:3d:config')
        );
        
        console.log(`🔍 Found ${configBreadcrumbs.length} 3D config breadcrumbs:`, configBreadcrumbs.map(b => ({ id: b.id, version: b.version, title: b.title })));
        
        if (configBreadcrumbs.length > 0) {
          // Sort by updated_at (most recent) instead of version
          const latest = configBreadcrumbs.sort((a, b) => 
            new Date(b.updated_at || 0).getTime() - new Date(a.updated_at || 0).getTime()
          )[0];
          
          existingId = latest.id;
          existingVersion = (latest.version || 1);
          console.log(`📝 Will update breadcrumb ${existingId} (current version ${existingVersion})`);
        } else {
          console.log('✨ No existing config found, will create new one');
        }
      }
      
      const configBreadcrumb = {
        title: 'Dashboard 3D Configuration',
        context: {
          config: newConfig,
          lastUpdated: new Date().toISOString(),
          version: '1.0.0',
          description: 'Persistent 3D visualization configuration for RCRT Dashboard v2'
        },
        tags: ['dashboard:3d:config', 'dashboard:v2', 'config:persistent'],
        schema_name: 'dashboard.3d.config.v1'
      };
      
      let response;
      if (existingId) {
        // Update existing breadcrumb with version control
        console.log(`🔄 Attempting PATCH with If-Match: ${existingVersion}`);
        response = await authenticatedFetch(`/api/breadcrumbs/${existingId}`, {
          method: 'PATCH',
          headers: { 
            'Content-Type': 'application/json',
            'If-Match': `${existingVersion}` // Use current version for If-Match
          },
          body: JSON.stringify(configBreadcrumb),
        });
        
        if (response.ok) {
          console.log('✅ Successfully updated 3D config breadcrumb:', existingId);
        } else {
          const errorText = await response.text();
          console.error('❌ PATCH failed:', response.status, errorText);
          throw new Error(`PATCH failed: ${response.status} ${errorText}`);
        }
      } else {
        // Create new breadcrumb
        response = await authenticatedFetch('/api/breadcrumbs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(configBreadcrumb),
        });
        console.log('✨ Created new 3D config breadcrumb');
      }
      
      if (!response.ok) {
        throw new Error(`Failed to save 3D config: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log('✅ 3D config saved successfully');
      return result;
    },
    onSuccess: () => {
      // Invalidate config query to refresh
      queryClient.invalidateQueries({ queryKey: ['dashboard-3d-config'] });
      console.log('🔄 3D config cache invalidated');
    },
    onError: (error) => {
      console.error('❌ Failed to save 3D config:', error);
    }
  });
  
  // Update local config when query data changes
  useEffect(() => {
    if (configQuery.data) {
      // Validate loaded config and fix any escaped spheres
      const validatedConfig = validateAndFixConfig(configQuery.data);
      setConfig(validatedConfig);
      console.log('🎛️ Applied loaded 3D config');
    }
  }, [configQuery.data]);
  
  // Validate config and bring escaped spheres back to visible range
  const validateAndFixConfig = (loadedConfig: Scene3DConfig): Scene3DConfig => {
    const maxDistance = 500; // Maximum distance from origin
    const fixed = { ...loadedConfig };
    
    // Add missing agent-definitions sphere if not present (for backward compatibility)
    if (!fixed['agent-definitions']) {
      console.log('🔧 Adding missing agent-definitions sphere to config');
      fixed['agent-definitions'] = { x: -75, y: 100, z: -50, baseRadius: 50 };
    }
    
    // Check each sphere and fix if escaped
    Object.entries(fixed).forEach(([key, sphere]) => {
      if (sphere && typeof sphere === 'object' && 'x' in sphere) {
        const distance = Math.sqrt(sphere.x * sphere.x + sphere.y * sphere.y + sphere.z * sphere.z);
        if (distance > maxDistance) {
          console.log(`🚨 Fixed escaped sphere: ${key} was at distance ${distance.toFixed(1)}`);
          // Scale position back to visible range
          const scale = maxDistance / distance;
          (fixed as any)[key] = {
            ...sphere,
            x: sphere.x * scale,
            y: sphere.y * scale,
            z: sphere.z * scale,
          };
        }
      }
    });
    
    return fixed;
  };
  
  // Debounced save function to avoid too many saves
  const [saveTimeout, setSaveTimeout] = useState<NodeJS.Timeout | null>(null);
  
  const updateConfig = (newConfig: Scene3DConfig) => {
    console.log('🎛️ Updating 3D config:', newConfig);
    setConfig(newConfig);
    
    // Debounce saves (wait 2 seconds after last change)
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }
    
    const timeout = setTimeout(() => {
      console.log('💾 Auto-saving 3D config to breadcrumb...');
      saveConfigMutation.mutate(newConfig);
    }, 2000);
    
    setSaveTimeout(timeout);
  };
  
  // Cleanup duplicate config breadcrumbs
  const cleanupDuplicates = async () => {
    try {
      console.log('🧹 Cleaning up duplicate 3D config breadcrumbs...');
      
      const response = await authenticatedFetch('/api/breadcrumbs');
      if (!response.ok) return;
      
      const breadcrumbs = await response.json();
      const configBreadcrumbs = breadcrumbs.filter((b: Breadcrumb) => 
        b.schema_name === 'dashboard.3d.config.v1' && 
        b.tags?.includes('dashboard:3d:config')
      );
      
      if (configBreadcrumbs.length > 1) {
        // Sort by version and keep only the latest
        const sorted = configBreadcrumbs.sort((a, b) => (b.version || 1) - (a.version || 1));
        const toDelete = sorted.slice(1); // All except the first (latest)
        
        console.log(`🗑️ Deleting ${toDelete.length} duplicate config breadcrumbs`);
        
        // Delete duplicates
        for (const breadcrumb of toDelete) {
          await authenticatedFetch(`/api/breadcrumbs/${breadcrumb.id}`, {
            method: 'DELETE'
          });
        }
        
        console.log('✅ Cleanup complete');
      }
    } catch (error) {
      console.warn('Failed to cleanup duplicates:', error);
    }
  };

  return {
    config,
    updateConfig,
    cleanupDuplicates,
    isLoading: configQuery.isLoading,
    isSaving: saveConfigMutation.isPending,
    error: configQuery.error || saveConfigMutation.error,
    lastSaved: saveConfigMutation.isSuccess ? new Date() : null,
  };
}
