import React from 'react';
import { FieldWrapper, BaseFieldProps } from './FormField';

interface SliderFieldProps extends BaseFieldProps {
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step?: number;
}

export function SliderField({
  label,
  description,
  required,
  help_text,
  error,
  value,
  onChange,
  min,
  max,
  step = 0.1,
}: SliderFieldProps) {
  return (
    <FieldWrapper
      label={label}
      description={description}
      required={required}
      help_text={help_text}
      error={error}
    >
      <div className="space-y-2">
        <div className="flex items-center gap-4">
          <input
            type="range"
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            min={min}
            max={max}
            step={step}
            className="flex-1 h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
            style={{
              background: `linear-gradient(to right, #10b981 0%, #10b981 ${((value - min) / (max - min)) * 100}%, #374151 ${((value - min) / (max - min)) * 100}%, #374151 100%)`,
            }}
          />
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(parseFloat(e.target.value))}
            min={min}
            max={max}
            step={step}
            className="w-20 px-2 py-1 bg-gray-800/50 border border-gray-600 rounded text-white text-sm text-center focus:border-green-400 focus:outline-none"
          />
        </div>
        <div className="flex justify-between text-xs text-gray-500">
          <span>{min}</span>
          <span>{max}</span>
        </div>
      </div>
    </FieldWrapper>
  );
}

