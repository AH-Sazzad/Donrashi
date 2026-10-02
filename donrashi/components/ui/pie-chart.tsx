import React from 'react';
import { View, ViewStyle } from 'react-native';
import Svg, { Circle, G, Text as SvgText } from 'react-native-svg';

export interface PieSlice {
  value: number;
  color: string;
  label: string;
}

interface PieChartProps {
  data: PieSlice[];
  size?: number;
  strokeWidth?: number;
  style?: ViewStyle;
}

export function PieChart({ data, size = 180, strokeWidth = 28, style }: PieChartProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const total = data.reduce((sum, d) => sum + d.value, 0);

  if (total === 0) {
    return (
      <View style={[{ width: size, height: size }, style]}>
        <Svg width={size} height={size}>
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke="#E5E7EB"
            strokeWidth={strokeWidth}
            fill="none"
          />
          <SvgText
            x={center}
            y={center - 8}
            textAnchor="middle"
            fill="#9CA3AF"
            fontSize={12}>
            No data
          </SvgText>
        </Svg>
      </View>
    );
  }

  let cumulativePercent = 0;

  return (
    <View style={[{ width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <G rotation="-90" origin={`${center}, ${center}`}>
          {data.map((slice, i) => {
            const percent = slice.value / total;
            const dashArray = circumference * percent;
            const dashOffset = circumference * (1 - cumulativePercent);
            cumulativePercent += percent;

            return (
              <Circle
                key={i}
                cx={center}
                cy={center}
                r={radius}
                stroke={slice.color}
                strokeWidth={strokeWidth}
                fill="none"
                strokeDasharray={`${dashArray} ${circumference - dashArray}`}
                strokeDashoffset={-(circumference - dashOffset)}
                strokeLinecap="butt"
              />
            );
          })}
        </G>
      </Svg>
    </View>
  );
}
