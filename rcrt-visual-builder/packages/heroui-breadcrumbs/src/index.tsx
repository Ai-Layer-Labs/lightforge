/**
 * HeroUI components as breadcrumbs
 * This package enables UI components to be stored and managed as breadcrumbs
 */

export { ComponentRenderer } from './renderer/ComponentRenderer';
export { ComponentRegistry, registerComponents } from './registry/ComponentRegistry';
export { UILoader } from './renderer/UILoader';
export { registerHeroUIComponents } from './registry/registerComponents';

// Export types
export type {
  UIComponentBreadcrumb,
  ComponentProps,
  ComponentBinding,
  ComponentEvent,
} from './types';