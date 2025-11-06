import React, { useState, useEffect } from 'react';
import { useAuthentication } from '../../hooks/useAuthentication';
import { useNavigate } from 'react-router-dom';
import { JSONPath } from 'jsonpath-plus';
import { UIRenderer } from '../ui/UIRenderer';
import { useUIState } from '../../hooks/useUIState';
import { useAction } from '../../hooks/useAction';
import { TemplateContext } from '../../utils/TemplateEngine';
// Legacy field components (for backward compatibility)
import { TextField } from './TextField';
import { NumberField } from './NumberField';
import { SliderField } from './SliderField';
import { BooleanField } from './BooleanField';
import { SelectField } from './SelectField';
import { SecretSelectField } from './SecretSelectField';
import { JsonField } from './JsonField';

export interface UIConfigField {
  key: string;
  label: string;
  type: 'string' | 'number' | 'boolean' | 'secret' | 'json';
  ui_type: 'text' | 'textarea' | 'number' | 'slider' | 'boolean' | 'select' | 'secret-select' | 'json';
  description?: string;
  default_value?: any;
  required?: boolean;
  placeholder?: string;
  help_text?: string;
  secret_name?: string;
  validation?: {
    min?: number;
    max?: number;
    step?: number;
    pattern?: string;
  };
  options?: Array<{ value: any; label: string }>;
  options_source?: {
    type: 'breadcrumb-search' | 'api';
    schema_name?: string;
    tag?: string;
    value_path?: string;
    label_path?: string;
    url?: string;
    value_field?: string;
    label_field?: string;
  };
}

export interface UISchema {
  configurable: boolean;
  config_fields?: UIConfigField[];
}

export interface Tool {
  id?: string;
  name?: string;
  title?: string;
  context?: {
    name?: string;
    ui_schema?: UISchema;
    [key: string]: any;
  };
}

interface Secret {
  name: string;
  description?: string;
}

interface DynamicConfigFormProps {
  tool: Tool;
  config: Record<string, any>;
  onConfigChange: (config: Record<string, any>) => void;
  secrets: Secret[];
  onSave: () => void;
  onCancel: () => void;
  isSaving?: boolean;
}

