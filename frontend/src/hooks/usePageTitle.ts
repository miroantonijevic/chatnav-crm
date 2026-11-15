import { useEffect } from 'react';

/** Sets the browser tab title, e.g. "Pipeline · CRM". */
export function usePageTitle(title: string | undefined) {
  useEffect(() => {
    document.title = title ? `${title} · CRM` : 'CRM';
  }, [title]);
}
