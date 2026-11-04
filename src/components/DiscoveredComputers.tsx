import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { ChevronRight, Laptop, Monitor, RefreshCw, Server, Terminal } from 'lucide-react-native';

import { GlassCard } from './ui/GlassCard';
import { COLORS, RADIUS, SPACE } from '../theme/tokens';
import type { ComputerOs, DiscoveredComputer } from '../services/discovery/discoveredComputers';
import type { DiscoveryStatus } from '../hooks/useComputerDiscovery';

const OS_LABEL: Record<ComputerOs, string> = {
  macos: 'macOS',
  windows: 'Windows',
  linux: 'Linux',
  unknown: 'Computador',
};

function OsIcon({ os }: { os: ComputerOs }) {
  const props = { color: COLORS.accent, size: 22, strokeWidth: 1.8 };
  if (os === 'macos') return <Laptop {...props} />;
  if (os === 'windows') return <Monitor {...props} />;
  if (os === 'linux') return <Terminal {...props} />;
  return <Server {...props} />;
}

type Props = {
  computers: DiscoveredComputer[];
  status: DiscoveryStatus;
  disabled?: boolean;
  isAvailable: boolean;
  lastComputerId: string | null;
  lastComputerIp: string | null;
  onRefresh: () => void;
  onSelect: (computer: DiscoveredComputer) => void;
};

export function DiscoveredComputers({
  computers,
  status,
  disabled,
  isAvailable,
  lastComputerId,
  lastComputerIp,
  onRefresh,
  onSelect,
}: Props) {
  const searching = status === 'searching';
  const isEmpty = computers.length === 0;

  return (
    <GlassCard style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>Computadores encontrados</Text>
        <Pressable
          accessibilityLabel="Procurar computadores novamente"
          accessibilityRole="button"
          disabled={disabled}
          hitSlop={8}
          onPress={onRefresh}
          style={({ pressed }) => [styles.refresh, pressed && styles.pressed]}
        >
          {searching ? (
            <ActivityIndicator color={COLORS.accent} size="small" />
          ) : (
            <RefreshCw color={COLORS.accent} size={18} strokeWidth={2} />
          )}
        </Pressable>
      </View>

      {computers.map((computer) => {
        const isLast =
          (lastComputerId !== null && computer.id === lastComputerId) ||
          computer.ip === lastComputerIp;
        return (
          <Pressable
            accessibilityHint="Conecta a este computador"
            accessibilityLabel={`${computer.name}, ${OS_LABEL[computer.os]}, ${computer.ip}`}
            accessibilityRole="button"
            disabled={disabled}
            key={computer.id}
            onPress={() => onSelect(computer)}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <View style={styles.iconWrap}>
              <OsIcon os={computer.os} />
            </View>
            <View style={styles.rowText}>
              <View style={styles.nameLine}>
                <Text numberOfLines={1} style={styles.name}>
                  {computer.name}
                </Text>
                {isLast && <Text style={styles.badge}>ÚLTIMO</Text>}
              </View>
              <Text style={styles.meta}>
                {OS_LABEL[computer.os]} · {computer.ip}
              </Text>
            </View>
            <ChevronRight color={COLORS.muted} size={20} />
          </Pressable>
        );
      })}

      {isEmpty && searching && (
        <View style={styles.stateRow}>
          <ActivityIndicator color={COLORS.accent} size="small" />
          <Text style={styles.stateText}>Procurando computadores na rede...</Text>
        </View>
      )}

      {isEmpty && !searching && (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>Nenhum computador encontrado</Text>
          <Text style={styles.emptyText}>
            {isAvailable
              ? 'Abra o agente Remote Mouse no computador e confira se os dois estão no mesmo Wi-Fi. Depois toque em atualizar.'
              : 'A busca automática não está disponível aqui. Digite o IP mostrado no terminal do agente.'}
          </Text>
        </View>
      )}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { marginTop: SPACE.xl, padding: SPACE.lg, gap: SPACE.sm },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  title: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  refresh: {
    alignItems: 'center',
    borderColor: COLORS.border,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  pressed: { opacity: 0.7 },
  row: {
    alignItems: 'center',
    backgroundColor: 'rgba(6, 12, 50, 0.55)',
    borderColor: COLORS.border,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SPACE.md,
    minHeight: 64,
    paddingHorizontal: SPACE.md,
    paddingVertical: SPACE.sm,
  },
  iconWrap: {
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: RADIUS.small,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  rowText: { flex: 1, gap: 2 },
  nameLine: { alignItems: 'center', flexDirection: 'row', gap: SPACE.xs },
  name: { color: COLORS.text, flexShrink: 1, fontSize: 16, fontWeight: '700' },
  badge: {
    backgroundColor: COLORS.highlight,
    borderRadius: RADIUS.small,
    color: COLORS.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1,
    overflow: 'hidden',
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  meta: { color: COLORS.muted, fontSize: 13 },
  stateRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACE.sm,
    paddingVertical: SPACE.sm,
  },
  stateText: { color: COLORS.muted, fontSize: 14 },
  emptyBox: { gap: SPACE.xxs, paddingVertical: SPACE.xs },
  emptyTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  emptyText: { color: COLORS.muted, fontSize: 13, lineHeight: 18 },
});
