import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useSelectedNodes, useDashboard } from '../../stores/DashboardStore';
import { useAuthentication } from '../../hooks/useAuthentication';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { RenderNode, Breadcrumb } from '../../types/rcrt';
import { UIVariable, ToolConfigValue } from '../../types/toolConfig';
import { useModelsFromCatalog } from '../../hooks/useModelsFromCatalog';

export function DetailsPanel() {
  const selectedNodes = useSelectedNodes();
  const { deselectAll } = useDashboard();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const { authenticatedFetch } = useAuthentication();

  // Get the first selected node (or null)
  const node = selectedNodes[0] || null;
  
  // Load full breadcrumb context if it's a breadcrumb (always call hook)
  const breadcrumbDetailsQuery = useQuery({
    queryKey: ['breadcrumb-details', node?.id || 'none'],
    queryFn: async (): Promise<Breadcrumb | null> => {
      if (!node || node.type !== 'breadcrumb') return null;
      
      console.log('📋 Loading full breadcrumb context for:', node.id);
      
      const response = await authenticatedFetch(`/api/breadcrumbs/${node.id}`);
      if (!response.ok) {
        throw new Error(`Failed to load breadcrumb details: ${response.statusText}`);
      }
      
      const details = await response.json();
      console.log('✅ Loaded breadcrumb context:', details.context);
      return details;
    },
    enabled: node?.type === 'breadcrumb',
    staleTime: 30000, // 30 seconds
  });

  // Auto-exit edit mode when selection changes
  useEffect(() => {
    setIsEditing(false);
  }, [selectedNodes.length]);

  // Use full breadcrumb data if available, otherwise use node data
  const displayData = breadcrumbDetailsQuery.data || node?.data;
  const isLoadingContext = breadcrumbDetailsQuery.isLoading && node?.type === 'breadcrumb';

  if (selectedNodes.length === 0) {
    return (
      <motion.div
        className="details-panel p-4 h-full flex items-center justify-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="text-center text-gray-400">
          <div className="text-4xl mb-3">👆</div>
          <p className="text-lg font-medium mb-2">Select a Node</p>
          <p className="text-sm">Click on any node to view and edit its details</p>
        </div>
      </motion.div>
    );
  }

  if (selectedNodes.length > 1) {
    return (
      <motion.div
        className="details-panel p-4 h-full overflow-y-auto scrollbar-thin"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-white">📋 Multiple Selection</h3>
          <button
            onClick={deselectAll}
            className="px-3 py-1 bg-gray-500/20 border border-gray-400/50 rounded text-gray-300 text-sm hover:bg-gray-500/30 transition-colors"
          >
            Clear Selection
          </button>
        </div>
        
        <div className="space-y-2">
          <p className="text-gray-300">Selected {selectedNodes.length} nodes:</p>
          {selectedNodes.map(node => (
            <div key={node.id} className="p-3 bg-gray-800/50 rounded-lg border border-gray-600">
              <div className="flex items-center gap-2">
                <span className="text-lg">{node.metadata.icon}</span>
                <div>
                  <div className="font-medium text-white">{node.metadata.title}</div>
                  <div className="text-xs text-gray-400">{node.type}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Bulk Actions */}
        <div className="mt-6 pt-4 border-t border-gray-600">
          <h4 className="text-sm font-medium text-gray-300 mb-3">Bulk Actions</h4>
          <div className="space-y-2">
            <button className="w-full px-3 py-2 bg-blue-500/20 border border-blue-400/50 rounded text-blue-300 hover:bg-blue-500/30 transition-colors">
              📋 Export Selected
            </button>
            <button className="w-full px-3 py-2 bg-red-500/20 border border-red-400/50 rounded text-red-300 hover:bg-red-500/30 transition-colors">
              🗑️ Delete Selected
            </button>
          </div>
        </div>
      </motion.div>
    );
  }

  // Single node selected (node is already defined above)
  if (!node) return null;
  
  return (
    <motion.div
      className="details-panel p-4 h-full overflow-y-auto scrollbar-thin"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      key={node.id} // Re-animate when node changes
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <span className="text-xl">{node.metadata.icon}</span>
          <div>
            <h3 className="text-lg font-semibold text-white">{node.metadata.title}</h3>
            <p className="text-xs text-gray-400">{node.type} • ID: {node.id.substring(0, 8)}...</p>
          </div>
        </div>
        <button
          onClick={deselectAll}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-colors"
        >
          ✕
        </button>
      </div>

      {/* Node Details */}
      <div className="space-y-4">
        {/* Basic Info */}
        <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-600">
          <h4 className="text-sm font-medium text-gray-300 mb-3">📋 Basic Information</h4>
          
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-gray-400">Type:</span>
              <span className="text-white font-mono">{node.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">ID:</span>
              <span className="text-white font-mono text-xs">{node.id}</span>
            </div>
            {displayData?.version && (
              <div className="flex justify-between">
                <span className="text-gray-400">Version:</span>
                <span className="text-white">v{displayData.version}</span>
              </div>
            )}
            {displayData?.updated_at && (
              <div className="flex justify-between">
                <span className="text-gray-400">Updated:</span>
                <span className="text-white">{new Date(displayData.updated_at).toLocaleString()}</span>
              </div>
            )}
            {displayData?.schema_name && (
              <div className="flex justify-between">
                <span className="text-gray-400">Schema:</span>
                <span className="text-white font-mono text-xs">{displayData.schema_name}</span>
              </div>
            )}
          </div>
        </div>

        {/* Tags */}
        {node.metadata.tags.length > 0 && (
          <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-600">
            <h4 className="text-sm font-medium text-gray-300 mb-3">🏷️ Tags</h4>
            <div className="flex flex-wrap gap-2">
              {node.metadata.tags.map(tag => (
                <span key={tag} className="px-2 py-1 bg-blue-500/20 text-blue-300 rounded text-xs">
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Context Data */}
        <div className="bg-gray-800/30 rounded-lg p-4 border border-gray-600">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-sm font-medium text-gray-300">📄 Context Data</h4>
            {isLoadingContext && <span className="text-blue-400 text-xs">Loading...</span>}
          </div>
          
          {isLoadingContext ? (
            <div className="text-center py-4 text-gray-400">
              <div className="animate-spin w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full mx-auto mb-2"></div>
              <p className="text-xs">Loading full context...</p>
            </div>
          ) : displayData?.context && Object.keys(displayData.context).length > 0 ? (
            <pre className="text-xs text-gray-300 bg-gray-900/50 p-3 rounded border overflow-x-auto">
              {JSON.stringify(displayData.context, null, 2)}
            </pre>
          ) : (
            <div className="text-center py-4 text-gray-400">
              <p className="text-sm">No context data</p>
              <p className="text-xs">This {node.type} has no additional context</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="space-y-2">
          {node.type === 'breadcrumb' && (
            <>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="w-full px-4 py-2 bg-blue-500/20 border border-blue-400/50 rounded-lg text-blue-300 hover:bg-blue-500/30 transition-colors"
              >
                {isEditing ? '👁️ View Mode' : '✏️ Edit Mode'}
              </button>
              
              {isEditing && (
                <EditBreadcrumbForm 
                  node={node}
                  fullBreadcrumb={breadcrumbDetailsQuery.data}
                  onSave={() => setIsEditing(false)}
                  isSaving={isSaving}
                  setIsSaving={setIsSaving}
                />
              )}
            </>
          )}
          
          {node.type === 'secret' && (
            <>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="w-full px-4 py-2 bg-red-500/20 border border-red-400/50 rounded-lg text-red-300 hover:bg-red-500/30 transition-colors"
              >
                {isEditing ? '👁️ View Mode' : '🔐 Edit Secret'}
              </button>
              
              {isEditing && (
                <EditSecretForm 
                  node={node}
                  onSave={() => setIsEditing(false)}
                  isSaving={isSaving}
                  setIsSaving={setIsSaving}
                />
              )}
            </>
          )}
          
          {node.type === 'tool' && (
            <>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="w-full px-4 py-2 bg-green-500/20 border border-green-400/50 rounded-lg text-green-300 hover:bg-green-500/30 transition-colors"
                data-tour="configure-tool"
              >
                {isEditing ? '👁️ View Mode' : '🛠️ Configure Tool'}
              </button>
              
              {isEditing && (
                <EditToolForm 
                  node={node}
                  onSave={() => setIsEditing(false)}
                  isSaving={isSaving}
                  setIsSaving={setIsSaving}
                />
              )}
            </>
          )}
          
          {node.type === 'agent-definition' && (
            <>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="w-full px-4 py-2 bg-purple-500/20 border border-purple-400/50 rounded-lg text-purple-300 hover:bg-purple-500/30 transition-colors"
              >
                {isEditing ? '👁️ View Mode' : '🧠 Edit Agent'}
              </button>
              
              {isEditing && (
                <EditAgentDefinitionForm 
                  node={node}
                  fullBreadcrumb={breadcrumbDetailsQuery.data}
                  onSave={() => setIsEditing(false)}
                  isSaving={isSaving}
                  setIsSaving={setIsSaving}
                />
              )}
            </>
          )}
          
          <DeleteButton 
            node={node}
            isDeleting={isDeleting}
            setIsDeleting={setIsDeleting}
            onDelete={deselectAll}
          />
        </div>
      </div>
    </motion.div>
  );
}

// Edit Agent Definition Form
function EditAgentDefinitionForm({ node, fullBreadcrumb, onSave, isSaving, setIsSaving }: {
  node: RenderNode;
  fullBreadcrumb: Breadcrumb | null | undefined;
  onSave: () => void;
  isSaving: boolean;
  setIsSaving: (val: boolean) => void;
}) {
  const agentData = fullBreadcrumb || node.data;
  const [agentCode, setAgentCode] = useState(agentData?.context?.execution?.code || '');
  
  const { authenticatedFetch } = useAuthentication();
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const updates = {
        context: {
          ...agentData?.context,
          execution: {
            type: 'javascript',
            code: agentCode
          }
        }
      };

      const response = await authenticatedFetch(`/api/breadcrumbs/${node.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'If-Match': `${agentData?.version || 1}`,
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        console.log('✅ Agent definition updated successfully');
        queryClient.invalidateQueries({ queryKey: ['breadcrumbs'] });
        onSave();
      } else {
        const error = await response.text();
        alert(`Failed to update agent: ${error}`);
      }
    } catch (error) {
      alert(`Error: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  const getSimpleWorkingCode = () => {
    return `async function execute(triggerBreadcrumb, context) {
  console.log('🤖 SIMPLE AGENT TRIGGERED');
  
  const userMessage = triggerBreadcrumb.context.content;
  const response = \`Hello! You said: "\${userMessage}". I'm working!\`;
  
  await context.rcrtClient.createBreadcrumb({
    schema_name: 'agent.response.v1',
    title: 'Simple Response',
    tags: ['agent:response', 'chat:response'],
    context: {
      content: response,
      response_to: triggerBreadcrumb.id
    }
  });
  
  return { response };
}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-4 p-4 bg-gray-900/50 rounded-lg border border-gray-600"
    >
      <h5 className="text-sm font-medium text-white mb-3">🧠 Edit Agent Code</h5>
      
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Agent Code (JavaScript)</label>
          <textarea
            value={agentCode}
            onChange={(e) => setAgentCode(e.target.value)}
            rows={10}
            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded text-white text-xs font-mono focus:border-purple-400 focus:outline-none"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 px-3 py-2 bg-purple-500/20 border border-purple-400/50 rounded text-purple-300 text-sm hover:bg-purple-500/30 transition-colors disabled:opacity-50"
          >
            {isSaving ? '⏳ Saving...' : '💾 Save Agent'}
          </button>
          <button
            type="button"
            onClick={() => setAgentCode(getSimpleWorkingCode())}
            className="px-3 py-2 bg-green-500/20 border border-green-400/50 rounded text-green-300 text-sm hover:bg-green-500/30 transition-colors"
          >
            📝 Simple Code
          </button>
        </div>
      </form>
    </motion.div>
  );
}

// Delete Button Component
function DeleteButton({ node, isDeleting, setIsDeleting, onDelete }: {
  node: RenderNode;
  isDeleting: boolean;
  setIsDeleting: (val: boolean) => void;
  onDelete: () => void;
}) {
  const { authenticatedFetch } = useAuthentication();
  const queryClient = useQueryClient();

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${node.metadata.title}"?`)) {
      return;
    }

    setIsDeleting(true);

    try {
      let endpoint = '';
      let queryKey = '';

      switch (node.type) {
        case 'breadcrumb':
        case 'agent-definition':
        case 'chat':
          // Agent definitions are breadcrumbs, so use breadcrumb endpoint
          endpoint = `/api/breadcrumbs/${node.id}`;
          queryKey = 'breadcrumbs';
          break;
        case 'agent':
          endpoint = `/api/agents/${node.id}`;
          queryKey = 'agents';
          break;
        case 'secret':
          endpoint = `/api/secrets/${node.id}`;
          queryKey = 'secrets';
          break;
        case 'tool':
          // Tools are from catalog, cannot be deleted directly
          throw new Error(`Tools are managed via tool catalog and cannot be deleted individually`);
        default:
          throw new Error(`Cannot delete ${node.type}`);
      }

      console.log(`🗑️ Deleting ${node.type}:`, node.id);

      const response = await authenticatedFetch(endpoint, {
        method: 'DELETE',
      });

      if (response.ok) {
        console.log(`✅ ${node.type} deleted successfully`);
        
        // Refresh data and clear selection
        queryClient.invalidateQueries({ queryKey: [queryKey] });
        onDelete();
      } else {
        const error = await response.text();
        console.error(`❌ Failed to delete ${node.type}:`, error);
        alert(`Failed to delete: ${error}`);
      }
    } catch (error) {
      console.error(`❌ Error deleting ${node.type}:`, error);
      alert(`Error: ${error}`);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className="w-full px-4 py-2 bg-red-500/20 border border-red-400/50 rounded-lg text-red-300 hover:bg-red-500/30 transition-colors disabled:opacity-50"
    >
      {isDeleting ? '⏳ Deleting...' : '🗑️ Delete'}
    </button>
  );
}

// Edit Secret Form
function EditSecretForm({ node, onSave, isSaving, setIsSaving }: {
  node: RenderNode;
  onSave: () => void;
  isSaving: boolean;
  setIsSaving: (val: boolean) => void;
}) {
  const [newValue, setNewValue] = useState('');
  const [showCurrentValue, setShowCurrentValue] = useState(false);
  const [currentValue, setCurrentValue] = useState('');
  const { authenticatedFetch } = useAuthentication();
  const queryClient = useQueryClient();

  // Load current secret value
  const loadCurrentValue = async () => {
    try {
      console.log('🔐 Loading current secret value for:', node.id);
      
      const response = await authenticatedFetch(`/api/secrets/${node.id}/decrypt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Dashboard editing' }),
      });

      if (response.ok) {
        const result = await response.json();
        setCurrentValue(result.value);
        setNewValue(result.value); // Pre-fill with current value
        setShowCurrentValue(true);
        console.log('✅ Secret value loaded');
      } else {
        const error = await response.text();
        console.error('❌ Failed to load secret value:', error);
        alert(`Failed to load secret: ${error}`);
      }
    } catch (error) {
      console.error('❌ Error loading secret:', error);
      alert(`Error: ${error}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newValue.trim()) return;
    
    setIsSaving(true);

    try {
      const updates = { value: newValue };

      console.log('🔐 Updating secret:', node.id);

      const response = await authenticatedFetch(`/api/secrets/${node.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        console.log('✅ Secret updated successfully');
        
        // Refresh data
        queryClient.invalidateQueries({ queryKey: ['secrets'] });
        onSave();
        
        // Reset form
        setNewValue('');
        setCurrentValue('');
        setShowCurrentValue(false);
      } else {
        const error = await response.text();
        console.error('❌ Failed to update secret:', error);
        alert(`Failed to update secret: ${error}`);
      }
    } catch (error) {
      console.error('❌ Error updating secret:', error);
      alert(`Error: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-4 p-4 bg-gray-900/50 rounded-lg border border-gray-600"
    >
      <h5 className="text-sm font-medium text-white mb-3">🔐 Edit Secret</h5>
      
      {!showCurrentValue ? (
        <div className="text-center py-4">
          <p className="text-gray-300 text-sm mb-3">
            Load current value to edit this secret
          </p>
          <button
            onClick={loadCurrentValue}
            className="px-4 py-2 bg-red-500/20 border border-red-400/50 rounded text-red-300 hover:bg-red-500/30 transition-colors"
          >
            🔓 Load Current Value
          </button>
          <p className="text-xs text-gray-500 mt-2">
            This action will be audited
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Secret Name</label>
            <input
              type="text"
              value={node.metadata.title}
              disabled
              className="w-full px-3 py-2 bg-gray-700/50 border border-gray-500 rounded text-gray-400 text-sm cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">Secret name cannot be changed</p>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">Current Value</label>
            <div className="relative">
              <input
                type="password"
                value={currentValue}
                disabled
                className="w-full px-3 py-2 bg-gray-700/50 border border-gray-500 rounded text-gray-300 text-sm font-mono"
              />
              <button
                type="button"
                onClick={() => {
                  const input = document.querySelector('input[value="' + currentValue + '"]') as HTMLInputElement;
                  if (input) {
                    input.type = input.type === 'password' ? 'text' : 'password';
                  }
                }}
                className="absolute right-2 top-2 text-gray-400 hover:text-white"
              >
                👁️
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-400 mb-1">New Value *</label>
            <textarea
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded text-white text-sm font-mono focus:border-red-400 focus:outline-none"
              placeholder="Enter new secret value..."
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={!newValue.trim() || isSaving}
              className="flex-1 px-3 py-2 bg-red-500/20 border border-red-400/50 rounded text-red-300 text-sm hover:bg-red-500/30 transition-colors disabled:opacity-50"
            >
              {isSaving ? '⏳ Updating...' : '💾 Update Secret'}
            </button>
            <button
              type="button"
              onClick={() => {
                setNewValue('');
                setCurrentValue('');
                setShowCurrentValue(false);
                onSave();
              }}
              className="px-3 py-2 bg-gray-500/20 border border-gray-400/50 rounded text-gray-300 text-sm hover:bg-gray-500/30 transition-colors"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </motion.div>
  );
}

// Edit Breadcrumb Form
function EditBreadcrumbForm({ node, fullBreadcrumb, onSave, isSaving, setIsSaving }: {
  node: RenderNode;
  fullBreadcrumb: Breadcrumb | null | undefined;
  onSave: () => void;
  isSaving: boolean;
  setIsSaving: (val: boolean) => void;
}) {
  const [title, setTitle] = useState(fullBreadcrumb?.title || node.metadata.title);
  const [context, setContext] = useState(JSON.stringify(fullBreadcrumb?.context || {}, null, 2));
  const [tags, setTags] = useState((fullBreadcrumb?.tags || node.metadata.tags).join(', '));
  
  // Update form when full breadcrumb data loads
  useEffect(() => {
    if (fullBreadcrumb) {
      setTitle(fullBreadcrumb.title);
      setContext(JSON.stringify(fullBreadcrumb.context || {}, null, 2));
      setTags((fullBreadcrumb.tags || []).join(', '));
    }
  }, [fullBreadcrumb]);
  const { authenticatedFetch } = useAuthentication();
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      let parsedContext = {};
      if (context.trim()) {
        parsedContext = JSON.parse(context);
      }

      const updates = {
        title,
        context: parsedContext,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
      };

      console.log('✏️ Updating breadcrumb:', node.id, updates);

      const response = await authenticatedFetch(`/api/breadcrumbs/${node.id}`, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'If-Match': `${node.data?.version || 1}`,
        },
        body: JSON.stringify(updates),
      });

      if (response.ok) {
        console.log('✅ Breadcrumb updated successfully');
        
        // Refresh data
        queryClient.invalidateQueries({ queryKey: ['breadcrumbs'] });
        onSave();
      } else {
        const error = await response.text();
        console.error('❌ Failed to update breadcrumb:', error);
        alert(`Failed to update: ${error}`);
      }
    } catch (error) {
      console.error('❌ Error updating breadcrumb:', error);
      alert(`Error: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-4 p-4 bg-gray-900/50 rounded-lg border border-gray-600"
    >
      <h5 className="text-sm font-medium text-white mb-3">✏️ Edit Breadcrumb</h5>
      
      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded text-white text-sm focus:border-blue-400 focus:outline-none"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Tags</label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded text-white text-sm focus:border-blue-400 focus:outline-none"
            placeholder="tag1, tag2, tag3"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-400 mb-1">Context (JSON)</label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded text-white text-xs font-mono focus:border-blue-400 focus:outline-none"
          />
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={isSaving}
            className="flex-1 px-3 py-2 bg-blue-500/20 border border-blue-400/50 rounded text-blue-300 text-sm hover:bg-blue-500/30 transition-colors disabled:opacity-50"
          >
            {isSaving ? '⏳ Saving...' : '💾 Save Changes'}
          </button>
          <button
            type="button"
            onClick={() => setIsEditing(false)}
            className="px-3 py-2 bg-gray-500/20 border border-gray-400/50 rounded text-gray-300 text-sm hover:bg-gray-500/30 transition-colors"
          >
            Cancel
          </button>
        </div>
      </form>
    </motion.div>
  );
}

// Edit Tool Configuration Form
function EditToolForm({ node, onSave, isSaving, setIsSaving }: {
  node: RenderNode;
  onSave: () => void;
  isSaving: boolean;
  setIsSaving: (val: boolean) => void;
}) {
  const [config, setConfig] = useState<ToolConfigValue>({});
  const [secrets, setSecrets] = useState<any[]>([]);
  const { authenticatedFetch, isAuthenticated } = useAuthentication();
  const queryClient = useQueryClient();
  
  // Fetch models from catalog for OpenRouter
  const { data: modelOptions = [], isLoading: isLoadingModels } = useModelsFromCatalog();

  // Get tool UI variables based on tool name or schema
  const getToolUIVariables = (toolNameOrSchema: string): UIVariable[] => {
    const name = toolNameOrSchema.toLowerCase();
    
    // Handle context.config.v1 breadcrumbs (check schema or tags)
    const isContextConfig = node.data?.schema_name === 'context.config.v1' || 
                           node.metadata.tags.includes('context:config') ||
                           name === 'context.config.v1' || 
                           name.includes('context config');
    
    if (isContextConfig) {
      return getContextBuilderUIVariables();
    }
    
    switch (name) {
      case 'context-builder':
      case 'context_builder':
        return getContextBuilderUIVariables();
        
      case 'openrouter':
        return [
          {
            key: 'apiKey',
            label: 'API Key',
            type: 'secret',
            secretName: 'OPENROUTER_API_KEY',
            description: 'OpenRouter API key for authentication',
            required: true,
          },
          {
            key: 'defaultModel',
            label: 'Default Model',
            type: 'select',
            description: 'Default model when none specified',
            defaultValue: 'google/gemini-2.5-flash',
            options: modelOptions,
          },
          {
            key: 'maxTokens',
            label: 'Max Tokens',
            type: 'number',
            description: 'Maximum tokens per response',
            defaultValue: 4000,
            validation: { min: 1, max: 32000 },
          },
          {
            key: 'temperature',
            label: 'Temperature',
            type: 'number',
            description: 'Response creativity (0.0 - 2.0)',
            defaultValue: 0.7,
            validation: { min: 0, max: 2 },
          },
        ];
        
      case 'ollama_local':
        return [
          {
            key: 'endpoint',
            label: 'Ollama Endpoint',
            type: 'string',
            description: 'Local Ollama server endpoint',
            defaultValue: 'http://localhost:11434',
          },
          {
            key: 'defaultModel',
            label: 'Default Model',
            type: 'string',
            description: 'Default Ollama model',
            defaultValue: 'llama3.1',
          },
        ];
        
      case 'web_browser':
        return [
          {
            key: 'userAgent',
            label: 'User Agent',
            type: 'string',
            description: 'Browser user agent string',
            defaultValue: 'RCRT-WebBrowser/1.0',
          },
          {
            key: 'timeout',
            label: 'Request Timeout (ms)',
            type: 'number',
            description: 'HTTP request timeout',
            defaultValue: 30000,
            validation: { min: 1000, max: 120000 },
          },
        ];
        
      default:
        return [
          {
            key: 'enabled',
            label: 'Enabled',
            type: 'boolean',
            description: 'Whether this tool is enabled',
            defaultValue: true,
          },
        ];
    }
  };
  
  // Context Builder UI Variables
  const getContextBuilderUIVariables = (): UIVariable[] => {
    return [
      {
        key: 'strategy',
        label: 'Context Strategy',
        type: 'select',
        description: 'How to assemble context',
        defaultValue: 'hybrid',
        options: [
          { value: 'hybrid', label: 'Hybrid (Recent + Semantic)' },
          { value: 'recent', label: 'Recent Only' },
          { value: 'semantic', label: 'Semantic Only' }
        ]
      },
      {
        key: 'recent_user_limit',
        label: 'Recent User Messages',
        type: 'number',
        description: 'Recent user messages to include',
        defaultValue: 20,
        validation: { min: 0, max: 50 }
      },
      {
        key: 'vector_user_nn',
        label: 'Semantic User Messages',
        type: 'number',
        description: 'Semantically relevant user messages',
        defaultValue: 10,
        validation: { min: 0, max: 50 }
      },
      {
        key: 'recent_agent_limit',
        label: 'Recent Agent Responses',
        type: 'number',
        description: 'Recent agent responses to include',
        defaultValue: 20,
        validation: { min: 0, max: 50 }
      },
      {
        key: 'vector_agent_nn',
        label: 'Semantic Agent Responses',
        type: 'number',
        description: 'Semantically relevant agent responses',
        defaultValue: 10,
        validation: { min: 0, max: 50 }
      },
      {
        key: 'max_tokens',
        label: 'Token Budget',
        type: 'number',
        description: 'Maximum context size (gemini-2.5-flash-lite supports up to 1M)',
        defaultValue: 400000,
        validation: { min: 1000, max: 1000000 }
      },
      {
        key: 'deduplication_threshold',
        label: 'Deduplication Threshold',
        type: 'number',
        description: 'Similarity for deduplication (0.80-0.99)',
        defaultValue: 0.95,
        validation: { min: 0.80, max: 0.99 }
      },
      {
        key: 'context_ttl',
        label: 'Context TTL (seconds)',
        type: 'number',
        description: 'How long to cache context',
        defaultValue: 3600,
        validation: { min: 300, max: 7200 }
      },
      {
        key: 'include_metadata',
        label: 'Include Metadata',
        type: 'boolean',
        description: 'Include timestamps and IDs',
        defaultValue: false
      }
    ];
  };

  const uiVariables = getToolUIVariables(node.metadata.title);

  // Load current configuration only after authentication
  useEffect(() => {
    if (isAuthenticated) {
      loadToolConfig();
      loadSecrets();
    }
  }, [node.id, isAuthenticated]);

  const loadSecrets = async () => {
    try {
      const response = await authenticatedFetch('/api/secrets');
      if (response.ok) {
        const secretsList = await response.json();
        setSecrets(secretsList);
      }
    } catch (error) {
      console.warn('Failed to load secrets:', error);
    }
  };

  const loadToolConfig = async () => {
    try {
      console.log('🛠️ Loading tool configuration for:', node.metadata.title);
      
      // Search for tool config breadcrumb
      const response = await authenticatedFetch('/api/breadcrumbs');
      if (!response.ok) return;
      
      const breadcrumbs = await response.json();
      
      // Check if this is a context-builder tool or context.config.v1 breadcrumb
      const isContextBuilderTool = node.metadata.title.toLowerCase() === 'context-builder' || 
                                    node.metadata.title.toLowerCase() === 'context_builder';
      const isContextConfig = node.data?.schema_name === 'context.config.v1' || 
                              node.metadata.tags.includes('context:config');
      
      const configBreadcrumb = breadcrumbs.find((b: Breadcrumb) => {
        if (isContextBuilderTool || isContextConfig) {
          // For context-builder tool or context configs, look for context:config tag
          return b.tags?.includes('context:config') && b.schema_name === 'context.config.v1';
        } else {
          // For other tools, look for tool:config tag
          return b.tags?.includes(`tool:config:${node.metadata.title}`) ||
                 (b.tags?.includes('tool:config') && b.title?.includes(node.metadata.title));
        }
      });
      
      if (configBreadcrumb) {
        console.log('✅ Found config breadcrumb:', configBreadcrumb.id);
        
        // Load full context
        const detailResponse = await authenticatedFetch(`/api/breadcrumbs/${configBreadcrumb.id}`);
        if (detailResponse.ok) {
          const detail = await detailResponse.json();
          
          if (isContextBuilderTool || isContextConfig) {
            // For context-builder tool or context configs, read values from nested structure
            const loadedConfig: ToolConfigValue = {};
            const ctx = detail.context;
            
            // Read from sources array
            if (ctx?.sources && Array.isArray(ctx.sources)) {
              const recentUserSource = ctx.sources.find(s => 
                s.schema_name === 'user.message.v1' && s.method === 'recent'
              );
              const vectorUserSource = ctx.sources.find(s => 
                s.schema_name === 'user.message.v1' && s.method === 'vector'
              );
              const recentAgentSource = ctx.sources.find(s => 
                s.schema_name === 'agent.response.v1' && s.method === 'recent'
              );
              const vectorAgentSource = ctx.sources.find(s => 
                s.schema_name === 'agent.response.v1' && s.method === 'vector'
              );
              
              loadedConfig.recent_user_limit = recentUserSource?.limit ?? 20;
              loadedConfig.vector_user_nn = vectorUserSource?.nn ?? 10;
              loadedConfig.recent_agent_limit = recentAgentSource?.limit ?? 20;
              loadedConfig.vector_agent_nn = vectorAgentSource?.nn ?? 10;
            }
            
            // Read from formatting object
            if (ctx?.formatting) {
              loadedConfig.max_tokens = ctx.formatting.max_tokens ?? 400000;
              loadedConfig.deduplication_threshold = ctx.formatting.deduplication_threshold ?? 0.95;
              loadedConfig.include_metadata = ctx.formatting.include_metadata ?? false;
            }
            
            // Read TTL and strategy
            loadedConfig.context_ttl = ctx?.output?.ttl_seconds ?? 3600;
            loadedConfig.strategy = ctx?.strategy ?? 'hybrid';
            
            setConfig(loadedConfig);
            console.log('🏗️ Loaded context config from nested structure:', loadedConfig);
          } else {
            // For other tools, read from context.config
            if (detail.context?.config) {
              setConfig(detail.context.config);
              console.log('🛠️ Loaded tool config:', detail.context.config);
            }
          }
        }
      } else {
        // Initialize with defaults
        const defaultConfig: ToolConfigValue = {};
        uiVariables.forEach(variable => {
          defaultConfig[variable.key] = variable.defaultValue;
        });
        setConfig(defaultConfig);
      }
    } catch (error) {
      console.warn('Failed to load tool config:', error);
    }
  };

  const handleSaveConfig = async () => {
    setIsSaving(true);

    try {
      // Check if this is a context-builder tool or context.config.v1 breadcrumb
      const isContextBuilderTool = node.metadata.title.toLowerCase() === 'context-builder' || 
                                    node.metadata.title.toLowerCase() === 'context_builder';
      const isContextConfig = node.data?.schema_name === 'context.config.v1' || 
                              node.metadata.tags.includes('context:config');
      
      if (isContextBuilderTool || isContextConfig) {
        // For context-builder tool or context configs, find and update the context.config.v1 breadcrumb
        const searchResponse = await authenticatedFetch('/api/breadcrumbs');
        if (!searchResponse.ok) {
          throw new Error('Failed to search for config breadcrumb');
        }
        
        const breadcrumbs = await searchResponse.json();
        const contextConfigBreadcrumb = breadcrumbs.find((b: Breadcrumb) => 
          b.tags?.includes('context:config') && b.schema_name === 'context.config.v1'
        );
        
        if (!contextConfigBreadcrumb) {
          throw new Error('Context config breadcrumb not found. Create one first using the bootstrap.');
        }
        
        // Load full context to get current version
        const detailResponse = await authenticatedFetch(`/api/breadcrumbs/${contextConfigBreadcrumb.id}`);
        if (!detailResponse.ok) {
          throw new Error('Failed to load config breadcrumb details');
        }
        const fullConfig = await detailResponse.json();
        
        // Map UI values to the nested structure that context-builder expects
        const updatedContext = {
          ...fullConfig.context,
          lastUpdated: new Date().toISOString(),
        };
        
        // Update sources array with new limits
        if (updatedContext.sources && Array.isArray(updatedContext.sources)) {
          // Update recent user messages limit
          const recentUserSource = updatedContext.sources.find(s => 
            s.schema_name === 'user.message.v1' && s.method === 'recent'
          );
          if (recentUserSource && config.recent_user_limit !== undefined) {
            recentUserSource.limit = Number(config.recent_user_limit);
          }
          
          // Update vector user messages nn
          const vectorUserSource = updatedContext.sources.find(s => 
            s.schema_name === 'user.message.v1' && s.method === 'vector'
          );
          if (vectorUserSource && config.vector_user_nn !== undefined) {
            vectorUserSource.nn = Number(config.vector_user_nn);
          }
          
          // Update recent agent responses limit
          const recentAgentSource = updatedContext.sources.find(s => 
            s.schema_name === 'agent.response.v1' && s.method === 'recent'
          );
          if (recentAgentSource && config.recent_agent_limit !== undefined) {
            recentAgentSource.limit = Number(config.recent_agent_limit);
          }
          
          // Update vector agent responses nn
          const vectorAgentSource = updatedContext.sources.find(s => 
            s.schema_name === 'agent.response.v1' && s.method === 'vector'
          );
          if (vectorAgentSource && config.vector_agent_nn !== undefined) {
            vectorAgentSource.nn = Number(config.vector_agent_nn);
          }
        }
        
        // Update formatting object
        if (updatedContext.formatting) {
          if (config.max_tokens !== undefined) {
            updatedContext.formatting.max_tokens = Number(config.max_tokens);
          }
          if (config.deduplication_threshold !== undefined) {
            updatedContext.formatting.deduplication_threshold = Number(config.deduplication_threshold);
          }
          if (config.include_metadata !== undefined) {
            updatedContext.formatting.include_metadata = Boolean(config.include_metadata);
          }
        }
        
        // Update context TTL
        if (config.context_ttl !== undefined) {
          updatedContext.output = updatedContext.output || {};
          updatedContext.output.ttl_seconds = Number(config.context_ttl);
        }
        
        // Update strategy
        if (config.strategy !== undefined) {
          updatedContext.strategy = config.strategy;
        }
        
        console.log('🏗️ Saving context config:', updatedContext);
        
        const response = await authenticatedFetch(`/api/breadcrumbs/${contextConfigBreadcrumb.id}`, {
          method: 'PATCH',
          headers: { 
            'Content-Type': 'application/json',
            'If-Match': `${fullConfig.version || 1}`,
          },
          body: JSON.stringify({ context: updatedContext }),
        });
        
        if (response.ok) {
          console.log('✅ Context config saved successfully');
          queryClient.invalidateQueries({ queryKey: ['breadcrumbs'] });
          onSave();
        } else {
          const error = await response.text();
          console.error('❌ Failed to save context config:', error);
          alert(`Failed to save config: ${error}`);
        }
      } else {
        // For tool configs, create/update separate config breadcrumb
        const configBreadcrumb = {
          title: `${node.metadata.title} Configuration`,
          context: {
            config,
            toolName: node.metadata.title,
            lastUpdated: new Date().toISOString(),
          },
          tags: [`tool:config:${node.metadata.title}`, 'tool:config', 'dashboard:v2'],
          schema_name: 'tool.config.v1',
        };

        console.log('🛠️ Saving tool config:', configBreadcrumb);

        // Check if config breadcrumb already exists
        const searchResponse = await authenticatedFetch('/api/breadcrumbs');
        if (searchResponse.ok) {
          const breadcrumbs = await searchResponse.json();
          const existing = breadcrumbs.find((b: Breadcrumb) => 
            b.tags?.includes(`tool:config:${node.metadata.title}`)
          );

          let response;
          if (existing) {
            // Update existing
            response = await authenticatedFetch(`/api/breadcrumbs/${existing.id}`, {
              method: 'PATCH',
              headers: { 
                'Content-Type': 'application/json',
                'If-Match': `${existing.version || 1}`,
              },
              body: JSON.stringify(configBreadcrumb),
            });
          } else {
            // Create new
            response = await authenticatedFetch('/api/breadcrumbs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(configBreadcrumb),
            });
          }

          if (response.ok) {
            console.log('✅ Tool config saved successfully');
            queryClient.invalidateQueries({ queryKey: ['breadcrumbs'] });
            onSave();
          } else {
            const error = await response.text();
            console.error('❌ Failed to save tool config:', error);
            alert(`Failed to save config: ${error}`);
          }
        }
      }
    } catch (error) {
      console.error('❌ Error saving tool config:', error);
      alert(`Error: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  const updateConfigValue = (key: string, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
      className="mt-4 p-4 bg-gray-900/50 rounded-lg border border-gray-600"
    >
      <h5 className="text-sm font-medium text-white mb-3">🛠️ Configure {node.metadata.title}</h5>
      
      <div className="space-y-4">
        {uiVariables.map(variable => (
          <div key={variable.key}>
            <label className="block text-xs font-medium text-gray-400 mb-1">
              {variable.label}
              {variable.required && <span className="text-red-400 ml-1">*</span>}
            </label>
            
            {variable.description && (
              <p className="text-xs text-gray-500 mb-2">{variable.description}</p>
            )}
            
            {variable.type === 'string' && (
              <input
                type="text"
                value={config[variable.key] || variable.defaultValue || ''}
                onChange={(e) => updateConfigValue(variable.key, e.target.value)}
                className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded text-white text-sm focus:border-green-400 focus:outline-none"
                placeholder={variable.defaultValue?.toString()}
              />
            )}
            
            {variable.type === 'number' && (
              <input
                type="number"
                value={config[variable.key] || variable.defaultValue || 0}
                onChange={(e) => updateConfigValue(variable.key, parseFloat(e.target.value))}
                min={variable.validation?.min}
                max={variable.validation?.max}
                className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded text-white text-sm focus:border-green-400 focus:outline-none"
              />
            )}
            
            {variable.type === 'boolean' && (
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={config[variable.key] ?? variable.defaultValue ?? false}
                  onChange={(e) => updateConfigValue(variable.key, e.target.checked)}
                  className="rounded border-gray-600 bg-gray-800 text-green-400"
                />
                <span className="text-sm text-gray-300">
                  {config[variable.key] ?? variable.defaultValue ? 'Enabled' : 'Disabled'}
                </span>
              </label>
            )}
            
            {variable.type === 'select' && (
              <div>
                <select
                  value={config[variable.key] || variable.defaultValue || ''}
                  onChange={(e) => updateConfigValue(variable.key, e.target.value)}
                  className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded text-white text-sm focus:border-green-400 focus:outline-none"
                  disabled={variable.key === 'defaultModel' && isLoadingModels}
                >
                  {variable.key === 'defaultModel' && isLoadingModels ? (
                    <option>Loading models...</option>
                  ) : variable.options && variable.options.length > 0 ? (
                    variable.options.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))
                  ) : (
                    <option>No models available</option>
                  )}
                </select>
                {variable.key === 'defaultModel' && !isLoadingModels && (!variable.options || variable.options.length === 0) && (
                  <p className="text-xs text-yellow-400 mt-1">
                    💡 Models catalog will be created when the tools service starts
                  </p>
                )}
              </div>
            )}
            
            {variable.type === 'secret' && (
              <div className="space-y-2">
                 <select
                   value={config[variable.key] || ''}
                   onChange={(e) => updateConfigValue(variable.key, e.target.value)}
                   className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded text-white text-sm focus:border-green-400 focus:outline-none"
                   data-tour={variable.key === 'apiKey' && node.data?.id === 'openrouter' ? 'select-secret' : undefined}
                 >
                   <option value="">Select a secret...</option>
                   {secrets.map(secret => (
                     <option key={secret.id} value={secret.id}>
                       {secret.name} ({secret.scope_type})
                     </option>
                   ))}
                 </select>
                 
                 {/* Show which secret is recommended */}
                 {variable.secretName && (
                   <div className="mt-1">
                     {secrets.find(s => s.name === variable.secretName) ? (
                       <p className="text-xs text-green-400">
                         ✅ Found recommended secret: {variable.secretName}
                       </p>
                     ) : (
                       <p className="text-xs text-yellow-400">
                         💡 Recommended secret name: {variable.secretName}
                       </p>
                     )}
                   </div>
                 )}
              </div>
            )}
          </div>
        ))}
        
        <div className="flex gap-2 pt-4 border-t border-gray-600">
          <button
            onClick={handleSaveConfig}
            disabled={isSaving}
            className="flex-1 px-3 py-2 bg-green-500/20 border border-green-400/50 rounded text-green-300 text-sm hover:bg-green-500/30 transition-colors disabled:opacity-50"
          >
            {isSaving ? '⏳ Saving...' : '💾 Save Configuration'}
          </button>
          <button
            onClick={() => {
              loadToolConfig(); // Reset to saved config
            }}
            className="px-3 py-2 bg-gray-500/20 border border-gray-400/50 rounded text-gray-300 text-sm hover:bg-gray-500/30 transition-colors"
          >
            🔄 Reset
          </button>
          <button
            onClick={onSave}
            className="px-3 py-2 bg-gray-500/20 border border-gray-400/50 rounded text-gray-300 text-sm hover:bg-gray-500/30 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </motion.div>
  );
}

