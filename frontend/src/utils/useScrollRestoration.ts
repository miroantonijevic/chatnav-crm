import { useEffect, useRef } from 'react';

/**
 * Saves window scroll position to sessionStorage on unmount and restores it
 * once `ready` becomes true (i.e. after data has loaded and the page has full height).
 */
export function useScrollRestoration(key: string, ready: boolean = true) {
  const restored = useRef(false);

  // Restore scroll after content is ready
  useEffect(() => {
    if (!ready || restored.current) return;
    restored.current = true;
    const saved = sessionStorage.getItem(key);
    if (saved === null) return;
    const y = parseInt(saved, 10);
    // Delay to run after browser's own scroll restoration and React painting
    const t = setTimeout(() => {
      window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
    }, 150);
    return () => clearTimeout(t);
  }, [key, ready]);

  // Save scroll on unmount
  useEffect(() => {
    return () => {
      sessionStorage.setItem(key, String(Math.round(window.scrollY)));
    };
  }, [key]);
}
