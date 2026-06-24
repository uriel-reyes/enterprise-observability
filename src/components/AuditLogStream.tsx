import React, { useMemo } from 'react';
import { Box, Text } from '@contentful/f36-components';
import tokens from '@contentful/f36-tokens';
import type { AuditEvent } from '../lib/auditLogs';
import { displayResourceLabel, displaySpaceName, type NameMap } from '../lib/auditEnrichment';

interface AuditLogStreamProps {
  events: AuditEvent[];
  spaceNames: NameMap;
  roleNames: NameMap;
  maxVisible?: number;
}

function activityColor(name: string): string {
  if (name === 'Create') return tokens.colorPositive;
  if (name === 'Update') return tokens.colorPrimary;
  if (name === 'Delete') return tokens.colorNegative;
  return tokens.gray500;
}

function statusColor(status: number): string {
  if (status >= 500) return tokens.colorNegative;
  if (status >= 400) return tokens.colorWarning;
  return tokens.colorPositive;
}

export function AuditLogStream({ events, spaceNames, roleNames, maxVisible = 50 }: AuditLogStreamProps) {
  const visible = useMemo(() => events.slice(-maxVisible), [events, maxVisible]);

  return (
    <Box
      style={{
        background: '#0d1117',
        borderRadius: tokens.borderRadiusMedium,
        padding: tokens.spacingM,
        height: 360,
        overflowY: 'auto',
        fontFamily: 'monospace',
        fontSize: 12,
        lineHeight: '1.8',
      }}
    >
      {visible.length === 0 && (
        <Text style={{ color: '#8b949e' }}>No audit events match the current filters.</Text>
      )}
      {visible.map((event) => {
        const spaceLabel = displaySpaceName(event.spaceId, spaceNames);
        const resourceLabel = displayResourceLabel(event, roleNames);

        return (
          <div key={event.id}>
            <span style={{ color: '#8b949e' }}>{event.timestamp.slice(11, 23)}</span>
            {'  '}
            <span style={{ color: activityColor(event.activityName), fontWeight: 600 }}>
              {event.activityName.padEnd(6)}
            </span>
            {'  '}
            <span style={{ color: statusColor(event.status), fontWeight: 600 }}>{event.status}</span>
            {'  '}
            <span style={{ color: '#79c0ff' }}>{event.method.padEnd(6)}</span>
            {'  '}
            <span style={{ color: '#e6edf3' }}>{event.actorName.slice(0, 22).padEnd(24)}</span>
            {'  '}
            <span style={{ color: '#ffa657' }}>{spaceLabel.slice(0, 16).padEnd(18)}</span>
            {'  '}
            <span style={{ color: '#d2a8ff' }}>
              {resourceLabel.slice(0, 22).padEnd(24)}
            </span>
            {'  '}
            <span style={{ color: '#e6edf3' }}>{event.path.slice(0, 40)}</span>
          </div>
        );
      })}
    </Box>
  );
}
