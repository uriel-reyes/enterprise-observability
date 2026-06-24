import { useEffect, useMemo, useState } from 'react';
import { useSDK } from '@contentful/react-apps-toolkit';
import type { PageAppSDK } from '@contentful/app-sdk';
import type { AuditEvent } from '../lib/auditLogs';
import { enrichAuditNames, type AuditEnrichment } from '../lib/auditEnrichment';

const EMPTY: AuditEnrichment = { spaceNames: {}, roleNames: {}, loading: false };

function enrichmentCacheKey(events: AuditEvent[]): string {
  const spaces = [...new Set(events.map((e) => e.spaceId).filter(Boolean))].sort();
  const roles = events
    .filter((e) => e.spaceId && e.roleId)
    .map((e) => `${e.spaceId}:${e.roleId}`)
    .sort();
  return `${spaces.join(',')}|${roles.join(',')}`;
}

export function useAuditEnrichment(events: AuditEvent[]): AuditEnrichment {
  const sdk = useSDK<PageAppSDK>();
  const [state, setState] = useState<AuditEnrichment>(EMPTY);
  const cacheKey = useMemo(() => enrichmentCacheKey(events), [events]);

  useEffect(() => {
    if (events.length === 0) {
      setState(EMPTY);
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true }));

    enrichAuditNames(sdk.cma, events)
      .then(({ spaceNames, roleNames }) => {
        if (cancelled) return;
        setState({ spaceNames, roleNames, loading: false });
      })
      .catch(() => {
        if (cancelled) return;
        setState({ spaceNames: {}, roleNames: {}, loading: false });
      });

    return () => { cancelled = true; };
  }, [events, sdk.cma, cacheKey]);

  return state;
}