export function DynamicConfigForm({
  tool,
  config,
  onConfigChange,
  secrets,
  onSave,
  onCancel,
  isSaving = false,
}: DynamicConfigFormProps) {
  const { authenticatedFetch, isAuthenticated, authToken } = useAuthentication();
  const navigate = useNavigate();
  
  const uiSchema = tool.context?.ui_schema;
  
  // Check if this is the new HeroUI-based ui_schema or old field-based
  // For now, only use HeroUI in pages, not sidebar (callback integration issue)
  const isHeroUISchema = false; // Disabled for sidebar - use old field rendering
  
  // For new HeroUI schemas, use UIRenderer (disabled for now in sidebar)
  if (isHeroUISchema) {
    const tempStateRef = `temp:config-${tool.id || 'unknown'}`;
    const { state, stateManager, loading } = useUIState(tempStateRef, config);
    const { actionRunner } = useAction(stateManager, tempStateRef);
    
    // Set up save and cancel actions
    React.useEffect(() => {
      actionRunner.setNamedActions({
        saveConfig: {
          action: 'log',
          message: 'Triggering parent save with config',
          data: { config: '{{state}}' },
        },
        cancelConfig: {
          action: 'log',
          message: 'Triggering parent cancel',
        },
      });
      
      // Also trigger the actual parent callbacks
      // We'll need to call onSave/onCancel from within the action
      // For now, just call them directly when action runs
    }, [actionRunner, onSave, onCancel]);
    
    // Wire up the save button to actually call onSave
    React.useEffect(() => {
      const handleSaveWrapper = async () => {
        if (state) {
          onConfigChange(state);
          onSave();
        }
      };
      
      // Override the saveConfig action with actual save logic
      actionRunner.setNamedActions({
        ...actionRunner['namedActions'],
        saveConfig: {
          action: 'log',
          message: 'Saving config...',
        },
      });
      
      // Manually wire the button
      // This is a workaround - ideally actions should trigger React callbacks
    }, [state, onSave, onConfigChange, actionRunner]);
    
    // Sync state changes back to parent
    React.useEffect(() => {
      if (state && JSON.stringify(state) !== JSON.stringify(config)) {
        onConfigChange(state);
      }
    }, [state, config, onConfigChange]);
    
    if (loading) {
      return (
        <div className="flex items-center justify-center py-8">
          <div className="animate-spin w-6 h-6 border-2 border-rcrt-primary border-t-transparent rounded-full"></div>
        </div>
      );
    }
    
    // Context with just secrets - data sources are loaded by DataLoader components
    const context: TemplateContext = {
      state: state || config,
      data: { secrets },
    };
    
    return (
      <div className="heroui-config-form">
        <UIRenderer
          definition={uiSchema.ui || uiSchema.components}
          context={context}
          actionRunner={actionRunner}
        />
      </div>
    );
  }
  
  // Fall back to old field-based rendering
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dynamicOptions, setDynamicOptions] = useState<Record<string, Array<{ value: any; label: string }>>>({});
  const [loadingOptions, setLoadingOptions] = useState<Record<string, boolean>>({});

  const fields = uiSchema?.config_fields || [];

  // Load dynamic options for fields (only when authenticated)
  useEffect(() => {
    if (!isAuthenticated) return;
    
    fields.forEach((field) => {
      if (field.options_source) {
        loadDynamicOptions(field);
      }
    });
  }, [fields, isAuthenticated]);

  const loadDynamicOptions = async (field: UIConfigField) => {
    if (!field.options_source) return;

    console.log(`[DynamicConfigForm] Loading options for field: ${field.key}`, field.options_source);
    setLoadingOptions((prev) => ({ ...prev, [field.key]: true }));

    try {
      if (field.options_source.type === 'breadcrumb-search') {
        // Search breadcrumbs
        const params = new URLSearchParams();
        if (field.options_source.schema_name) {
          params.append('schema_name', field.options_source.schema_name);
        }
        if (field.options_source.tag) {
          params.append('tag', field.options_source.tag);
        }
        params.append('include_context', 'true');

        const response = await authenticatedFetch(`/api/breadcrumbs?${params.toString()}`);
        console.log(`[DynamicConfigForm] Response status: ${response.status}`);
        
        if (response.ok) {
          const breadcrumbs = await response.json();
          console.log(`[DynamicConfigForm] Found ${breadcrumbs.length} breadcrumbs`, breadcrumbs);
          
          // Extract values and labels using JSONPath
          const options: Array<{ value: any; label: string }> = [];
          
          breadcrumbs.forEach((breadcrumb: any) => {
            try {
              console.log(`[DynamicConfigForm] Extracting from breadcrumb:`, breadcrumb.id, {
                value_path: field.options_source!.value_path,
                label_path: field.options_source!.label_path
              });
              
              const values = JSONPath({
                path: field.options_source!.value_path || '$',
                json: breadcrumb,
              });
              const labels = JSONPath({
                path: field.options_source!.label_path || '$',
                json: breadcrumb,
              });

              console.log(`[DynamicConfigForm] JSONPath results:`, {
                values: values?.length || 0,
                labels: labels?.length || 0
              });

              // Flatten if arrays
              const valueList = Array.isArray(values) ? values.flat() : [values];
              const labelList = Array.isArray(labels) ? labels.flat() : [labels];

              valueList.forEach((val: any, idx: number) => {
                options.push({
                  value: val,
                  label: labelList[idx] || val,
                });
              });
            } catch (error) {
              console.warn('Failed to extract options from breadcrumb:', error);
            }
          });

          console.log(`[DynamicConfigForm] Extracted ${options.length} options for ${field.key}`);
          setDynamicOptions((prev) => ({ ...prev, [field.key]: options }));
        } else {
          console.error(`[DynamicConfigForm] Failed to fetch breadcrumbs: ${response.status}`);
        }
      } else if (field.options_source.type === 'api') {
        // Fetch from API
        const response = await authenticatedFetch(field.options_source.url!);
        if (response.ok) {
          const data = await response.json();
          const options = data.map((item: any) => ({
            value: item[field.options_source!.value_field || 'value'],
            label: item[field.options_source!.label_field || 'label'],
          }));
          setDynamicOptions((prev) => ({ ...prev, [field.key]: options }));
        }
      }
    } catch (error) {
      console.error(`Failed to load options for ${field.key}:`, error);
    } finally {
      setLoadingOptions((prev) => ({ ...prev, [field.key]: false }));
    }
  };

  const validateField = (field: UIConfigField, value: any): string | null => {
    // Required check
    if (field.required && (value === undefined || value === null || value === '')) {
      return `${field.label} is required`;
    }

    // Type-specific validation
    if (field.type === 'number' && field.validation) {
      const numValue = Number(value);
      if (field.validation.min !== undefined && numValue < field.validation.min) {
        return `${field.label} must be at least ${field.validation.min}`;
      }
      if (field.validation.max !== undefined && numValue > field.validation.max) {
        return `${field.label} must be at most ${field.validation.max}`;
      }
    }

    // Pattern validation
    if (field.type === 'string' && field.validation?.pattern && value) {
      const regex = new RegExp(field.validation.pattern);
      if (!regex.test(value)) {
        return `${field.label} format is invalid`;
      }
    }

    return null;
  };

  const handleFieldChange = (key: string, value: any) => {
    onConfigChange({ ...config, [key]: value });
    
    // Clear error for this field
    if (errors[key]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[key];
        return newErrors;
      });
    }
  };

  const handleSave = () => {
    // Validate all required fields
    const newErrors: Record<string, string> = {};
    fields.forEach((field) => {
      const error = validateField(field, config[field.key]);
      if (error) {
        newErrors[field.key] = error;
      }
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    onSave();
  };

  const renderField = (field: UIConfigField) => {
    const value = config[field.key] ?? field.default_value ?? '';
    const error = errors[field.key];

    switch (field.ui_type) {
      case 'text':
        return (
          <TextField
            key={field.key}
            label={field.label}
            description={field.description}
            required={field.required}
            help_text={field.help_text}
            error={error}
            value={value}
            onChange={(val) => handleFieldChange(field.key, val)}
            placeholder={field.placeholder}
          />
        );

      case 'textarea':
        return (
          <TextField
            key={field.key}
            label={field.label}
            description={field.description}
            required={field.required}
            help_text={field.help_text}
            error={error}
            value={value}
            onChange={(val) => handleFieldChange(field.key, val)}
            placeholder={field.placeholder}
            multiline={true}
            rows={4}
          />
        );

      case 'number':
        return (
          <NumberField
            key={field.key}
            label={field.label}
            description={field.description}
            required={field.required}
            help_text={field.help_text}
            error={error}
            value={value || 0}
            onChange={(val) => handleFieldChange(field.key, val)}
            min={field.validation?.min}
            max={field.validation?.max}
            step={field.validation?.step}
            placeholder={field.placeholder}
          />
        );

      case 'slider':
        return (
          <SliderField
            key={field.key}
            label={field.label}
            description={field.description}
            required={field.required}
            help_text={field.help_text}
            error={error}
            value={value || field.default_value || 0}
            onChange={(val) => handleFieldChange(field.key, val)}
            min={field.validation?.min || 0}
            max={field.validation?.max || 100}
            step={field.validation?.step || 1}
          />
        );

      case 'boolean':
        return (
          <BooleanField
            key={field.key}
            label={field.label}
            description={field.description}
            required={field.required}
            help_text={field.help_text}
            error={error}
            value={value || false}
            onChange={(val) => handleFieldChange(field.key, val)}
          />
        );

      case 'select':
        const options = field.options || dynamicOptions[field.key] || [];
        return (
          <SelectField
            key={field.key}
            label={field.label}
            description={field.description}
            required={field.required}
            help_text={field.help_text}
            error={error}
            value={value}
            onChange={(val) => handleFieldChange(field.key, val)}
            options={options}
            placeholder={field.placeholder}
            loading={loadingOptions[field.key]}
          />
        );

      case 'secret-select':
        return (
          <SecretSelectField
            key={field.key}
            label={field.label}
            description={field.description}
            required={field.required}
            help_text={field.help_text}
            error={error}
            value={value}
            onChange={(val) => handleFieldChange(field.key, val)}
            secrets={secrets}
            secretName={field.secret_name}
            placeholder={field.placeholder}
          />
        );

      case 'json':
        return (
          <JsonField
            key={field.key}
            label={field.label}
            description={field.description}
            required={field.required}
            help_text={field.help_text}
            error={error}
            value={value || {}}
            onChange={(val) => handleFieldChange(field.key, val)}
            placeholder={field.placeholder}
          />
        );

      default:
        return null;
    }
  };

  if (!uiSchema?.configurable) {
    return (
      <div className="text-center text-gray-400 py-8">
        <p>This tool has no configurable options.</p>
      </div>
    );
  }

  if (fields.length === 0) {
    return (
      <div className="text-center text-gray-400 py-8">
        <p>No configuration fields defined for this tool.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h5 className="text-lg font-semibold text-green-400 flex items-center gap-2">
        🛠️ Configure {tool.title || tool.context?.name || 'Tool'}
      </h5>

      <div className="space-y-4">
        {fields.map((field) => renderField(field))}
      </div>

      <div className="flex gap-3 pt-4 border-t border-gray-700">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 disabled:bg-gray-600 text-white rounded font-medium transition-colors"
        >
          {isSaving ? 'Saving...' : '💾 Save Configuration'}
        </button>
        <button
          onClick={onCancel}
          disabled={isSaving}
          className="px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-gray-800 text-white rounded transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

