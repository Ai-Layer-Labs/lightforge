import React, { useState, useEffect, useRef } from 'react';
import { Input } from '@heroui/react';
import { resolveTemplate, TemplateContext } from '../../utils/TemplateEngine';
import { ActionRunner } from '../../services/ActionRunner';

interface FormFieldProps {
  name: string;
  label?: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  state_path?: string; // Path in state to bind to, e.g., "formData.secretName"
  context: TemplateContext;
  actionRunner: ActionRunner;
}

/**
 * FormField - Input field with automatic state binding
 * Uses local state for instant feedback, debounced server updates
 * 
 * Usage in breadcrumb:
 * {
 *   "FormField": {
 *     "name": "secretName",
 *     "label": "Secret Name",
 *     "state_path": "formData.secretName"
 *   }
 * }
 */
export function FormField({
  name,
  label,
  type = 'text',
  placeholder,
  required,
  state_path,
  context,
  actionRunner,
}: FormFieldProps) {
  // Get initial value from state
  const stateValue = state_path
    ? resolveTemplate(`{{${state_path}}}`, context)
    : '';

  // Local state for instant updates
  const [localValue, setLocalValue] = useState(stateValue || '');
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Sync local state with server state when it changes
  useEffect(() => {
    setLocalValue(stateValue || '');
  }, [stateValue]);

  // Handle change with debounced server update
  const handleChange = (value: string) => {
    // Update local state immediately (instant feedback)
    setLocalValue(value);

    // Debounce server update
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
    }

    debounceTimer.current = setTimeout(async () => {
      if (!state_path) return;

      try {
        await actionRunner.execute(
          {
            action: 'setState',
            updates: { [state_path]: value },
          },
          context
        );
      } catch (error) {
        console.error('Failed to update state:', error);
      }
    }, 500); // 500ms debounce
  };

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) {
        clearTimeout(debounceTimer.current);
      }
    };
  }, []);

  return (
    <Input
      name={name}
      label={label}
      type={type}
      placeholder={placeholder}
      isRequired={required}
      value={localValue}
      onValueChange={handleChange}
      variant="bordered"
      color="primary"
      classNames={{
        input: 'text-white',
        inputWrapper: 'bg-gray-900/50 border-gray-600 data-[hover=true]:border-rcrt-primary',
        label: 'text-gray-300',
      }}
    />
  );
}

