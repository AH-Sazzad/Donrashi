/**
 * Shows actual meals vs minimum billable meals.
 * If actual < minimum, shows a warning: "X meals short, billed for minimum."
 * Rule: billable = max(actual, minimum). Server calculates; we just display.
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useColorScheme } from '@/hooks/use-color-scheme';

interface Props {
  actual: number;
  minimum: number;
  billable: number;
}

export function MinMealProgressBar({ actual, minimum, billable }: Props) {
  const isDark    = useColorScheme() === 'dark';
  const trackBg   = isDark ? '#2A2A3E' : '#F1F5F9';
  const textSec   = isDark ? '#94A3B8' : '#64748B';
  const textPrim  = isDark ? '#F1F5F9' : '#1E293B';

  const shortfall = minimum - actual;
  const isMet     = actual >= minimum;

  // Fill as fraction of minimum — capped at 100%
  const pct = Math.min(1, actual / Math.max(minimum, 1));
  const fillColor = isMet ? '#43C59E' : '#F59E0B';

  return (
    <View style={styles.wrap}>
      {/* Labels row */}
      <View style={styles.row}>
        <Text style={[styles.label, { color: textSec }]}>
          Actual <Text style={[styles.bold, { color: textPrim }]}>{actual.toFixed(1)}</Text>
        </Text>
        <Text style={[styles.label, { color: textSec }]}>
          Min <Text style={[styles.bold, { color: textPrim }]}>{minimum}</Text>
          {'  ·  '}
          Billed <Text style={[styles.bold, { color: textPrim }]}>{billable.toFixed(1)}</Text>
        </Text>
      </View>

      {/* Track */}
      <View style={[styles.track, { backgroundColor: trackBg }]}>
        <View style={[styles.fill, { width: `${pct * 100}%`, backgroundColor: fillColor }]} />
        {/* Minimum marker line */}
        <View style={[styles.marker, { left: '100%' }]} />
      </View>

      {/* Warning */}
      {!isMet && (
        <Text style={styles.warning}>
          ⚠️ {shortfall.toFixed(1)} meal{shortfall !== 1 ? 's' : ''} short — you'll be billed for minimum {minimum}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap:    { gap: 6 },
  row:     { flexDirection: 'row', justifyContent: 'space-between' },
  label:   { fontSize: 12 },
  bold:    { fontWeight: '700' },
  track:   { height: 8, borderRadius: 4, overflow: 'hidden' },
  fill:    { height: '100%', borderRadius: 4 },
  marker:  { position: 'absolute', top: -2, bottom: -2, width: 2, backgroundColor: '#FF6584' },
  warning: { fontSize: 12, color: '#F59E0B', fontWeight: '600' },
});
