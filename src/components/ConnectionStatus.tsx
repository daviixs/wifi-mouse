import { Circle, Wifi } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';

import { COLORS } from '../constants/config';
import { useConnectionStore } from '../stores/connection.store';

const STATUS_LABELS = {
  disconnected: 'Desconectado',
  connecting: 'Conectando',
  connected: 'Conectado',
  reconnecting: 'Reconectando',
  error: 'Sem conexão',
} as const;

export function ConnectionStatus() {
  const status = useConnectionStore((state) => state.status);
  const connected = useConnectionStore((state) => state.connected);
  const isActive = connected || status === 'connecting' || status === 'reconnecting';
  const color = status === 'error' ? COLORS.danger : isActive ? COLORS.success : COLORS.muted;

  return (
    <View style={styles.container} accessibilityLiveRegion="polite">
      <View style={[styles.indicator, { backgroundColor: color }]} />
      <Text style={[styles.label, { color }]}>{STATUS_LABELS[status]}</Text>
      {isActive ? (
        <Wifi color={color} size={15} strokeWidth={1.8} />
      ) : (
        <Circle color={color} size={9} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  indicator: { width: 7, height: 7, borderRadius: 4 },
  label: { fontSize: 13, fontWeight: '600' },
});
