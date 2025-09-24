import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';

interface AuthConfig {
  owner_id: string;
  agent_id: string;
  roles: string[];
}

interface AuthToken {
  token: string;
  owner_id: string;
  agent_id: string;
  roles: string[];
  exp: number;
}

/**
 * Authentication hook for RCRT Dashboard v2
 * Manages JWT token acquisition and renewal
 */
export function useAuthentication() {
  const [authToken, setAuthToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  // Dashboard v2 agent configuration (same pattern as v1)
  const authConfig: AuthConfig = {
    owner_id: "00000000-0000-0000-0000-000000000001",
    agent_id: "00000000-0000-0000-0000-000000000DDD", // Same as dashboard v1
    roles: ["curator", "emitter", "subscriber"]
  };
  
  // Query for JWT token
  const tokenQuery = useQuery({
    queryKey: ['auth-token'],
    queryFn: async (): Promise<AuthToken> => {
      console.log('🔐 Requesting JWT token for Dashboard v2...');
      console.log('Auth config:', authConfig);
      
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => {
          console.warn('⏰ Authentication request timed out after 10 seconds');
          controller.abort();
        }, 10000); // 10 second timeout
        
        // Use proxy for authentication (more reliable than direct connection)
        console.log('🔗 Attempting connection via proxy...');
        const response = await fetch('/api/auth/token', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(authConfig),
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        
        console.log('Auth response status:', response.status);
        console.log('Auth response headers:', Object.fromEntries(response.headers.entries()));
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Auth response error:', errorText);
          throw new Error(`Failed to get JWT token: ${response.status} ${response.statusText} - ${errorText}`);
        }
        
        const tokenData = await response.json();
        console.log('✅ JWT token acquired for agent:', tokenData.agent_id);
        console.log('Token expires at:', new Date(tokenData.exp * 1000));
        
        return tokenData;
      } catch (error) {
        console.error('❌ Proxy authentication error:', error);
        if (error.name === 'AbortError') {
          throw new Error('Authentication request timed out after 10 seconds');
        }
        throw error;
      }
    },
    staleTime: 50 * 60 * 1000, // 50 minutes (tokens expire in 60 minutes)
    refetchInterval: 50 * 60 * 1000, // Auto-refresh before expiry
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
    networkMode: 'always', // Try even if offline
  });
  
  // Update auth state when token changes
  useEffect(() => {
    if (tokenQuery.data?.token) {
      setAuthToken(tokenQuery.data.token);
      setIsAuthenticated(true);
      console.log('🔑 Authentication successful for Dashboard v2');
    } else {
      setAuthToken(null);
      setIsAuthenticated(false);
    }
  }, [tokenQuery.data]);
  
  // Create authenticated fetch function (use proxy like before)
  const authenticatedFetch = async (url: string, options: RequestInit = {}) => {
    if (!authToken) {
      throw new Error('No authentication token available');
    }
    
    const headers = {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    };
    
    console.log('🌐 Authenticated request via proxy to:', url);
    return fetch(url, {
      ...options,
      headers,
    });
  };
  
  return {
    isAuthenticated,
    authToken,
    authConfig,
    authenticatedFetch,
    isLoading: tokenQuery.isLoading,
    error: tokenQuery.error,
    refetchToken: tokenQuery.refetch,
  };
}


