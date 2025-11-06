/**
 * Comprehensive Error Handling
 * Handles token refresh, version conflicts, network errors
 */

export class RCRTError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode?: number,
    public retryable: boolean = false
  ) {
    super(message);
    this.name = 'RCRTError';
  }
}

/**
 * Parse error from RCRT API response
 */
export function parseRCRTError(error: any): RCRTError {
  if (error instanceof RCRTError) {
    return error;
  }

  const message = error.message || 'Unknown error';
  
  // Network errors
  if (message.includes('Failed to fetch') || message.includes('NetworkError')) {
    return new RCRTError(
      'Cannot connect to RCRT server. Is it running?',
      'NETWORK_ERROR',
      undefined,
      true
    );
  }

  // Authentication errors
  if (message.includes('401') || message.includes('Unauthorized')) {
    return new RCRTError(
      'Authentication failed. Token may have expired.',
      'AUTH_ERROR',
      401,
      true
    );
  }

  // Version conflict errors
  if (message.includes('412') || message.includes('version_mismatch')) {
    return new RCRTError(
      'Version conflict. The breadcrumb was modified by another process.',
      'VERSION_CONFLICT',
      412,
      true
    );
  }

  // Not found errors
  if (message.includes('404') || message.includes('not found')) {
    return new RCRTError(
      'Resource not found',
      'NOT_FOUND',
      404,
      false
    );
  }

  // Server errors
  if (message.includes('500') || message.includes('Internal Server Error')) {
    return new RCRTError(
      'RCRT server error. Please try again later.',
      'SERVER_ERROR',
      500,
      true
    );
  }

  // Generic error
  return new RCRTError(
    message,
    'UNKNOWN_ERROR',
    undefined,
    false
  );
}

/**
 * Retry logic with exponential backoff
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  options: {
    maxAttempts?: number;
    initialDelay?: number;
    maxDelay?: number;
    shouldRetry?: (error: RCRTError) => boolean;
  } = {}
): Promise<T> {
  const {
    maxAttempts = 3,
    initialDelay = 1000,
    maxDelay = 10000,
    shouldRetry = (error) => error.retryable
  } = options;

  let lastError: RCRTError | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = parseRCRTError(error);

      if (!shouldRetry(lastError)) {
        throw lastError;
      }

      if (attempt < maxAttempts - 1) {
        const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);
        console.log(`[ErrorHandler] Retry attempt ${attempt + 1}/${maxAttempts} in ${delay}ms`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}

/**
 * User-friendly error messages
 */
export function getUserFriendlyMessage(error: RCRTError): string {
  switch (error.code) {
    case 'NETWORK_ERROR':
      return 'Cannot connect to RCRT server. Please check that it is running on the configured URL.';
    
    case 'AUTH_ERROR':
      return 'Authentication failed. The extension will attempt to reconnect.';
    
    case 'VERSION_CONFLICT':
      return 'The data was modified elsewhere. Your changes may have been lost.';
    
    case 'NOT_FOUND':
      return 'The requested item was not found. It may have been deleted.';
    
    case 'SERVER_ERROR':
      return 'RCRT server encountered an error. Please try again in a moment.';
    
    default:
      return error.message || 'An unexpected error occurred.';
  }
}

/**
 * Log error to breadcrumb (for debugging)
 */
export async function logErrorToBreadcrumb(
  client: any,
  error: RCRTError,
  context: Record<string, any> = {}
): Promise<void> {
  try {
    await client.createBreadcrumb({
      schema_name: 'extension.error.v1',
      title: `Extension Error: ${error.code}`,
      tags: ['extension:rcrt-v2', 'error', `error:${error.code.toLowerCase()}`],
      context: {
        error_code: error.code,
        error_message: error.message,
        status_code: error.statusCode,
        retryable: error.retryable,
        timestamp: new Date().toISOString(),
        ...context
      },
      ttl: new Date(Date.now() + 3600000).toISOString() // 1 hour TTL
    });
  } catch (logError) {
    // Silently fail if logging fails (don't cascade errors)
    console.error('[ErrorHandler] Failed to log error:', logError);
  }
}

