/**
 * Type definitions for theme system
 * Themes are defined as breadcrumbs with schema: theme.v1
 */

export interface Theme {
  schema_name: 'theme.v1';
  title: string;
  tags: string[];
  context: ThemeContext;
}

export interface ThemeContext {
  name: string;
  extends?: string; // ID or name of parent theme
  colors: ThemeColors;
  fonts: ThemeFonts;
  spacing: ThemeSpacing;
  borderRadius: ThemeBorderRadius;
  shadows?: ThemeShadows;
  animations?: ThemeAnimations;
  custom?: Record<string, any>;
}

export interface ThemeColors {
  // Primary colors
  primary: string;
  primaryHover?: string;
  primaryActive?: string;
  
  // Secondary colors
  secondary: string;
  secondaryHover?: string;
  secondaryActive?: string;
  
  // Background colors
  background: string;
  backgroundAlt?: string;
  surface: string;
  surfaceAlt?: string;
  
  // Text colors
  text: string;
  textSecondary: string;
  textTertiary?: string;
  textInverse?: string;
  
  // Status colors
  success?: string;
  warning?: string;
  error?: string;
  info?: string;
  
  // Border colors
  border?: string;
  borderLight?: string;
  borderDark?: string;
  
  // Node type colors (for dashboard)
  nodeTool?: string;
  nodeSecret?: string;
  nodeAgent?: string;
  nodeBreadcrumb?: string;
  
  // Custom colors
  [key: string]: string | undefined;
}

export interface ThemeFonts {
  main: string;
  mono: string;
  heading?: string;
}

export interface ThemeSpacing {
  unit: number; // Base unit in pixels
  xs?: number;
  sm?: number;
  md?: number;
  lg?: number;
  xl?: number;
}

export interface ThemeBorderRadius {
  sm: string;
  md: string;
  lg: string;
  xl?: string;
  full?: string;
}

export interface ThemeShadows {
  sm?: string;
  md?: string;
  lg?: string;
  xl?: string;
}

export interface ThemeAnimations {
  duration?: {
    fast?: string;
    normal?: string;
    slow?: string;
  };
  easing?: {
    default?: string;
    in?: string;
    out?: string;
    inOut?: string;
  };
}

export interface ThemeVariables {
  [key: string]: string;
}

export function themeToCSS(theme: ThemeContext): string {
  const vars: string[] = [];
  
  // Colors
  Object.entries(theme.colors).forEach(([key, value]) => {
    if (value) {
      const cssKey = `--color-${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`;
      vars.push(`  ${cssKey}: ${value};`);
    }
  });
  
  // Fonts
  vars.push(`  --font-main: ${theme.fonts.main};`);
  vars.push(`  --font-mono: ${theme.fonts.mono};`);
  if (theme.fonts.heading) {
    vars.push(`  --font-heading: ${theme.fonts.heading};`);
  }
  
  // Spacing
  vars.push(`  --spacing-unit: ${theme.spacing.unit}px;`);
  if (theme.spacing.xs) vars.push(`  --spacing-xs: ${theme.spacing.xs}px;`);
  if (theme.spacing.sm) vars.push(`  --spacing-sm: ${theme.spacing.sm}px;`);
  if (theme.spacing.md) vars.push(`  --spacing-md: ${theme.spacing.md}px;`);
  if (theme.spacing.lg) vars.push(`  --spacing-lg: ${theme.spacing.lg}px;`);
  if (theme.spacing.xl) vars.push(`  --spacing-xl: ${theme.spacing.xl}px;`);
  
  // Border radius
  vars.push(`  --border-radius-sm: ${theme.borderRadius.sm};`);
  vars.push(`  --border-radius-md: ${theme.borderRadius.md};`);
  vars.push(`  --border-radius-lg: ${theme.borderRadius.lg};`);
  if (theme.borderRadius.xl) vars.push(`  --border-radius-xl: ${theme.borderRadius.xl};`);
  if (theme.borderRadius.full) vars.push(`  --border-radius-full: ${theme.borderRadius.full};`);
  
  // Shadows
  if (theme.shadows) {
    Object.entries(theme.shadows).forEach(([key, value]) => {
      if (value) vars.push(`  --shadow-${key}: ${value};`);
    });
  }
  
  // Animations
  if (theme.animations?.duration) {
    Object.entries(theme.animations.duration).forEach(([key, value]) => {
      if (value) vars.push(`  --duration-${key}: ${value};`);
    });
  }
  if (theme.animations?.easing) {
    Object.entries(theme.animations.easing).forEach(([key, value]) => {
      if (value) vars.push(`  --easing-${key}: ${value};`);
    });
  }
  
  // Custom properties
  if (theme.custom) {
    Object.entries(theme.custom).forEach(([key, value]) => {
      vars.push(`  --custom-${key}: ${value};`);
    });
  }
  
  return `:root {\n${vars.join('\n')}\n}`;
}

