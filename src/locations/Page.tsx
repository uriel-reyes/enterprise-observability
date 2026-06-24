import React, { useState } from 'react';
import { Box, Heading, Paragraph, Tabs } from '@contentful/f36-components';
import { ObservabilityDashboard } from './ObservabilityDashboard';
import { AuditLogPage } from './AuditLogPage';

export function ObservabilityPage() {
  const [tab, setTab] = useState('observability');

  return (
    <Box padding="spacingXl" style={{ maxWidth: 1200, margin: '0 auto' }}>
      <Box marginBottom="spacingL">
        <Heading marginBottom="none">Enterprise Observability</Heading>
        <Paragraph fontColor="gray500" marginBottom="none">
          CDA traffic simulation and org-wide CMA audit log viewer.
        </Paragraph>
      </Box>

      <Tabs currentTab={tab} onTabChange={setTab}>
        <Tabs.List variant="horizontal-divider">
          <Tabs.Tab panelId="observability">CDA Observability</Tabs.Tab>
          <Tabs.Tab panelId="audit">Audit Log</Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel id="observability">
          <Box paddingTop="spacingL">
            <ObservabilityDashboard />
          </Box>
        </Tabs.Panel>
        <Tabs.Panel id="audit">
          <Box paddingTop="spacingL">
            <AuditLogPage />
          </Box>
        </Tabs.Panel>
      </Tabs>
    </Box>
  );
}
