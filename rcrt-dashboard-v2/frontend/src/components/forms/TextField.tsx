import React from 'react';
import { FieldWrapper, BaseFieldProps } from './FormField';

interface TextFieldProps extends BaseFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
}

export function TextField({
  label,
  description,
  required,
  help_text,
  error,
  value,
  onChange,
  placeholder,
  multiline = false,
  rows = 3,
}: TextFieldProps) {
  const commonClasses =
    'w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded text-white text-sm focus:border-green-400 focus:outline-none';

  return (
    <FieldWrapper
      label={label}
      description={description}
      required={required}
      help_text={help_text}
      error={error}
    >
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className={commonClasses}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className={commonClasses}
        />
      )}
    </FieldWrapper>
  );
}

