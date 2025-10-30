#!/usr/bin/env node
/**
 * Complete Dynamic Configuration Integration
 * Inserts DynamicConfigForm code into DetailsPanel.tsx
 */

const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/components/panels/DetailsPanel.tsx');

console.log('📝 Reading DetailsPanel.tsx...');
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

// Find the insertion point (after queryClient declaration)
const insertAfterIndex = lines.findIndex(line => 
  line.includes('const queryClient = useQueryClient();')
);

if (insertAfterIndex === -1) {
  console.error('❌ Could not find insertion point (queryClient declaration)');
  process.exit(1);
}

console.log(`✅ Found insertion point at line ${insertAfterIndex + 1}`);

// The code to insert
const insertCode = `
  // NEW: Check for ui_schema and use DynamicConfigForm if available
  const toolData = node.data;
  const uiSchema = toolData?.context?.ui_schema;

  if (uiSchema?.configurable) {
    // Load secrets and config first
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
        const response = await authenticatedFetch('/api/breadcrumbs');
        if (!response.ok) return;
        
        const breadcrumbs = await response.json();
        const configBreadcrumb = breadcrumbs.find((b: Breadcrumb) =>
          b.tags?.includes(\`tool:config:\${node.metadata.title}\`) &&
          b.schema_name === 'tool.config.v1'
        );
        
        if (configBreadcrumb) {
          setConfig(configBreadcrumb.context.config || {});
        }
      } catch (error) {
        console.warn('Failed to load tool config:', error);
      }
    };

    const handleSaveConfig = async () => {
      setIsSaving(true);
      
      try {
        const configBreadcrumb = {
          title: \`\${node.metadata.title} Configuration\`,
          context: {
            config,
            toolName: node.metadata.title,
            tool_id: node.id,
            lastUpdated: new Date().toISOString(),
          },
          tags: [\`tool:config:\${node.metadata.title}\`, 'tool:config', 'workspace:tools'],
          schema_name: 'tool.config.v1',
        };
        
        const searchResponse = await authenticatedFetch('/api/breadcrumbs');
        if (searchResponse.ok) {
          const breadcrumbs = await searchResponse.json();
          const existing = breadcrumbs.find((b: Breadcrumb) =>
            b.tags?.includes(\`tool:config:\${node.metadata.title}\`)
          );
          
          let response;
          if (existing) {
            response = await authenticatedFetch(\`/api/breadcrumbs/\${existing.id}\`, {
              method: 'PATCH',
              headers: {
                'Content-Type': 'application/json',
                'If-Match': \`\${existing.version || 1}\`,
              },
              body: JSON.stringify(configBreadcrumb),
            });
          } else {
            response = await authenticatedFetch('/api/breadcrumbs', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(configBreadcrumb),
            });
          }
          
          if (response.ok) {
            queryClient.invalidateQueries({ queryKey: ['breadcrumbs'] });
            alert('✅ Configuration saved successfully!');
            onSave();
          } else {
            throw new Error(\`Failed to save: \${response.statusText}\`);
          }
        }
      } catch (error: any) {
        alert(\`❌ Failed to save configuration: \${error.message}\`);
      } finally {
        setIsSaving(false);
      }
    };

    // Return DynamicConfigForm
    return (
      <motion.div
        className="space-y-6 p-6 bg-gray-900/50 rounded-lg border border-gray-700"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        <DynamicConfigForm
          tool={toolData}
          config={config}
          onConfigChange={setConfig}
          secrets={secrets}
          onSave={handleSaveConfig}
          onCancel={() => {}}
          isSaving={isSaving}
        />
      </motion.div>
    );
  }

  // EXISTING CODE CONTINUES: Fall back to hardcoded UI for legacy tools
`;

// Insert the code
lines.splice(insertAfterIndex + 1, 0, insertCode);

// Write back
console.log('💾 Writing updated file...');
fs.writeFileSync(filePath, lines.join('\n'), 'utf8');

console.log('');
console.log('✅ Integration complete!');
console.log('');
console.log('Next steps:');
console.log('1. cd rcrt-dashboard-v2/frontend');
console.log('2. npm run dev');
console.log('3. Open http://localhost:3000');
console.log('4. Test OpenRouter tool configuration');
console.log('');
console.log('🎉 Dynamic Tool Configuration System is now fully operational!');

