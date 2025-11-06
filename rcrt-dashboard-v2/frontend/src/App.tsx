import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { HeroUIProvider } from '@heroui/react';
import { DashboardProvider } from './stores/DashboardStore';
import { ThemeProvider } from './components/theme/ThemeProvider';
import { AppRouter } from './components/routing/AppRouter';
import './App.css';

// Create a client
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      refetchOnWindowFocus: false,
      retry: 3,
    },
    mutations: {
      retry: 1,
    },
  },
});

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <main className="dark bg-background text-foreground" style={{ width: '100%', height: '100%' }}>
        <HeroUIProvider>
          <ThemeProvider defaultTheme="theme:default">
            <DashboardProvider>
              <AppRouter />
            </DashboardProvider>
          </ThemeProvider>
        </HeroUIProvider>
      </main>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}

export default App;
