import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Box,
  Flex,
  Heading,
  Note,
  Paragraph,
  Badge,
  Button,
  Text,
  SectionHeading,
} from '@contentful/f36-components';
import tokens from '@contentful/f36-tokens';
import { useSDK } from '@contentful/react-apps-toolkit';
import type { PageAppSDK } from '@contentful/app-sdk';

import { generateLogEvent, type LogEvent } from '../lib/syntheticLogs';
import { MetricCard } from '../components/MetricCard';
import { LogStream } from '../components/LogStream';
import { SparkBar } from '../components/SparkBar';

const TICK_MS = 800;
const WINDOW_SECONDS = 30;
const SPARK_BUCKETS = 20;

interface Stats {
  total: number;
  ok: number;
  errors: number;
  rateLimit: number;
  latencies: number[];
}

function percentile(sorted: number[], p: number): number {
  if (!sorted.length) return 0;
  return sorted[Math.floor(sorted.length * p)] ?? sorted[sorted.length - 1];
}

export function ObservabilityPage() {
  const sdk = useSDK<PageAppSDK>();
  const spaceId = sdk.ids.space;

  const [running, setRunning] = useState(true);
  const [logs, setLogs] = useState<LogEvent[]>([]);
  const [stats, setStats] = useState<Stats>({ total: 0, ok: 0, errors: 0, rateLimit: 0, latencies: [] });
  const [buckets, setBuckets] = useState<number[]>(Array(SPARK_BUCKETS).fill(0));
  const [latencyBuckets, setLatencyBuckets] = useState<number[]>(Array(SPARK_BUCKETS).fill(0));

  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const bucketRef = useRef<number[]>(Array(SPARK_BUCKETS).fill(0));
  const latBucketRef = useRef<number[]>(Array(SPARK_BUCKETS).fill(0));
  const bucketTickRef = useRef(0);

  const emitLog = useCallback(() => {
    const log = generateLogEvent(spaceId);
    setLogs((prev) => [...prev.slice(-500), log]);
    setStats((prev) => {
      const latencies = [...prev.latencies.slice(-300), log.latencyMs];
      return {
        total: prev.total + 1,
        ok: prev.ok + (log.status < 400 ? 1 : 0),
        errors: prev.errors + (log.status >= 500 ? 1 : 0),
        rateLimit: prev.rateLimit + (log.status === 429 ? 1 : 0),
        latencies,
      };
    });

    // Update spark buckets (rolling window)
    bucketRef.current[bucketTickRef.current % SPARK_BUCKETS]++;
    latBucketRef.current[bucketTickRef.current % SPARK_BUCKETS] = log.latencyMs;
  }, [spaceId]);

  // Rotate spark bucket every (WINDOW_SECONDS / SPARK_BUCKETS) seconds
  useEffect(() => {
    const interval = setInterval(() => {
      bucketTickRef.current++;
      const idx = bucketTickRef.current % SPARK_BUCKETS;
      bucketRef.current[idx] = 0; // reset next bucket
      latBucketRef.current[idx] = 0;
      setBuckets([...bucketRef.current]);
      setLatencyBuckets([...latBucketRef.current]);
    }, (WINDOW_SECONDS / SPARK_BUCKETS) * 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!running) {
      if (tickRef.current) clearInterval(tickRef.current);
      return;
    }
    tickRef.current = setInterval(() => {
      // Emit 1–3 events per tick to simulate bursts
      const count = Math.random() > 0.7 ? 2 : 1;
      for (let i = 0; i < count; i++) emitLog();
    }, TICK_MS);
    return () => { if (tickRef.current) clearInterval(tickRef.current); };
  }, [running, emitLog]);

  const sortedLatencies = useMemo(() => [...stats.latencies].sort((a, b) => a - b), [stats.latencies]);
  const p50 = percentile(sortedLatencies, 0.5);
  const p90 = percentile(sortedLatencies, 0.9);
  const p99 = percentile(sortedLatencies, 0.99);
  const reqPerSec = (stats.total / Math.max(1, logs.length * (TICK_MS / 1000))).toFixed(1);
  const errorRate = stats.total > 0 ? ((stats.errors / stats.total) * 100).toFixed(1) : '0.0';

  // Top routes
  const routeCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const log of logs) {
      map.set(log.route, (map.get(log.route) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [logs.length]);

  // Top consumers
  const consumerCounts = useMemo(() => {
    const map = new Map<string, number>();
    for (const log of logs) {
      map.set(log.consumer, (map.get(log.consumer) ?? 0) + 1);
    }
    return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [logs.length]);

  return (
    <Box padding="spacingXl" style={{ maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <Flex justifyContent="space-between" alignItems="center" marginBottom="spacingL">
        <Box>
          <Heading marginBottom="none">Observability Dashboard</Heading>
          <Paragraph fontColor="gray500" marginBottom="none">
            Live CDA traffic — Space{' '}
            <code style={{ fontFamily: 'monospace', fontSize: 13 }}>{spaceId}</code>
          </Paragraph>
        </Box>
        <Flex gap="spacingS" alignItems="center">
          <Badge variant={running ? 'positive' : 'secondary'}>
            {running ? '● LIVE' : '⏸ PAUSED'}
          </Badge>
          <Button size="small" variant="secondary" onClick={() => setRunning((r) => !r)}>
            {running ? 'Pause' : 'Resume'}
          </Button>
          <Button
            size="small"
            variant="negative"
            onClick={() => {
              setLogs([]);
              setStats({ total: 0, ok: 0, errors: 0, rateLimit: 0, latencies: [] });
            }}
          >
            Clear
          </Button>
        </Flex>
      </Flex>

      <Note variant="neutral" style={{ marginBottom: tokens.spacingL }}>
        This dashboard streams synthetic CDA log events to simulate Contentful Enterprise Observability.
        In production, logs flow from Contentful → S3 → this viewer via the configured export stream.
        See{' '}
        <a
          href="https://www.contentful.com/developers/docs/concepts/enterprise-observability/"
          target="_blank"
          rel="noreferrer"
        >
          Enterprise Observability docs
        </a>.
      </Note>

      {/* KPI row */}
      <Flex gap="spacingM" marginBottom="spacingL" style={{ flexWrap: 'wrap' }}>
        <MetricCard label="Total Requests" value={stats.total.toLocaleString()} color={tokens.colorPrimary} />
        <MetricCard label="Success (2xx)" value={stats.ok.toLocaleString()} color={tokens.colorPositive} sub={`${stats.total > 0 ? (100 - parseFloat(errorRate)).toFixed(1) : 100}% success rate`} />
        <MetricCard label="5xx Errors" value={stats.errors} color={stats.errors > 0 ? tokens.colorNegative : tokens.colorPositive} />
        <MetricCard label="Rate Limited (429)" value={stats.rateLimit} color={stats.rateLimit > 0 ? tokens.colorWarning : tokens.colorPositive} />
        <MetricCard label="p50 Latency" value={`${p50}ms`} color={p50 > 200 ? tokens.colorNegative : tokens.colorPositive} />
        <MetricCard label="p90 Latency" value={`${p90}ms`} color={p90 > 200 ? tokens.colorWarning : tokens.colorPositive} />
        <MetricCard label="p99 Latency" value={`${p99}ms`} color={p99 > 300 ? tokens.colorNegative : tokens.colorWarning} />
      </Flex>

      {/* Spark charts */}
      <Flex gap="spacingXl" marginBottom="spacingL" style={{ flexWrap: 'wrap' }}>
        <Box style={{ flex: 1, minWidth: 200 }}>
          <SectionHeading marginBottom="spacingS">Requests / {WINDOW_SECONDS}s window</SectionHeading>
          <SparkBar data={buckets} label="req/bucket" color={tokens.colorPrimary} />
        </Box>
        <Box style={{ flex: 1, minWidth: 200 }}>
          <SectionHeading marginBottom="spacingS">Latency trend (ms)</SectionHeading>
          <SparkBar data={latencyBuckets} label="ms/bucket" color={tokens.colorWarning} />
        </Box>
        <Box style={{ flex: 1, minWidth: 200 }}>
          <SectionHeading marginBottom="spacingS">Top Routes</SectionHeading>
          {routeCounts.map(([route, count]) => (
            <Flex key={route} justifyContent="space-between" marginBottom="spacingXs">
              <Text fontSize="fontSizeS" style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: tokens.gray700, fontFamily: 'monospace' }}>
                {route}
              </Text>
              <Badge variant="secondary">{count}</Badge>
            </Flex>
          ))}
        </Box>
        <Box style={{ flex: 1, minWidth: 160 }}>
          <SectionHeading marginBottom="spacingS">Top Consumers</SectionHeading>
          {consumerCounts.map(([consumer, count]) => (
            <Flex key={consumer} justifyContent="space-between" marginBottom="spacingXs">
              <Text fontSize="fontSizeS" style={{ color: tokens.gray700 }}>{consumer}</Text>
              <Badge variant="primary">{count}</Badge>
            </Flex>
          ))}
        </Box>
      </Flex>

      {/* Live log stream */}
      <SectionHeading marginBottom="spacingS">Live Log Stream</SectionHeading>
      <LogStream logs={logs} />
    </Box>
  );
}
