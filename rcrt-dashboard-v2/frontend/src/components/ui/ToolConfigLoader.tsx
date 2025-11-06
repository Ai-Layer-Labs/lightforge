import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthentication } from '../../hooks/useAuthentication';
import { TemplateContext } from '../../utils/TemplateEngine';
import { ActionRunner } from '../../services/ActionRunner';
import { renderNode } from './UIRenderer';

interface ToolConfigLoaderProps {
  tool_id: string; // Breadcrumb ID of the tool
  initial_config?: Record<string, any>;
  on_save?: any; // Action to execute after saving
  on_cancel?: any; // Action to execute on cancel
  context: TemplateContext;
  actionRunner: ActionRunner;
}

/**
 * ToolConfigLoader - Loads a tool's ui_schema and renders it
 * This allows wizards and pages to reuse tool configuration UIs
 * 
 * Usage in breadcrumb:
 * {
 *   "ToolConfigLoader": {
 *     "tool_id": "{{state.selectedProvider}}",
 *     "on_save": {
 *       "action": "setState",
 *       "updates": { "createdConfigId": "{{response.id}}" }
 *     }
 *   }
 * }
 */
export function ToolConfigLoader({
  tool_id,
  initial_config = {},
  on_save,
  on_cancel,
  context,
  actionRunner,
}: ToolConfigLoaderProps) {
  const { authenticatedFetch, isAuthenticated } = useAuthentication();
  const [secrets, setSecrets] = useState<any[]>([]);

  // Load tool breadcrumb (ALL HOOKS MUST BE CALLED BEFORE ANY RETURNS!)
  const toolQuery = useQuery({
    queryKey: ['tool-config-loader', tool_id],
    queryFn: async () => {
      console.log('🔧 ToolConfigLoader loading tool:', tool_id);
      
      const response = await authenticatedFetch(`/api/breadcrumbs/${tool_id}/full`);
      if (!response.ok) {
        throw new Error('Failed to load tool');
      }
      
      const tool = await response.json();
      console.log('✅ Tool loaded:', tool.title, tool.context?.ui_schema);
      return tool;
    },
    enabled: isAuthenticated && !!tool_id,
  });

  // Load secrets for the form
  useEffect(() => {
    const loadSecrets = async () => {
      try {
        const response = await authenticatedFetch('/api/secrets');
        if (response.ok) {
          setSecrets(await response.json());
        }
      } catch (error) {
        console.error('Failed to load secrets:', error);
      }
    };

    if (isAuthenticated) {
      loadSecrets();
    }
  }, [isAuthenticated, authenticatedFetch]);

  // Set up save and cancel actions
  useEffect(() => {
    if (on_save) {
      actionRunner.setNamedActions({
        ...actionRunner['namedActions'],
        saveConfig: on_save,
      });
    }
    if (on_cancel) {
      actionRunner.setNamedActions({
        ...actionRunner['namedActions'],
        cancelConfig: on_cancel,
      });
    }
  }, [on_save, on_cancel, actionRunner]);

  // NOW we can do conditional returns (after all hooks)
  if (toolQuery.isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin w-8 h-8 border-2 border-rcrt-primary border-t-transparent rounded-full mx-auto mb-4"></div>
        <p className="text-gray-400">Loading configuration...</p>
      </div>
    );
  }

  if (toolQuery.error) {
    return (
      <div className="text-red-400 p-4">
        Failed to load tool configuration: {(toolQuery.error as Error).message}
      </div>
    );
  }

  const tool = toolQuery.data;
  if (!tool) return null;

  const uiSchema = tool.context?.ui_schema;
  
  if (!uiSchema?.ui && !uiSchema?.components) {
    return (
      <div className="text-yellow-400 p-4">
        This tool has no HeroUI configuration defined.
      </div>
    );
  }

  // Enhanced context with tool info and secrets
  const enhancedContext: TemplateContext = {
    ...context,
    tool,
    data: {
      ...context.data,
      secrets,
    },
  };

  // Render the tool's UI schema
  return (
    <div className="tool-config-loader">
      {renderNode(uiSchema.ui || uiSchema.components, enhancedContext, actionRunner)}
    </div>
  );
}

