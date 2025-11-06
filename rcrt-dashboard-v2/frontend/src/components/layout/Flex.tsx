import React from 'react';
import clsx from 'clsx';

interface FlexProps {
  children: React.ReactNode;
  direction?: 'row' | 'column';
  gap?: number;
  align?: 'start' | 'center' | 'end' | 'stretch';
  justify?: 'start' | 'center' | 'end' | 'between' | 'around';
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Flex layout component for dynamic pages
 */
export function Flex({
  children,
  direction = 'column',
  gap = 4,
  align = 'stretch',
  justify = 'start',
  className,
  style,
}: FlexProps) {
  const alignMap = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
    stretch: 'stretch',
  };

  const justifyMap = {
    start: 'flex-start',
    center: 'center',
    end: 'flex-end',
    between: 'space-between',
    around: 'space-around',
  };

  const flexStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: direction,
    gap: `${gap * 4}px`, // gap * 4px (spacing unit)
    alignItems: alignMap[align],
    justifyContent: justifyMap[justify],
    ...style,
  };

  return (
    <div
      className={clsx('layout-flex', className)}
      style={flexStyle}
    >
      {children}
    </div>
  );
}

