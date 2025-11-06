import React, { useState } from 'react';
import { Button } from '@heroui/react';
import { resolveTemplateObject, TemplateContext } from '../../utils/TemplateEngine';
import { Action, ActionRunner } from '../../services/ActionRunner';

interface ActionButtonProps {
  action: Action;
  label?: string;
  icon?: string;
  variant?: 'solid' | 'bordered' | 'light' | 'flat' | 'faded' | 'shadow' | 'ghost';
  color?: 'default' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  context: TemplateContext;
  actionRunner: ActionRunner;
  children?: React.ReactNode;
}

/**
 * ActionButton - Button that executes an action when pressed
 * Usage in breadcrumb:
 * {
 *   "ActionButton": {
 *     "label": "Create Secret",
 *     "color": "primary",
 *     "action": {
 *       "action": "api.call",
 *       "method": "POST",
 *       "endpoint": "/secrets",
 *       "body": { "name": "{{state.formData.secretName}}" }
 *     }
 *   }
 * }
 */
export function ActionButton({
  action,
  label,
  icon,
  variant = 'solid',
  color = 'primary',
  size = 'md',
  disabled = false,
  className,
  context,
  actionRunner,
  children,
}: ActionButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handlePress = async () => {
    setIsLoading(true);
    
    try {
      await actionRunner.execute(action, context);
    } catch (error) {
      console.error('Action button error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const buttonLabel = label ? resolveTemplateObject(label, context) : '';

  return (
    <Button
      onPress={handlePress}
      variant={variant}
      color={color}
      size={size}
      isLoading={isLoading}
      isDisabled={disabled}
      className={className}
      startContent={icon ? <span>{icon}</span> : undefined}
    >
      {children || buttonLabel}
    </Button>
  );
}

