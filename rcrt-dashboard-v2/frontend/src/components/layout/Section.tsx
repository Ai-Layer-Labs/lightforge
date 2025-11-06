import React from 'react';
import { Section as SectionType } from '../../types/layout';
import { Grid } from './Grid';
import { Flex } from './Flex';
import clsx from 'clsx';

interface SectionProps {
  section: SectionType;
  children?: React.ReactNode;
}

/**
 * Section component renders a section of a dynamic page layout
 * Supports different layout types: flex-column, flex-row, grid, component
 */
export function Section({ section, children }: SectionProps) {
  const { type = 'flex-column', className, style } = section;

  // Render based on section type
  switch (type) {
    case 'grid':
      return (
        <Grid
          columns={section.columns || 1}
          className={clsx('section-grid', className)}
          style={style}
        >
          {children}
        </Grid>
      );

    case 'flex-row':
      return (
        <Flex
          direction="row"
          className={clsx('section-flex-row', className)}
          style={style}
        >
          {children}
        </Flex>
      );

    case 'flex-column':
      return (
        <Flex
          direction="column"
          className={clsx('section-flex-column', className)}
          style={style}
        >
          {children}
        </Flex>
      );

    case 'component':
      // Custom component rendering would go here
      // For now, just wrap in a div
      return (
        <div
          className={clsx('section-component', className)}
          style={style}
          data-component={section.component}
        >
          {children}
        </div>
      );

    default:
      return (
        <div
          className={clsx('section-default', className)}
          style={style}
        >
          {children}
        </div>
      );
  }
}

