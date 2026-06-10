import { useEffect, useRef } from 'react';

/**
 * Saves window scroll position to sessionStorage continuously (on scroll event)
 * and restores it once `ready` becomes true (after data loads).
 * Saving on scroll—not unmount—because the browser resets scrollY to 0
 * before React unmounts the component.
 */
export function useScrollRestoration(key: string, ready: boolean = true) {
  const restored = useRef(false);

  // Save scroll position on every scroll event
  useEffect(() => {
    const onScroll = () => {
      if (window.scrollY > 0) {
        sessionStorage.setItem(key, String(Math.round(window.scrollY)));
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [key]);

  // Restore scroll after content is ready
  useEffect(() => {
    if (!ready || restored.current) return;
    restored.current = true;
    const saved = sessionStorage.getItem(key);
    if (!saved || saved === '0') return;
    const y = parseInt(saved, 10);
    const t = setTimeout(() => {
      window.scrollTo({ top: y, behavior: 'instant' as ScrollBehavior });
    }, 50);
    return () => clearTimeout(t);
  }, [key, ready]);
}
