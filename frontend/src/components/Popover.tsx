/**
 * Small anchored popover rendered in a portal (so it is never clipped by
 * scrollable table wrappers). Closes on outside click, Escape, scroll and resize.
 */
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import './Pipeline.css';

interface PopoverProps {
  anchor: HTMLElement | null;
  onClose: () => void;
  children: React.ReactNode;
  className?: string;
  align?: 'left' | 'right';
}

export const Popover: React.FC<PopoverProps> = ({ anchor, onClose, children, className = '', align = 'left' }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  useLayoutEffect(() => {
    if (!anchor || !ref.current) return;
    const a = anchor.getBoundingClientRect();
    const p = ref.current.getBoundingClientRect();
    const margin = 8;
    let left = align === 'right' ? a.right - p.width : a.left;
    left = Math.max(margin, Math.min(left, window.innerWidth - p.width - margin));
    let top = a.bottom + 6;
    if (top + p.height > window.innerHeight - margin) {
      // not enough room below: flip above if it fits there, otherwise pin to the viewport bottom
      top = a.top - p.height - 6 > margin ? a.top - p.height - 6 : Math.max(margin, window.innerHeight - p.height - margin);
    }
    setPos({ top, left });
  }, [anchor, align]);

  useEffect(() => {
    // Capture phase + stopPropagation: Escape closes only the popover, not a modal underneath it
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
    };
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (ref.current?.contains(t) || anchor?.contains(t)) return;
      onClose();
    };
    const onScrollOrResize = (e: Event) => {
      // ignore scrolling inside the popover itself
      if (e.target instanceof Node && ref.current?.contains(e.target)) return;
      onClose();
    };
    document.addEventListener('keydown', onKey, true);
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', onScrollOrResize, true);
    window.addEventListener('resize', onScrollOrResize);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', onScrollOrResize, true);
      window.removeEventListener('resize', onScrollOrResize);
    };
  }, [anchor, onClose]);

  if (!anchor) return null;

  return createPortal(
    <div
      ref={ref}
      className={`pl-popover ${className}`}
      style={{ top: pos?.top ?? -9999, left: pos?.left ?? -9999, visibility: pos ? 'visible' : 'hidden' }}
      role="dialog"
    >
      {children}
    </div>,
    document.body
  );
};
