import { useEffect } from 'react';

/** Sets a distinct browser tab title per page, e.g. "Approval · TRF Online MMS". */
export function useDocumentTitle(title: string) {
  useEffect(() => {
    document.title = title ? `${title} · TRF Online MMS` : 'TRF Online MMS';
  }, [title]);
}
