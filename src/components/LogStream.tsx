import React, { useEffect, useRef } from 'react';
import { Box, Text } from '@contentful/f36-components';
import tokens from '@contentful/f36-tokens';
import type { LogEvent } from '../lib/syntheticLogs';

interface LogStreamProps {
  logs: LogEvent[];
  maxVisible?: number;
}

function statusColor(status: number): string {
  if (status < 300) return tokens.colorPositive;
  if (status < 500) return tokens.colorWarning;
  return tokens.colorNegative;
}

export function LogStream({ logs, maxVisible = 50 }: LogStreamProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  const visible = logs.slice(-maxVisible);

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
        <Text style={{ color: '#8b949e' }}>Waiting for log events…</Text>
      )}
      {visible.map((log, i) => (
        <div key={i}>
          <span style={{ color: '#8b949e' }}>{log.timestamp.slice(11, 23)}</span>
          {'  '}
          <span style={{ color: statusColor(log.status), fontWeight: 600 }}>{log.status}</span>
          {'  '}
          <span style={{ color: '#79c0ff' }}>{log.method.padEnd(5)}</span>
          {'  '}
          <span style={{ color: log.latencyMs > 200 ? tokens.colorNegative : log.latencyMs > 100 ? tokens.colorWarning : tokens.colorPositive }}>
            {String(log.latencyMs).padStart(4)}ms
          </span>
          {'  '}
          <span style={{ color: '#e6edf3' }}>{log.route.slice(0, 60).padEnd(62)}</span>
          <span style={{ color: '#6e7681' }}>{log.consumer}</span>
        </div>
      ))}
      <div ref={bottomRef} />
    </Box>
  );
}
