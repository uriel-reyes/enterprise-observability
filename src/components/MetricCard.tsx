import React from 'react';
import { Box, Flex, Text } from '@contentful/f36-components';
import tokens from '@contentful/f36-tokens';

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}

export function MetricCard({ label, value, sub, color = tokens.colorPositive }: MetricCardProps) {
  return (
    <Box
      padding="spacingM"
      style={{
        background: tokens.colorWhite,
        border: `1px solid ${tokens.gray200}`,
        borderRadius: tokens.borderRadiusMedium,
        minWidth: 140,
        flex: 1,
      }}
    >
      <Text
        fontColor="gray500"
        fontSize="fontSizeS"
        fontWeight="fontWeightMedium"
        style={{ display: 'block', marginBottom: tokens.spacingXs }}
      >
        {label}
      </Text>
      <Text
        fontSize="fontSize2Xl"
        fontWeight="fontWeightDemiBold"
        style={{ color, display: 'block', lineHeight: 1 }}
      >
        {value}
      </Text>
      {sub && (
        <Text fontColor="gray400" fontSize="fontSizeS" style={{ display: 'block', marginTop: tokens.spacingXs }}>
          {sub}
        </Text>
      )}
    </Box>
  );
}
