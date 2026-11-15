/**
 * Modal dialog shell: overlay, header with close button, Escape / outside-click to close.
 */
import React, { useEffect } from 'react';

interface ModalProps {
  title: React.ReactNode;
  onClose: () => void;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'wide';
  /** Prevents closing (e.g. while saving) */
  locked?: boolean;
}

export const Modal: React.FC<ModalProps> = ({ title, onClose, children, size = 'md', locked }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !locked && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, locked]);

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && !locked && onClose()}>
      <div className={`modal${size === 'wide' ? ' modal-wide' : size === 'sm' ? ' modal-sm' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h2>{title}</h2>
          <button type="button" className="modal-close" onClick={onClose} disabled={locked} aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
};
