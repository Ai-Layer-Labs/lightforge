import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useAuthentication } from '../../hooks/useAuthentication';
import { useQueryClient } from '@tanstack/react-query';
import { CreateAgentForm } from './CreateAgentForm';

export function CreatePanel() {
  const [activeForm, setActiveForm] = useState<'breadcrumb' | 'secret' | 'agent' | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  
  // Debug logging
  React.useEffect(() => {
    console.log('📋 CreatePanel activeForm changed to:', activeForm);
  }, [activeForm]);

  const quickCreateOptions = [
    { 
      id: 'chat', 
      icon: '💬', 
      label: 'Chat Message',
      color: 'bg-green-400/20 border-green-400/40 text-green-400',
      schema: 'chat.message.v1',
      tags: ['chat:message', 'user:input']
    },
    { 
      id: 'agent-def', 
      icon: '🤖', 
      label: 'Agent Definition',
      color: 'bg-purple-400/20 border-purple-400/40 text-purple-400',
      schema: 'agent.definition.v1',
      tags: ['agent:definition', 'workspace:agents']
    },
    { 
      id: 'tool-request', 
      icon: '🛠️', 
      label: 'Tool Request',
      color: 'bg-orange-400/20 border-orange-400/40 text-orange-400',
      schema: 'tool.request.v1',
      tags: ['tool:request', 'workspace:tools']
    },
    { 
      id: 'config', 
      icon: '⚙️', 
      label: 'Configuration',
      color: 'bg-blue-400/20 border-blue-400/40 text-blue-400',
      schema: 'dashboard.config.v1',
      tags: ['dashboard:config', 'system:config']
    },
  ];

  const handleQuickCreate = (option: typeof quickCreateOptions[0]) => {
    console.log('🚀 Quick create:', option.label);
    
    if (option.id === 'agent-def') {
      console.log('🤖 Switching to agent form');
      setActiveForm('agent');
    } else {
      // Pre-fill the breadcrumb form with the quick create data
      setActiveForm('breadcrumb');
    }
  };

  return (
    <motion.div
      className="create-panel p-4 h-full overflow-y-auto scrollbar-thin"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      <h3 className="text-lg font-semibold text-white mb-4">➕ Create New</h3>
      
      {!activeForm && (
        <>
          {/* Quick Create Buttons */}
          <div className="mb-6">
            <h4 className="text-sm font-medium text-gray-300 mb-3">Quick Create</h4>
            <div className="grid grid-cols-2 gap-2">
              {quickCreateOptions.map(option => (
                <motion.button
                  key={option.id}
                  className={`p-3 rounded-lg border text-sm font-medium transition-colors ${option.color}`}
                  onClick={() => handleQuickCreate(option)}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <div className="text-lg mb-1">{option.icon}</div>
                  <div className="text-xs">{option.label}</div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Manual Create Options */}
          <div>
            <h4 className="text-sm font-medium text-gray-300 mb-3">Manual Create</h4>
            <div className="space-y-2">
              <CreateButton 
                icon="📋" 
                label="Custom Breadcrumb" 
                description="Create a breadcrumb with custom fields"
                color="bg-blue-500/20 border-blue-400/50 text-blue-300"
                onClick={() => setActiveForm('breadcrumb')}
              />
              <CreateButton 
                icon="🔐" 
                label="Secret" 
                description="Store encrypted secrets"
                color="bg-red-500/20 border-red-400/50 text-red-300"
                onClick={() => setActiveForm('secret')}
                dataTour="create-secret"
              />
              <CreateButton 
                icon="🤖" 
                label="Agent Definition" 
                description="Create intelligent agents with triggers"
                color="bg-purple-500/20 border-purple-400/50 text-purple-300"
                onClick={() => setActiveForm('agent')}
              />
            </div>
          </div>
        </>
      )}

      {/* Forms */}
      {activeForm === 'breadcrumb' && (
        <CreateBreadcrumbForm 
          onBack={() => setActiveForm(null)}
          isCreating={isCreating}
          setIsCreating={setIsCreating}
        />
      )}
      
      {activeForm === 'secret' && (
        <CreateSecretForm 
          onBack={() => setActiveForm(null)}
          isCreating={isCreating}
          setIsCreating={setIsCreating}
        />
      )}
      
      {activeForm === 'agent' && (
        <CreateAgentForm 
          onBack={() => setActiveForm(null)}
          isCreating={isCreating}
          setIsCreating={setIsCreating}
        />
      )}
    </motion.div>
  );
}

function CreateButton({ icon, label, description, color, onClick, dataTour }: {
  icon: string;
  label: string;
  description: string;
  color: string;
  onClick: () => void;
  dataTour?: string;
}) {
  return (
    <motion.button
      className={`w-full p-3 rounded-lg border text-left transition-colors ${color}`}
      onClick={onClick}
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      data-tour={dataTour}
    >
      <div className="flex items-center gap-3">
        <span className="text-xl">{icon}</span>
        <div>
          <div className="font-medium">{label}</div>
          <div className="text-xs opacity-75">{description}</div>
        </div>
      </div>
    </motion.button>
  );
}

// Breadcrumb Creation Form
function CreateBreadcrumbForm({ onBack, isCreating, setIsCreating }: { 
  onBack: () => void; 
  isCreating: boolean; 
  setIsCreating: (val: boolean) => void; 
}) {
  const [title, setTitle] = useState('');
  const [context, setContext] = useState('{\n  \n}');
  const [tags, setTags] = useState('');
  const [schemaName, setSchemaName] = useState('');
  const { authenticatedFetch } = useAuthentication();
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      let parsedContext = {};
      if (context.trim() && context.trim() !== '{}') {
        parsedContext = JSON.parse(context);
      }

      const breadcrumb = {
        title,
        context: parsedContext,
        tags: tags.split(',').map(t => t.trim()).filter(Boolean),
        schema_name: schemaName || undefined,
      };

      console.log('📋 Creating breadcrumb:', breadcrumb);

      const response = await authenticatedFetch('/api/breadcrumbs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(breadcrumb),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Breadcrumb created successfully:', result.id);
        
        // Reset form
        setTitle('');
        setContext('{\n  \n}');
        setTags('');
        setSchemaName('');
        
        // Refresh data
        queryClient.invalidateQueries({ queryKey: ['breadcrumbs'] });
        
        // Go back to main panel
        setTimeout(() => onBack(), 1000);
      } else {
        const error = await response.text();
        console.error('❌ Failed to create breadcrumb:', error);
        alert(`Failed to create breadcrumb: ${error}`);
      }
    } catch (error) {
      console.error('❌ Error creating breadcrumb:', error);
      alert(`Error: ${error}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={onBack}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-colors"
        >
          ←
        </button>
        <h4 className="text-lg font-semibold text-white">📋 Create Breadcrumb</h4>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Title *</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none"
            placeholder="Enter breadcrumb title"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Tags (comma-separated)</label>
          <input
            type="text"
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none"
            placeholder="tag1, tag2, workspace:test"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Schema Name (optional)</label>
          <input
            type="text"
            value={schemaName}
            onChange={(e) => setSchemaName(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none"
            placeholder="schema.name.v1"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Context (JSON)</label>
          <textarea
            value={context}
            onChange={(e) => setContext(e.target.value)}
            rows={6}
            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none font-mono text-sm"
            placeholder='{\n  "key": "value"\n}'
          />
          <p className="text-xs text-gray-500 mt-1">Valid JSON object</p>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!title || isCreating}
            className="flex-1 px-4 py-2 bg-blue-500/20 border border-blue-400/50 rounded-lg text-blue-300 hover:bg-blue-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? '⏳ Creating...' : '✨ Create Breadcrumb'}
          </button>
          <button
            type="button"
            onClick={() => {
              setTitle('');
              setContext('{\n  \n}');
              setTags('');
              setSchemaName('');
            }}
            className="px-4 py-2 bg-gray-500/20 border border-gray-400/50 rounded-lg text-gray-300 hover:bg-gray-500/30 transition-colors"
          >
            Clear
          </button>
        </div>
      </form>
    </motion.div>
  );
}

// Secret Creation Form
function CreateSecretForm({ onBack, isCreating, setIsCreating }: { 
  onBack: () => void; 
  isCreating: boolean; 
  setIsCreating: (val: boolean) => void; 
}) {
  const [name, setName] = useState('');
  const [value, setValue] = useState('');
  const [scopeType, setScopeType] = useState('global');
  const { authenticatedFetch } = useAuthentication();
  const queryClient = useQueryClient();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsCreating(true);

    try {
      const secret = {
        name,
        value,
        scope_type: scopeType,
      };

      console.log('🔐 Creating secret:', { name, scope_type: scopeType });

      const response = await authenticatedFetch('/api/secrets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(secret),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('✅ Secret created successfully:', result.id);
        
        // Reset form
        setName('');
        setValue('');
        setScopeType('global');
        
        // Refresh data
        queryClient.invalidateQueries({ queryKey: ['secrets'] });
        
        // Go back to main panel
        setTimeout(() => onBack(), 1000);
      } else {
        const error = await response.text();
        console.error('❌ Failed to create secret:', error);
        alert(`Failed to create secret: ${error}`);
      }
    } catch (error) {
      console.error('❌ Error creating secret:', error);
      alert(`Error: ${error}`);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.3 }}
    >
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={onBack}
          className="p-2 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white transition-colors"
        >
          ←
        </button>
        <h4 className="text-lg font-semibold text-white">🔐 Create Secret</h4>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Secret Name *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none"
            placeholder="API_KEY, DATABASE_URL, etc."
            data-tour="secret-name"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Secret Value *</label>
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            required
            rows={3}
            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none font-mono text-sm"
            placeholder="Enter the secret value..."
            data-tour="secret-value"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">Scope Type</label>
          <select
            value={scopeType}
            onChange={(e) => setScopeType(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded-lg text-white focus:border-blue-400 focus:outline-none"
          >
            <option value="global">Global - Available to all agents</option>
            <option value="workspace">Workspace - Scoped to workspace</option>
            <option value="agent">Agent - Scoped to specific agent</option>
          </select>
        </div>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={!name || !value || isCreating}
            className="flex-1 px-4 py-2 bg-red-500/20 border border-red-400/50 rounded-lg text-red-300 hover:bg-red-500/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            data-tour="create-secret-button"
          >
            {isCreating ? '⏳ Creating...' : '🔐 Create Secret'}
          </button>
          <button
            type="button"
            onClick={() => {
              setName('');
              setValue('');
              setScopeType('global');
            }}
            className="px-4 py-2 bg-gray-500/20 border border-gray-400/50 rounded-lg text-gray-300 hover:bg-gray-500/30 transition-colors"
          >
            Clear
          </button>
        </div>
      </form>
    </motion.div>
  );
}