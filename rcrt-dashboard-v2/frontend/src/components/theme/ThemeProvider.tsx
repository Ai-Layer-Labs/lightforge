import React, { createContext, useContext, useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthentication } from '../../hooks/useAuthentication';
import { Theme, ThemeContext as ThemeContextType, themeToCSS } from '../../types/theme';

interface ThemeProviderContextValue {
  theme: ThemeContextType | null;
  loading: boolean;
  error: Error | null;
  setTheme: (themeId: string) => void;
}

const ThemeProviderContext = createContext<ThemeProviderContextValue | undefined>(undefined);

export function useTheme() {
  const context = useContext(ThemeProviderContext);
  if (!context) {
    throw new Error('useTheme must be used within ThemeProvider');
  }
  return context;
}

interface ThemeProviderProps {
  children: React.ReactNode;
  defaultTheme?: string; // Theme ID or tag to load by default
}

export function ThemeProvider({ children, defaultTheme = 'theme:default' }: ThemeProviderProps) {
  const { authenticatedFetch, isAuthenticated } = useAuthentication();
  const [selectedThemeId, setSelectedThemeId] = useState<string>(defaultTheme);

  // Load theme from breadcrumbs
  const themeQuery = useQuery({
    queryKey: ['theme', selectedThemeId],
    queryFn: async (): Promise<ThemeContextType> => {
      console.log('🎨 Loading theme:', selectedThemeId);

      // Search for theme breadcrumb
      const searchParams = new URLSearchParams();
      searchParams.append('schema_name', 'theme.v1');
      
      // If selectedThemeId looks like a tag, search by tag
      if (selectedThemeId.includes(':')) {
        searchParams.append('tag', selectedThemeId);
      }

      const response = await authenticatedFetch(`/api/breadcrumbs?${searchParams.toString()}`);
      
      if (!response.ok) {
        throw new Error('Failed to load theme breadcrumbs');
      }

      const themes = await response.json();

      if (themes.length === 0) {
        console.warn('⚠️ No theme found, using default');
        return getDefaultTheme();
      }

      // Load full theme breadcrumb
      const themeId = themes[0].id;
      const fullResponse = await authenticatedFetch(`/api/breadcrumbs/${themeId}/full`);
      
      if (!fullResponse.ok) {
        throw new Error('Failed to load theme details');
      }

      const themeBreadcrumb: Theme = await fullResponse.json();
      console.log('✅ Theme loaded:', themeBreadcrumb.context.name);
      
      return themeBreadcrumb.context;
    },
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  });

  // Inject theme CSS variables into document head
  useEffect(() => {
    if (!themeQuery.data) return;

    const css = themeToCSS(themeQuery.data);
    
    // Remove existing theme style if present
    const existingStyle = document.getElementById('rcrt-theme-variables');
    if (existingStyle) {
      existingStyle.remove();
    }

    // Create and inject new style
    const style = document.createElement('style');
    style.id = 'rcrt-theme-variables';
    style.textContent = css;
    document.head.appendChild(style);

    console.log('💅 Theme CSS variables injected');

    return () => {
      const styleToRemove = document.getElementById('rcrt-theme-variables');
      if (styleToRemove) {
        styleToRemove.remove();
      }
    };
  }, [themeQuery.data]);

  const value: ThemeProviderContextValue = {
    theme: themeQuery.data || getDefaultTheme(),
    loading: themeQuery.isLoading,
    error: themeQuery.error as Error | null,
    setTheme: setSelectedThemeId,
  };

  return (
    <ThemeProviderContext.Provider value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

/**
 * Default theme matching RCRT's existing design
 */
function getDefaultTheme(): ThemeContextType {
  return {
    name: 'RCRT Default Dark',
    colors: {
      primary: '#00f5ff',
      primaryHover: '#00d4e6',
      primaryActive: '#00b3cc',
      secondary: '#a855f7',
      secondaryHover: '#9333ea',
      secondaryActive: '#7e22ce',
      background: '#0f1117',
      backgroundAlt: '#1a1d2e',
      surface: '#1a1d2e',
      surfaceAlt: '#252938',
      text: '#ffffff',
      textSecondary: '#9ca3af',
      textTertiary: '#6b7280',
      textInverse: '#000000',
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#3b82f6',
      border: 'rgba(255, 255, 255, 0.1)',
      borderLight: 'rgba(255, 255, 255, 0.05)',
      borderDark: 'rgba(255, 255, 255, 0.2)',
      nodeTool: '#00ff88',
      nodeSecret: '#ff6384',
      nodeAgent: '#9333ea',
      nodeBreadcrumb: '#00f5ff',
    },
    fonts: {
      main: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      mono: 'ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, monospace',
      heading: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
    },
    spacing: {
      unit: 4,
      xs: 8,
      sm: 12,
      md: 16,
      lg: 24,
      xl: 32,
    },
    borderRadius: {
      sm: '0.375rem',
      md: '0.5rem',
      lg: '0.75rem',
      xl: '1rem',
      full: '9999px',
    },
    shadows: {
      sm: '0 1px 2px 0 rgba(0, 0, 0, 0.05)',
      md: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      lg: '0 10px 15px -3px rgba(0, 0, 0, 0.1)',
      xl: '0 20px 25px -5px rgba(0, 0, 0, 0.1)',
    },
    animations: {
      duration: {
        fast: '150ms',
        normal: '300ms',
        slow: '500ms',
      },
      easing: {
        default: 'cubic-bezier(0.4, 0, 0.2, 1)',
        in: 'cubic-bezier(0.4, 0, 1, 1)',
        out: 'cubic-bezier(0, 0, 0.2, 1)',
        inOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  };
}

