import React from 'react';

export interface BaseFieldProps {
  label: string;
  description?: string;
  required?: boolean;
  help_text?: string;
  error?: string;
}

export function FieldWrapper({ 
  label, 
  description, 
  required, 
  help_text, 
  error, 
  children 
}: BaseFieldProps & { children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-300">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </label>
      
      {description && (
        <p className="text-xs text-gray-400 mb-2">{description}</p>
      )}
      
      {children}
      
      {help_text && (
        <p className="text-xs text-gray-500 mt-1">{help_text}</p>
      )}
      
      {error && (
        <p className="text-xs text-red-400 mt-1">{error}</p>
      )}
    </div>
  );
}

