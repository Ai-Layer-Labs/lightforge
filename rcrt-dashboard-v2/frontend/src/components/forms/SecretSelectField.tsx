import React from 'react';
import { FieldWrapper, BaseFieldProps } from './FormField';

interface Secret {
  id: string;
  name: string;
  description?: string;
  scope_type?: 'global' | 'workspace' | 'agent';
}

interface SecretSelectFieldProps extends BaseFieldProps {
  value: string;  // This is the secret ID (UUID)
  onChange: (value: string) => void;
  secrets: Secret[];
  secretName?: string; // Recommended secret name
  placeholder?: string;
}

export function SecretSelectField({
  label,
  description,
  required,
  help_text,
  error,
  value,
  onChange,
  secrets,
  secretName,
  placeholder = 'Select a secret...',
}: SecretSelectFieldProps) {
  // Filter secrets to show recommended one first
  const sortedSecrets = [...secrets].sort((a, b) => {
    if (secretName) {
      if (a.name === secretName) return -1;
      if (b.name === secretName) return 1;
    }
    return a.name.localeCompare(b.name);
  });

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
      >
        <option value="">{placeholder}</option>
        {sortedSecrets.map((secret) => (
          <option key={secret.id} value={secret.id}>
            {secret.name}
            {secret.scope_type && ` (${secret.scope_type})`}
            {secretName === secret.name && ' ⭐ (Recommended)'}
          </option>
        ))}
      </select>
      {secrets.length === 0 && (
        <p className="text-xs text-yellow-400 mt-2">
          ⚠️ No secrets available. Create one first.
        </p>
      )}
    </FieldWrapper>
  );
}

