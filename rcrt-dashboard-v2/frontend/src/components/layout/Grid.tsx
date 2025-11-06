import React from 'react';
import clsx from 'clsx';

interface GridProps {
  children: React.ReactNode;
  columns?: number;
  gap?: number;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Grid layout component for dynamic pages
 */
export function Grid({
  children,
  columns = 1,
  gap = 4,
  className,
  style,
}: GridProps) {
  const gridStyle: React.CSSProperties = {
    display: 'grid',
    gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
    gap: `${gap * 4}px`, // gap * 4px (spacing unit)
    ...style,
  };

  return (
    <div
      className={clsx('layout-grid', className)}
      style={gridStyle}
    >
      {children}
    </div>
  );
}

