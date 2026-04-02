import { useState, useEffect, useCallback } from 'react';

/**
 * A hook to automatically save form draft to localStorage.
 * 
 * @param key The localStorage key
 * @param initialData The default state if nothing is found in localStorage
 * @param delay Auto-save interval threshold or debounce threshold (ms)
 * @returns [data, setData, clearDraft]
 */
export function useAutoSaveDraft<T>(key: string, initialData: T, delay: number = 3000): [T, React.Dispatch<React.SetStateAction<T>>, () => void] {
  // Try to load from localStorage first
  const [data, setData] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      if (item) {
        return JSON.parse(item) as T;
      }
    } catch (error) {
      console.warn(`Error reading localStorage ${key}`, error);
    }
    return initialData;
  });

  // Effect to save to localStorage with a simple interval strategy 
  // or a debounce strategy. We will use a debounce here if data changes.
  useEffect(() => {
    const handler = setTimeout(() => {
      try {
        // We might not be able to serialize File objects properly in JSON.stringify.
        // Files will be dropped in localStorage and we would have to re-upload them.
        // For simple drafts, this is an acceptable tradeoff since files are large.
        window.localStorage.setItem(key, JSON.stringify(data, (k, v) => {
          if (v instanceof File) {
             return undefined; // Optionally omit files as they cannot be serialized
          }
          return v;
        }));
      } catch (error) {
        console.warn(`Error writing to localStorage ${key}`, error);
      }
    }, delay);

    return () => clearTimeout(handler);
  }, [data, key, delay]);

  const clearDraft = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.error(error);
    }
    setData(initialData);
  }, [key, initialData]);

  return [data, setData, clearDraft];
}
