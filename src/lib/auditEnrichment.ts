import type { PageAppSDK } from '@contentful/app-sdk';
import type { AuditEvent } from './auditLogs';
import { uniqueSorted } from './auditLogs';

export type NameMap = Record<string, string>;

export interface AuditEnrichment {
  spaceNames: NameMap;
  roleNames: NameMap;
  loading: boolean;
}

export function roleMapKey(spaceId: string, roleId: string): string {
  return `${spaceId}:${roleId}`;
}

export function collectSpaceIds(events: AuditEvent[]): string[] {
  return uniqueSorted(events.map((e) => e.spaceId));
}

export function collectRoleRefs(events: AuditEvent[]): Array<{ spaceId: string; roleId: string }> {
  const seen = new Set<string>();
  const refs: Array<{ spaceId: string; roleId: string }> = [];
  for (const event of events) {
    if (!event.roleId || !event.spaceId) continue;
    const key = roleMapKey(event.spaceId, event.roleId);
    if (seen.has(key)) continue;
    seen.add(key);
    refs.push({ spaceId: event.spaceId, roleId: event.roleId });
  }
  return refs;
}

export function displaySpaceName(spaceId: string | undefined, spaceNames: NameMap): string {
  if (!spaceId) return '—';
  return spaceNames[spaceId] ?? spaceId;
}

export function displayRoleName(
  spaceId: string | undefined,
  roleId: string | undefined,
  roleNames: NameMap,
): string | undefined {
  if (!spaceId || !roleId) return undefined;
  return roleNames[roleMapKey(spaceId, roleId)] ?? roleId;
}

export function displayResourceLabel(event: AuditEvent, roleNames: NameMap): string {
  const primary = event.resourceTypes[0] ?? '—';
  if (primary === 'Role' && event.roleId && event.spaceId) {
    const name = displayRoleName(event.spaceId, event.roleId, roleNames);
    return name ? `Role: ${name}` : `Role ${event.roleId}`;
  }
  return primary;
}

/**
 * Resolve human-readable space and role names via the Contentful App SDK CMA client.
 *
 * MCP research: list_spaces / get_space cover org spaces; there is no role MCP tool —
 * roles are fetched with sdk.cma.role.getMany (per space) or sdk.cma.role.get (single).
 */
export async function enrichAuditNames(
  cma: PageAppSDK['cma'],
  events: AuditEvent[],
): Promise<{ spaceNames: NameMap; roleNames: NameMap }> {
  const spaceNames: NameMap = {};
  const roleNames: NameMap = {};

  const spaceIds = collectSpaceIds(events);
  await Promise.all(
    spaceIds.map(async (spaceId) => {
      try {
        const space = await cma.space.get({ spaceId });
        spaceNames[spaceId] = space.name;
      } catch {
        spaceNames[spaceId] = spaceId;
      }
    }),
  );

  const roleRefs = collectRoleRefs(events);
  const rolesBySpace = new Map<string, Set<string>>();
  for (const { spaceId, roleId } of roleRefs) {
    if (!rolesBySpace.has(spaceId)) rolesBySpace.set(spaceId, new Set());
    rolesBySpace.get(spaceId)!.add(roleId);
  }

  await Promise.all(
    [...rolesBySpace.entries()].map(async ([spaceId, roleIds]) => {
      const needed = [...roleIds];
      try {
        const { items } = await cma.role.getMany({
          spaceId,
          query: { limit: 1000 },
        });
        for (const role of items) {
          const id = role.sys.id;
          if (roleIds.has(id)) {
            roleNames[roleMapKey(spaceId, id)] = role.name;
          }
        }
      } catch {
        // fall through to per-role fetch
      }

      for (const roleId of needed) {
        const key = roleMapKey(spaceId, roleId);
        if (roleNames[key]) continue;
        try {
          const role = await cma.role.get({ spaceId, roleId });
          roleNames[key] = role.name;
        } catch {
          roleNames[key] = roleId;
        }
      }
    }),
  );

  return { spaceNames, roleNames };
}
