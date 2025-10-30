import React from 'react';
import { FieldWrapper, BaseFieldProps } from './FormField';

interface NumberFieldProps extends BaseFieldProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}

export function NumberField({
  label,
  description,
  required,
  help_text,
  error,
  value,
  onChange,
  min,
  max,
  step,
  placeholder,
}: NumberFieldProps) {
  return (
    <FieldWrapper
      label={label}
      description={description}
      required={required}
      help_text={help_text}
      error={error}
    >
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        min={min}
        max={max}
        step={step}
        placeholder={placeholder}
        className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded text-white text-sm focus:border-green-400 focus:outline-none"
      />
    </FieldWrapper>
  );
}

