import React, { useEffect, useMemo, useState } from 'react';
import {
  Box,
  Flex,
  Heading,
  Note,
  Paragraph,
  Badge,
  Text,
  SectionHeading,
  Select,
  Spinner,
} from '@contentful/f36-components';
import tokens from '@contentful/f36-tokens';

import {
  isAuditApiConfigured,
  listAuditLogs,
  fetchAuditLog,
  getYesterdayDate,
  uniqueSorted,
  type AuditEvent,
  type AuditLogFile,
} from '../lib/auditLogs';
import {
  displaySpaceName,
  roleMapKey,
} from '../lib/auditEnrichment';
import { useAuditEnrichment } from '../hooks/useAuditEnrichment';
import { MetricCard } from '../components/MetricCard';
import { AuditLogStream } from '../components/AuditLogStream';

const ALL = '__all__';

function countBy<T>(items: T[], keyFn: (item: T) => string | undefined, limit = 5) {
  const map = new Map<string, number>();
  for (const item of items) {
    const key = keyFn(item);
    if (!key) continue;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  return [...map.entries()].sort((a, b) => b[1] - a[1]).slice(0, limit);
}

export function AuditLogPage() {
  const [files, setFiles] = useState<AuditLogFile[]>([]);
  const [selectedKey, setSelectedKey] = useState('');
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [filterUser, setFilterUser] = useState(ALL);
  const [filterActivity, setFilterActivity] = useState(ALL);
  const [filterResource, setFilterResource] = useState(ALL);
  const [filterSpace, setFilterSpace] = useState(ALL);
  const [filterEnvironment, setFilterEnvironment] = useState(ALL);
  const [filterRole, setFilterRole] = useState(ALL);

  const { spaceNames, roleNames, loading: enriching } = useAuditEnrichment(events);

  useEffect(() => {
    if (!isAuditApiConfigured()) return;

    listAuditLogs()
      .then((listed) => {
        setFiles(listed);
        setListError(null);
        const yesterday = getYesterdayDate();
        const hit = listed.find((f) => f.date === yesterday) ?? listed[0];
        if (hit) setSelectedKey(hit.key);
      })
      .catch((e: Error) => setListError(e.message));
  }, []);

  useEffect(() => {
    if (!selectedKey || !isAuditApiConfigured()) return;

    setLoading(true);
    setFetchError(null);
    fetchAuditLog(selectedKey)
      .then((loaded) => {
        setEvents(loaded);
        setLoading(false);
      })
      .catch((e: Error) => {
        setFetchError(e.message);
        setLoading(false);
      });
  }, [selectedKey]);

  const filterOptions = useMemo(() => ({
    users: uniqueSorted(events.map((e) => e.actorName)),
    activities: uniqueSorted(events.map((e) => e.activityName)),
    resources: uniqueSorted(events.flatMap((e) => e.resourceTypes)),
    spaces: uniqueSorted(events.map((e) => e.spaceId)),
    environments: uniqueSorted(events.map((e) => e.environmentId)),
    roles: uniqueSorted(
      events
        .filter((e) => e.roleId && e.spaceId)
        .map((e) => roleMapKey(e.spaceId!, e.roleId!)),
    ),
  }), [events]);

  const filteredEvents = useMemo(() => {
    return events.filter((event) => {
      if (filterUser !== ALL && event.actorName !== filterUser) return false;
      if (filterActivity !== ALL && event.activityName !== filterActivity) return false;
      if (filterResource !== ALL && !event.resourceTypes.includes(filterResource)) return false;
      if (filterSpace !== ALL && event.spaceId !== filterSpace) return false;
      if (filterEnvironment !== ALL && event.environmentId !== filterEnvironment) return false;
      if (filterRole !== ALL) {
        if (!event.spaceId || !event.roleId) return false;
        if (roleMapKey(event.spaceId, event.roleId) !== filterRole) return false;
      }
      return true;
    });
  }, [events, filterUser, filterActivity, filterResource, filterSpace, filterEnvironment, filterRole]);

  const stats = useMemo(() => ({
    total: filteredEvents.length,
    creates: filteredEvents.filter((e) => e.activityName === 'Create').length,
    updates: filteredEvents.filter((e) => e.activityName === 'Update').length,
    deletes: filteredEvents.filter((e) => e.activityName === 'Delete').length,
    failures: filteredEvents.filter((e) => e.status >= 400).length,
    roleEvents: filteredEvents.filter((e) => e.resourceTypes.includes('Role')).length,
  }), [filteredEvents]);

  const topUsers = useMemo(() => countBy(filteredEvents, (e) => e.actorName), [filteredEvents]);
  const topSpaces = useMemo(
    () => countBy(filteredEvents, (e) => (e.spaceId ? displaySpaceName(e.spaceId, spaceNames) : undefined)),
    [filteredEvents, spaceNames],
  );
  const topResources = useMemo(() => countBy(filteredEvents, (e) => e.resourceTypes[0]), [filteredEvents]);
  const topPaths = useMemo(() => countBy(filteredEvents, (e) => e.path), [filteredEvents]);

  const selectedLabel = files.find((f) => f.key === selectedKey)?.label ?? selectedKey;

  if (!isAuditApiConfigured()) {
    return (
      <Note variant="warning">
        Set <code>VITE_AUDIT_API_URL</code> in your <code>.env</code> to connect to the audit log API.
        See <code>aws/README.md</code> for deployment steps.
      </Note>
    );
  }

  return (
    <Box>
      <Flex justifyContent="space-between" alignItems="center" marginBottom="spacingL" style={{ flexWrap: 'wrap', gap: 12 }}>
        <Box>
          <Heading marginBottom="none">Audit Log</Heading>
          <Paragraph fontColor="gray500" marginBottom="none">
            CMA activity from your org&apos;s daily S3 export — who changed what, when.
          </Paragraph>
        </Box>
        <Flex gap="spacingS" alignItems="center" style={{ flexWrap: 'wrap' }}>
          {files.length > 0 && (
            <Select
              id="audit-file-select"
              value={selectedKey}
              onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setSelectedKey(e.target.value)}
              size="small"
              style={{ minWidth: 220 }}
            >
              {files.map((f) => (
                <Select.Option key={f.key} value={f.key}>
                  {f.label}
                </Select.Option>
              ))}
            </Select>
          )}
          <Badge variant="primary">S3 EXPORT</Badge>
          {(loading || enriching) && <Spinner size="small" />}
        </Flex>
      </Flex>

      {listError && (
        <Note variant="negative" style={{ marginBottom: tokens.spacingL }}>
          Could not list audit log files: {listError}
        </Note>
      )}

      {fetchError && (
        <Note variant="negative" style={{ marginBottom: tokens.spacingL }}>
          Could not load audit log: {fetchError}
        </Note>
      )}

      {!listError && files.length === 0 && !loading && (
        <Note variant="neutral" style={{ marginBottom: tokens.spacingL }}>
          No audit log files found in the bucket. Confirm Contentful Audit Logs export is enabled and files
          are uploaded to S3.
        </Note>
      )}

      {events.length > 0 && (
        <>
          <Flex gap="spacingS" marginBottom="spacingL" style={{ flexWrap: 'wrap' }}>
            <FilterSelect id="filter-user" label="User" value={filterUser} onChange={setFilterUser} options={filterOptions.users} />
            <FilterSelect id="filter-activity" label="Activity" value={filterActivity} onChange={setFilterActivity} options={filterOptions.activities} />
            <FilterSelect id="filter-resource" label="Resource" value={filterResource} onChange={setFilterResource} options={filterOptions.resources} />
            <SpaceFilterSelect
              spaceIds={filterOptions.spaces}
              spaceNames={spaceNames}
              value={filterSpace}
              onChange={setFilterSpace}
            />
            <FilterSelect id="filter-env" label="Environment" value={filterEnvironment} onChange={setFilterEnvironment} options={filterOptions.environments} />
            {filterOptions.roles.length > 0 && (
              <RoleFilterSelect
                roleKeys={filterOptions.roles}
                roleNames={roleNames}
                value={filterRole}
                onChange={setFilterRole}
              />
            )}
          </Flex>

          <Note variant="neutral" style={{ marginBottom: tokens.spacingL }}>
            Space and role names are resolved via the Contentful Management API for IDs found in the export.
            Permission details (grants, diffs) are not included in audit files — role events show who changed which role ({stats.roleEvents} in this file).
          </Note>

          <Flex gap="spacingM" marginBottom="spacingL" style={{ flexWrap: 'wrap' }}>
            <MetricCard label="Total Events" value={stats.total.toLocaleString()} color={tokens.colorPrimary} sub={selectedLabel} />
            <MetricCard label="Creates" value={stats.creates} color={tokens.colorPositive} />
            <MetricCard label="Updates" value={stats.updates} color={tokens.colorPrimary} />
            <MetricCard label="Deletes" value={stats.deletes} color={stats.deletes > 0 ? tokens.colorNegative : tokens.colorPositive} />
            <MetricCard label="Failed (4xx/5xx)" value={stats.failures} color={stats.failures > 0 ? tokens.colorWarning : tokens.colorPositive} />
          </Flex>

          <Flex gap="spacingXl" marginBottom="spacingL" style={{ flexWrap: 'wrap' }}>
            <TopList title="Top Users" items={topUsers} />
            <TopList title="Top Spaces" items={topSpaces} />
            <TopList title="Top Resource Types" items={topResources} />
            <TopList title="Top API Paths" items={topPaths} mono />
          </Flex>

          <SectionHeading marginBottom="spacingS">
            Audit Events — {selectedLabel} ({filteredEvents.length} shown)
          </SectionHeading>
          <AuditLogStream events={filteredEvents} spaceNames={spaceNames} roleNames={roleNames} />
        </>
      )}
    </Box>
  );
}

