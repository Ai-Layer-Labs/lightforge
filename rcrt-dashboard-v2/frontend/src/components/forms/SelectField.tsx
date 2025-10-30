import React from 'react';
import { FieldWrapper, BaseFieldProps } from './FormField';

interface SelectFieldProps extends BaseFieldProps {
  value: string | number;
  onChange: (value: string | number) => void;
  options: Array<{ value: string | number; label: string }>;
  placeholder?: string;
  loading?: boolean;
}

export function SelectField({
  label,
  description,
  required,
  help_text,
  error,
  value,
  onChange,
  options,
  placeholder = 'Select an option...',
  loading = false,
}: SelectFieldProps) {
  return (
    <FieldWrapper
      label={label}
      description={description}
      required={required}
      help_text={help_text}
      error={error}
    >
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded text-white text-sm focus:border-green-400 focus:outline-none"
        disabled={loading}
      >
        <option value="">{loading ? 'Loading...' : placeholder}</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </FieldWrapper>
  );
}

