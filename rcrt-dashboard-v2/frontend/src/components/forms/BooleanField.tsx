import React from 'react';
import { FieldWrapper, BaseFieldProps } from './FormField';

interface BooleanFieldProps extends BaseFieldProps {
  value: boolean;
  onChange: (value: boolean) => void;
}

export function BooleanField({
  label,
  description,
  required,
  help_text,
  error,
  value,
  onChange,
}: BooleanFieldProps) {
  return (
    <FieldWrapper
      label={label}
      description={description}
      required={required}
      help_text={help_text}
      error={error}
    >
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          checked={value}
          onChange={(e) => onChange(e.target.checked)}
          className="sr-only peer"
        />
        <div className="w-11 h-6 bg-gray-700 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-green-400 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
        <span className="ml-3 text-sm text-gray-300">{value ? 'Enabled' : 'Disabled'}</span>
      </label>
    </FieldWrapper>
  );
}