function FilterSelect({
  id,
  label,
  value,
  onChange,
  options,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: string[];
}) {
  return (
    <Select id={id} value={value} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)} size="small" style={{ minWidth: 140 }}>
      <Select.Option value={ALL}>All {label}s</Select.Option>
      {options.map((opt) => (
        <Select.Option key={opt} value={opt}>
          {opt}
        </Select.Option>
      ))}
    </Select>
  );
}

function SpaceFilterSelect({
  spaceIds,
  spaceNames,
  value,
  onChange,
}: {
  spaceIds: string[];
  spaceNames: Record<string, string>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select id="filter-space" value={value} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)} size="small" style={{ minWidth: 180 }}>
      <Select.Option value={ALL}>All Spaces</Select.Option>
      {spaceIds.map((id) => (
        <Select.Option key={id} value={id}>
          {displaySpaceName(id, spaceNames)}
        </Select.Option>
      ))}
    </Select>
  );
}

function RoleFilterSelect({
  roleKeys,
  roleNames,
  value,
  onChange,
}: {
  roleKeys: string[];
  roleNames: Record<string, string>;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Select id="filter-role" value={value} onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)} size="small" style={{ minWidth: 180 }}>
      <Select.Option value={ALL}>All Roles</Select.Option>
      {roleKeys.map((key) => (
        <Select.Option key={key} value={key}>
          {roleNames[key] ?? key.split(':')[1] ?? key}
        </Select.Option>
      ))}
    </Select>
  );
}

function TopList({ title, items, mono }: { title: string; items: [string, number][]; mono?: boolean }) {
  return (
    <Box style={{ flex: 1, minWidth: 180 }}>
      <SectionHeading marginBottom="spacingS">{title}</SectionHeading>
      {items.length === 0 && <Text fontColor="gray500" fontSize="fontSizeS">—</Text>}
      {items.map(([name, count]) => (
        <Flex key={name} justifyContent="space-between" marginBottom="spacingXs">
          <Text
            fontSize="fontSizeS"
            style={{
              flex: 1,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: tokens.gray700,
              fontFamily: mono ? 'monospace' : undefined,
            }}
          >
            {name}
          </Text>
          <Badge variant="secondary">{count}</Badge>
        </Flex>
      ))}
    </Box>
  );
}
