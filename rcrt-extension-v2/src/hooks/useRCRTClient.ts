/**
 * React hook for accessing RCRT client
 */

import { useState, useEffect } from 'react';
import { getRCRTClient, RCRTClient } from '../lib/rcrt-client';

export function useRCRTClient() {
  const [client, setClient] = useState<RCRTClient | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    getRCRTClient()
      .then(c => {
        setClient(c);
        setLoading(false);
      })
      .catch(err => {
        setError(err);
        setLoading(false);
      });
  }, []);

  return { client, loading, error };
}

