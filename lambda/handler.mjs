/**
 * Lambda handler — thin S3 proxy for Contentful audit logs.
 *
 * Routes:
 *   GET /logs            → list all audit log objects in the bucket
 *   GET /logs/entries    → fetch and return parsed entries for a single key
 *                          query param: key=<s3-object-key>
 *
 * Environment variables (set in Lambda console or via IaC):
 *   S3_BUCKET_NAME   — bucket holding the audit log exports
 *   S3_BUCKET_REGION — AWS region of the bucket (required if different from Lambda region)
 *   ALLOWED_ORIGIN   — e.g. https://app.contentful.com (CORS allowed origin)
 */

import { S3Client, ListObjectsV2Command, GetObjectCommand } from '@aws-sdk/client-s3';

const BUCKET = process.env.S3_BUCKET_NAME;
const BUCKET_REGION = process.env.S3_BUCKET_REGION ?? process.env.AWS_REGION;
const s3 = new S3Client({ region: BUCKET_REGION });
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN ?? 'https://app.contentful.com';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': ALLOWED_ORIGIN,
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Content-Type': 'application/json',
};

function ok(body) {
  return { statusCode: 200, headers: CORS_HEADERS, body: JSON.stringify(body) };
}

function err(status, message) {
  return { statusCode: status, headers: CORS_HEADERS, body: JSON.stringify({ error: message }) };
}

function dateFromKey(key) {
  // Handles keys like:  audit-logs/2025-06-23.json
  //                     contentful/audit/2025-06-23/entries.json
  //                     2025/06/23/audit.json
  //                     contentful-audit-{orgId}-20260314T040157827Z.json
  const dashed = key.match(/(\d{4})[/-](\d{2})[/-](\d{2})/);
  if (dashed) return `${dashed[1]}-${dashed[2]}-${dashed[3]}`;

  const contentfulExport = key.match(/contentful-audit-[^-]+-(\d{4})(\d{2})(\d{2})T/i);
  if (contentfulExport) {
    return `${contentfulExport[1]}-${contentfulExport[2]}-${contentfulExport[3]}`;
  }

  return key;
}

function isAuditLogKey(key) {
  return key.endsWith('.json') && /contentful-audit-/i.test(key);
}

function labelFromDate(dateStr) {
  if (!dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) return dateStr;
  const d = new Date(`${dateStr}T00:00:00Z`);
  return d.toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', timeZone: 'UTC' });
}

async function listLogs() {
  const cmd = new ListObjectsV2Command({ Bucket: BUCKET });
  const res = await s3.send(cmd);
  const files = (res.Contents ?? [])
    .filter((o) => o.Key && isAuditLogKey(o.Key))
    .map((o) => {
      const date = dateFromKey(o.Key);
      return { key: o.Key, date, label: labelFromDate(date), sizeBytes: o.Size };
    })
    .sort((a, b) => b.date.localeCompare(a.date));   // newest first

  return ok({ files });
}

async function getEntries(key) {
  if (!key) return err(400, 'Missing key parameter');

  const cmd = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  const res = await s3.send(cmd);

  const raw = await res.Body.transformToString('utf-8');

  // Support both newline-delimited JSON and a JSON array
  let entries;
  try {
    const parsed = JSON.parse(raw);
    entries = Array.isArray(parsed) ? parsed : parsed.entries ?? parsed.records ?? [parsed];
  } catch {
    // Newline-delimited JSON (ndjson / jsonl)
    entries = raw
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => JSON.parse(line));
  }

  return ok({ entries });
}

export const handler = async (event) => {
  if (event.requestContext?.http?.method === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  const path = event.rawPath ?? event.path ?? '/';

  try {
    if (path === '/logs') return await listLogs();
    if (path === '/logs/entries') {
      const key = event.queryStringParameters?.key;
      return await getEntries(key);
    }
    return err(404, 'Not found');
  } catch (e) {
    console.error(e);
    return err(502, e.message ?? 'Internal error');
  }
};
