export interface AuditLogFile {
  key: string;
  date: string;
  label: string;
  sizeBytes?: number;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  activityName: string;
  activityId: number;
  actorType: string;
  actorName: string;
  actorEmail?: string;
  actorId: string;
  method: string;
  path: string;
  status: number;
  spaceId?: string;
  environmentId?: string;
  resourceTypes: string[];
  resourceIds: string[];
  roleId?: string;
  referrer?: string;
}

interface RawOcsfEntry {
  activity_name?: string;
  activity_id?: number;
  time?: string;
  actor?: {
    id?: string;
    type?: string;
    user?: {
      uid?: string;
      full_name?: string;
      email_addr?: string;
    };
  };
  enrichments?: Array<{
    type?: string;
    data?: { id?: string };
  }>;
  http_request?: {
    http_method?: string;
    referrer?: string;
    url?: { path?: string };
  };
  http_response?: { code?: number };
  web_resources?: Array<{ type?: string; uid?: string }>;
  metadata?: { uid?: string };
}

const AUDIT_API_BASE = (import.meta.env.VITE_AUDIT_API_URL as string | undefined)?.replace(/\/$/, '');

export function isAuditApiConfigured(): boolean {
  return Boolean(AUDIT_API_BASE);
}

export async function listAuditLogs(): Promise<AuditLogFile[]> {
  if (!AUDIT_API_BASE) throw new Error('VITE_AUDIT_API_URL not configured');
  const res = await fetch(`${AUDIT_API_BASE}/logs`);
  if (!res.ok) throw new Error(`List request failed: ${res.status}`);
  const { files } = (await res.json()) as { files: AuditLogFile[] };
  return files;
}

export async function fetchAuditLog(key: string): Promise<AuditEvent[]> {
  if (!AUDIT_API_BASE) throw new Error('VITE_AUDIT_API_URL not configured');
  const res = await fetch(`${AUDIT_API_BASE}/logs/entries?key=${encodeURIComponent(key)}`);
  if (!res.ok) throw new Error(`Fetch request failed: ${res.status}`);
  const { entries } = (await res.json()) as { entries: RawOcsfEntry[] };
  return entries.map(mapOcsfEntry);
}

export function mapOcsfEntry(raw: RawOcsfEntry): AuditEvent {
  const enrichments = raw.enrichments ?? [];
  const spaceId = enrichmentId(enrichments, 'spaces', 'space');
  const environmentId = enrichmentId(enrichments, 'environments', 'environment');
  const webResources = raw.web_resources ?? [];
  const roleId =
    webResources.find((r) => r.type === 'Role')?.uid ??
    enrichmentId(enrichments, 'roles', 'role');

  const actorType = raw.actor?.type ?? 'Unknown';
  const actorId = raw.actor?.user?.uid ?? raw.actor?.id ?? 'unknown';
  const actorName =
    raw.actor?.user?.full_name ??
    raw.actor?.user?.email_addr ??
    (actorType === 'App' ? `App ${actorId.slice(0, 12)}…` : actorId);

  return {
    id: raw.metadata?.uid ?? `${raw.time}-${actorId}-${raw.http_request?.url?.path ?? ''}`,
    timestamp: normalizeTimestamp(raw.time),
    activityName: raw.activity_name ?? 'Unknown',
    activityId: raw.activity_id ?? 0,
    actorType,
    actorName,
    actorEmail: raw.actor?.user?.email_addr,
    actorId,
    method: (raw.http_request?.http_method ?? '—').toUpperCase(),
    path: raw.http_request?.url?.path ?? '/',
    status: raw.http_response?.code ?? 0,
    spaceId: spaceId ?? parseSpaceFromPath(raw.http_request?.url?.path),
    environmentId: environmentId ?? parseEnvironmentFromPath(raw.http_request?.url?.path),
    resourceTypes: [...new Set(webResources.map((r) => r.type).filter(Boolean) as string[])],
    resourceIds: webResources.map((r) => r.uid).filter(Boolean) as string[],
    roleId,
    referrer: raw.http_request?.referrer,
  };
}

function enrichmentId(
  enrichments: NonNullable<RawOcsfEntry['enrichments']>,
  ...types: string[]
): string | undefined {
  const normalized = new Set(types.map((t) => t.toLowerCase()));
  return enrichments.find((e) => e.type && normalized.has(e.type.toLowerCase()))?.data?.id;
}

function parseSpaceFromPath(path?: string): string | undefined {
  const match = path?.match(/^\/spaces\/([^/]+)/);
  return match?.[1];
}

function parseEnvironmentFromPath(path?: string): string | undefined {
  const match = path?.match(/^\/spaces\/[^/]+\/environments\/([^/]+)/);
  return match?.[1];
}

function normalizeTimestamp(time?: string): string {
  if (!time) return new Date().toISOString();
  if (time.includes('T')) return time;
  return time.replace(' ', 'T') + 'Z';
}

export function getYesterdayDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function uniqueSorted(values: (string | undefined)[]): string[] {
  return [...new Set(values.filter(Boolean) as string[])].sort();
}
