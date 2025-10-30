import React, { useState, useEffect } from 'react';
import { TextField } from './TextField';
import { NumberField } from './NumberField';
import { SliderField } from './SliderField';
import { BooleanField } from './BooleanField';
import { SelectField } from './SelectField';
import { SecretSelectField } from './SecretSelectField';
import { JsonField } from './JsonField';
import { useAuthentication } from '../../hooks/useAuthentication';
import { JSONPath } from 'jsonpath-plus';

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
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [dynamicOptions, setDynamicOptions] = useState<Record<string, Array<{ value: any; label: string }>>>({});
  const [loadingOptions, setLoadingOptions] = useState<Record<string, boolean>>({});
  const { authenticatedFetch } = useAuthentication();

  const uiSchema = tool.context?.ui_schema;
  const fields = uiSchema?.config_fields || [];

  // Load dynamic options for fields
  useEffect(() => {
    fields.forEach((field) => {
      if (field.options_source) {
        loadDynamicOptions(field);
      }
    });
  }, [fields]);

  const loadDynamicOptions = async (field: UIConfigField) => {
    if (!field.options_source) return;

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

        const response = await authenticatedFetch(`/api/breadcrumbs?${params.toString()}`);
        if (response.ok) {
          const breadcrumbs = await response.json();
          
          // Extract values and labels using JSONPath
          const options: Array<{ value: any; label: string }> = [];
          
          breadcrumbs.forEach((breadcrumb: any) => {
            try {
              const values = JSONPath({
                path: field.options_source!.value_path || '$',
                json: breadcrumb,
              });
              const labels = JSONPath({
                path: field.options_source!.label_path || '$',
                json: breadcrumb,
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

          setDynamicOptions((prev) => ({ ...prev, [field.key]: options }));
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

