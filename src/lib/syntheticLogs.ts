export interface LogEvent {
  timestamp: string;
  method: string;
  route: string;
  status: number;
  latencyMs: number;
  consumer: string;
  spaceId: string;
}

const ROUTES = [
  '/entries?content_type=slide',
  '/entries?content_type=slideDeck',
  '/entries?query=advantage%2B',
  '/assets',
  '/entries?metadata.concepts.sys.id=meta-products',
  '/entries?fields.slideType=case-study',
  '/entries?content_type=crmAccount',
  '/entries?fields.theme=instagram',
  '/entries?content_type=slide&fields.slideType=statistics',
];

const CONSUMERS = [
  'meta-ai-agent',
  'slide-library-app',
  'cms-preview',
  'sales-portal',
  'analytics-job',
  'mcp-claude',
];

function randomChoice<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

export function generateLogEvent(spaceId: string): LogEvent {
  const latency = Math.floor(Math.random() * 280 + 20);
  const rand = Math.random();
  const status = rand > 0.04 ? 200 : rand > 0.02 ? 429 : 404;

  return {
    timestamp: new Date().toISOString(),
    method: 'GET',
    route: randomChoice(ROUTES),
    status,
    latencyMs: latency,
    consumer: randomChoice(CONSUMERS),
    spaceId,
  };
}
