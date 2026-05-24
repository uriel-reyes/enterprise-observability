import React from 'react';
import tokens from '@contentful/f36-tokens';

interface SparkBarProps {
  data: number[];
  label: string;
  color?: string;
  height?: number;
}

export function SparkBar({ data, label, color = tokens.colorPrimary, height = 60 }: SparkBarProps) {
  const max = Math.max(...data, 1);
  const BAR_WIDTH = 8;
  const GAP = 2;
  const width = data.length * (BAR_WIDTH + GAP);

  return (
    <div style={{ textAlign: 'center' }}>
      <svg width={width} height={height} style={{ display: 'block', margin: '0 auto' }}>
        {data.map((v, i) => {
          const barH = Math.max(2, (v / max) * height);
          return (
            <rect
              key={i}
              x={i * (BAR_WIDTH + GAP)}
              y={height - barH}
              width={BAR_WIDTH}
              height={barH}
              rx={2}
              fill={color}
              opacity={0.7 + 0.3 * (i / data.length)}
            />
          );
        })}
      </svg>
      <div style={{ fontSize: 11, color: tokens.gray500, marginTop: 4 }}>{label}</div>
    </div>
  );
}
