/**
 * THE RCRT WAY - Connection Type Definitions
 * Single source of truth for all connection visualization
 * 
 * Four relationship types:
 * 1. Creates (green, solid) - Agent/tool creates breadcrumb
 * 2. Config (purple, dashed) - Tool uses config breadcrumb
 * 3. Subscribed (blue, dotted) - Agent subscribed to events
 * 4. Triggered (blue, solid) - Event triggered agent (role=trigger)
 */

export type ConnectionType = 'creates' | 'config' | 'subscribed' | 'triggered';

export interface ConnectionStyle {
  color: string;
  style: 'solid' | 'dashed' | 'dotted';
  weight: number;
  label: string;
}

/**
 * THE RCRT WAY - Connection styling rules
 * These are the ONLY connection types we render
 */
export const CONNECTION_STYLES: Record<ConnectionType, ConnectionStyle> = {
  creates: {
    color: '#00ff88',  // Green
    style: 'solid',
    weight: 2,
    label: 'creates'
  },
  config: {
    color: '#9333ea',  // Purple
    style: 'dashed',
    weight: 2,
    label: 'config'
  },
  subscribed: {
    color: '#0099ff',  // Blue
    style: 'dotted',
    weight: 2,
    label: 'subscribed'
  },
  triggered: {
    color: '#0099ff',  // Blue
    style: 'solid',
    weight: 3,
    label: 'triggers'
  }
};

/**
 * Get connection style for a given type
 */
export function getConnectionStyle(type: ConnectionType): ConnectionStyle {
  return CONNECTION_STYLES[type];
}

/**
 * Get SVG stroke-dasharray for a style
 */
export function getStrokeDashArray(style: 'solid' | 'dashed' | 'dotted'): string {
  switch (style) {
    case 'dashed':
      return '8,4';
    case 'dotted':
      return '2,3';
    case 'solid':
    default:
      return 'none';
  }
}

