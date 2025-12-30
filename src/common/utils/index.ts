/**
 * Common utility functions for the tracking backend
 */

/**
 * Generate a unique ID with optional prefix
 */
export const generateId = (prefix = ''): string => {
  const timestamp = Date.now().toString(36);
  const randomPart = Math.random().toString(36).substring(2, 10);
  return prefix ? `${prefix}_${timestamp}${randomPart}` : `${timestamp}${randomPart}`;
};

/**
 * Sleep for a specified number of milliseconds
 */
export const sleep = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Retry a function with exponential backoff
 */
export const retryWithBackoff = async <T>(
  fn: () => Promise<T>,
  options: {
    maxRetries?: number;
    initialDelayMs?: number;
    maxDelayMs?: number;
    backoffMultiplier?: number;
  } = {},
): Promise<T> => {
  const {
    maxRetries = 3,
    initialDelayMs = 100,
    maxDelayMs = 5000,
    backoffMultiplier = 2,
  } = options;

  let lastError: Error | undefined;
  let delay = initialDelayMs;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        await sleep(delay);
        delay = Math.min(delay * backoffMultiplier, maxDelayMs);
      }
    }
  }

  throw lastError;
};

/**
 * Safely parse JSON with a fallback value
 */
export const safeJsonParse = <T>(json: string, fallback: T): T => {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
};

/**
 * Deep clone an object using JSON serialization
 */
export const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Check if a value is a non-null object
 */
export const isObject = (value: unknown): value is Record<string, unknown> => {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
};

/**
 * Pick specific keys from an object
 */
export const pick = <T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[],
): Pick<T, K> => {
  const result = {} as Pick<T, K>;
  for (const key of keys) {
    if (key in obj) {
      result[key] = obj[key];
    }
  }
  return result;
};

/**
 * Omit specific keys from an object
 */
export const omit = <T extends Record<string, unknown>, K extends keyof T>(
  obj: T,
  keys: K[],
): Omit<T, K> => {
  const result = { ...obj };
  for (const key of keys) {
    delete result[key];
  }
  return result as Omit<T, K>;
};

/**
 * Group an array of objects by a key
 */
export const groupBy = <T, K extends string | number>(
  array: T[],
  keyFn: (item: T) => K,
): Record<K, T[]> => {
  return array.reduce(
    (result, item) => {
      const key = keyFn(item);
      if (!result[key]) {
        result[key] = [];
      }
      result[key].push(item);
      return result;
    },
    {} as Record<K, T[]>,
  );
};

/**
 * Chunk an array into smaller arrays of a specified size
 */
export const chunk = <T>(array: T[], size: number): T[][] => {
  const result: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    result.push(array.slice(i, i + size));
  }
  return result;
};

/**
 * Debounce a function
 */
export const debounce = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  delayMs: number,
): ((...args: Parameters<T>) => void) => {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      fn(...args);
      timeoutId = null;
    }, delayMs);
  };
};

/**
 * Throttle a function
 */
export const throttle = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  limitMs: number,
): ((...args: Parameters<T>) => void) => {
  let lastRun = 0;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;

  return (...args: Parameters<T>) => {
    const now = Date.now();

    if (now - lastRun >= limitMs) {
      fn(...args);
      lastRun = now;
    } else if (!timeoutId) {
      timeoutId = setTimeout(
        () => {
          fn(...args);
          lastRun = Date.now();
          timeoutId = null;
        },
        limitMs - (now - lastRun),
      );
    }
  };
};

/**
 * Calculate distance between two GPS coordinates in meters (Haversine formula)
 */
export const calculateDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number => {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

/**
 * Format a date to ISO string with timezone
 */
export const formatDateTime = (date: Date): string => {
  return date.toISOString();
};

/**
 * Check if a date is within a time range
 */
export const isWithinTimeRange = (date: Date, startDate: Date, endDate: Date): boolean => {
  const timestamp = date.getTime();
  return timestamp >= startDate.getTime() && timestamp <= endDate.getTime();
};

/**
 * Create a timeout promise that rejects after a specified duration
 */
export const timeout = <T>(promise: Promise<T>, ms: number, message?: string): Promise<T> => {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(message || `Operation timed out after ${ms}ms`));
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]);
};

/**
 * Memoize a function with optional TTL
 */
export const memoize = <T extends (...args: unknown[]) => unknown>(
  fn: T,
  options: { ttlMs?: number; maxSize?: number } = {},
): T => {
  const cache = new Map<string, { value: ReturnType<T>; timestamp: number }>();
  const { ttlMs, maxSize = 100 } = options;

  return ((...args: Parameters<T>): ReturnType<T> => {
    const key = JSON.stringify(args);
    const cached = cache.get(key);
    const now = Date.now();

    if (cached) {
      if (!ttlMs || now - cached.timestamp < ttlMs) {
        return cached.value;
      }
      cache.delete(key);
    }

    const result = fn(...args) as ReturnType<T>;

    // Enforce max size by removing oldest entries
    if (cache.size >= maxSize) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey) {
        cache.delete(oldestKey);
      }
    }

    cache.set(key, { value: result, timestamp: now });
    return result;
  }) as T;
};
