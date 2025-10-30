import React, { useState, useEffect } from 'react';
import { FieldWrapper, BaseFieldProps } from './FormField';

interface JsonFieldProps extends BaseFieldProps {
  value: any;
  onChange: (value: any) => void;
  placeholder?: string;
  rows?: number;
}

export function JsonField({
  label,
  description,
  required,
  help_text,
  error,
  value,
  onChange,
  placeholder = '{\n  "key": "value"\n}',
  rows = 6,
}: JsonFieldProps) {
  const [jsonString, setJsonString] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);

  // Initialize from value
  useEffect(() => {
    try {
      setJsonString(JSON.stringify(value, null, 2));
    } catch (e) {
      setJsonString('{}');
    }
  }, [value]);

  const handleChange = (newValue: string) => {
    setJsonString(newValue);
    
    // Try to parse and update
    try {
      const parsed = JSON.parse(newValue);
      setParseError(null);
      onChange(parsed);
    } catch (e: any) {
      setParseError(e.message);
    }
  };

  return (
    <FieldWrapper
      label={label}
      description={description}
      required={required}
      help_text={help_text}
      error={error || parseError || undefined}
    >
      <textarea
        value={jsonString}
        onChange={(e) => handleChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3 py-2 bg-gray-800/50 border border-gray-600 rounded text-white text-sm font-mono focus:border-green-400 focus:outline-none"
      />
    </FieldWrapper>
  );
}

