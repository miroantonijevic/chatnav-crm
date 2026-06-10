import { useEffect } from 'react';

/**
 * Saves window scroll position to sessionStorage on unmount and restores it on mount.
 * Use a unique key per page (e.g. 'scroll:dashboard').
 */
export function useScrollRestoration(key: string) {
  useEffect(() => {
    const saved = sessionStorage.getItem(key);
    if (saved !== null) {
      window.scrollTo(0, parseInt(saved, 10));
    }
    return () => {
      sessionStorage.setItem(key, String(Math.round(window.scrollY)));
    };
  }, [key]);
}
