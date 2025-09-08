/**
 * Base Node Component
 * Base visual component for all node types
 */

import React, { ReactNode } from 'react';
import { Card } from '@heroui/react';
import clsx from 'clsx';

interface BaseNodeProps {
  id: string;
  selected?: boolean;
  icon: string;
  title: string;
  color: string;
  children?: ReactNode;
  onDoubleClick?: () => void;
  className?: string;
  style?: React.CSSProperties;
}

export const BaseNode: React.FC<BaseNodeProps> = ({
  id,
  selected,
  icon,
  title,
  color,
  children,
  onDoubleClick,
  className,
  style
}) => {
  return (
    <Card
      className={clsx('base-node', className, {
        'selected': selected
      })}
      style={{
        minWidth: '180px',
        backgroundColor: '#ffffff',
        border: `2px solid ${selected ? color : '#e4e4e7'}`,
        borderRadius: '8px',
        boxShadow: selected ? `0 0 0 2px ${color}40` : '0 1px 3px rgba(0,0,0,0.1)',
        transition: 'all 0.2s',
        cursor: 'pointer',
        ...style
      }}
      onDoubleClick={onDoubleClick}
    >
      <div 
        className="node-header"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '8px 12px',
          borderBottom: '1px solid #e4e4e7',
          backgroundColor: `${color}10`
        }}
      >
        <span style={{ fontSize: '1.2rem' }}>{icon}</span>
        <span style={{ 
          fontWeight: 600, 
          fontSize: '0.9rem',
          color: '#27272a'
        }}>
          {title}
        </span>
      </div>
      
      <div className="node-body">
        {children}
      </div>
    </Card>
  );
};
