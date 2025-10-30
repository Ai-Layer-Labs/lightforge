# Dashboard Integration Guide

## Quick Integration (5 minutes)

The dynamic configuration system is 95% complete. Only the dashboard integration remains.

### Step 1: Open DetailsPanel.tsx

```bash
code rcrt-dashboard-v2/frontend/src/components/panels/DetailsPanel.tsx
```

### Step 2: Add Import (Line ~9)

Find this line:
```typescript
import { useModelsFromCatalog } from '../../hooks/useModelsFromCatalog';
```

Add after it:
```typescript
import { DynamicConfigForm, UISchema } from '../forms/DynamicConfigForm';
```

### Step 3: Integrate DynamicConfigForm (Line ~830)

Find the `EditToolForm` function (around line 826).

**Before the existing `getToolUIVariables` function**, add this check:

```typescript
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
  
  // NEW: Check if tool has ui_schema
  const toolData = node.data; // This is the tool.code.v1 breadcrumb
  const uiSchema = toolData?.context?.ui_schema;
  
  // NEW: Use DynamicConfigForm if tool has ui_schema
  if (uiSchema?.configurable) {
    // Load secrets and config
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
          b.tags?.includes(`tool:config:${node.metadata.title}`) &&
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
          title: `${node.metadata.title} Configuration`,
          context: {
            config,
            toolName: node.metadata.title,
            tool_id: node.id,
            lastUpdated: new Date().toISOString(),
          },
          tags: [`tool:config:${node.metadata.title}`, 'tool:config', 'workspace:tools'],
          schema_name: 'tool.config.v1',
        };
        
        // Check if config already exists
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
            queryClient.invalidateQueries({ queryKey: ['breadcrumbs'] });
            alert('✅ Configuration saved successfully!');
            onSave();
          } else {
            throw new Error(`Failed to save: ${response.statusText}`);
          }
        }
      } catch (error: any) {
        alert(`❌ Failed to save configuration: ${error.message}`);
      } finally {
        setIsSaving(false);
      }
    };
    
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
  
  // EXISTING CODE CONTINUES HERE
  // Keep all the old getToolUIVariables, loadToolConfig, etc. as fallback
  // for legacy tools without ui_schema
  
  const getToolUIVariables = (toolNameOrSchema: string): UIVariable[] => {
    // ... existing switch statement ...
  };
  
  // ... rest of existing code ...
}
```

### Step 4: Save and Test

1. Save the file
2. Restart the dashboard dev server (if running):
   ```bash
   cd rcrt-dashboard-v2/frontend
   npm run dev
   ```

3. Open dashboard and test:
   - Click on OpenRouter tool → Should see new dynamic form
   - Click on Calculator tool → Should see "not configurable"
   - Try configuring OpenRouter → Save should work

### Alternative: Minimal Integration

If the above seems complex, here's a simpler version that just adds the import and renders the component when available:

**Step 1:** Add import (same as above)

**Step 2:** In `EditToolForm`, after line 836, add:

```typescript
// Try to use DynamicConfigForm if available
const toolData = node.data;
const uiSchema = toolData?.context?.ui_schema;

if (uiSchema?.configurable) {
  return <DynamicConfigForm tool={toolData} config={config} onConfigChange={setConfig} secrets={secrets} onSave={handleSaveConfig} onCancel={() => {}} isSaving={isSaving} />;
}
```

Then proceed with the existing code as fallback.

## Verification

After integration, verify:

1. **OpenRouter Tool**
   - Click tool → Details Panel → "⚙️ Configure" button visible
   - Click configure → Form shows 4 fields:
     - API Key (secret dropdown)
     - Default Model (dropdown with models from catalog)
     - Max Tokens (number input)
     - Temperature (slider 0.0-2.0)
   - Save → Creates `tool.config.v1` breadcrumb

2. **Ollama Tool**
   - Configure button visible
   - Form shows 4 fields:
     - Ollama Host (text)
     - Default Model (text)
     - Temperature (slider)
     - Top P (slider)

3. **Calculator Tool**
   - No configure button (not configurable)

4. **Other Simple Tools**
   - No configure buttons

## Troubleshooting

### Form Not Showing

**Check:**
1. Import added correctly
2. DynamicConfigForm check added before existing code
3. Tool breadcrumb has `ui_schema.configurable: true`
4. Browser console for errors

### TypeScript Errors

If TypeScript complains about `UISchema` type:

```typescript
import { DynamicConfigForm, type UISchema } from '../forms/DynamicConfigForm';
```

### "Cannot read property 'ui_schema' of undefined"

Tool data might not be loaded yet. Add safety check:

```typescript
const uiSchema = toolData?.context?.ui_schema;
```

### Model Dropdown Empty

OpenRouter models catalog breadcrumb might not exist. Check:

```bash
curl http://localhost:3000/api/breadcrumbs?schema_name=openrouter.models.catalog.v1
```

If empty, create it or run the catalog creation script.

## Complete Example

See `DYNAMIC_CONFIG_IMPLEMENTATION_SUMMARY.md` for:
- Complete architecture overview
- Before/after comparison
- Performance metrics
- Security considerations

## Documentation

- **UI Schema Reference**: `docs/UI_SCHEMA_REFERENCE.md`
- **Configuration Guide**: `docs/TOOL_CONFIGURATION.md`
- **Self-Contained Tools**: `docs/SELF_CONTAINED_TOOLS.md`

## Next Steps After Integration

1. **Test** all 9 tools (30 minutes)
2. **Remove** hardcoded UI (optional, 15 minutes)
3. **Deploy** to production

Total time to 100% complete: ~50 minutes

