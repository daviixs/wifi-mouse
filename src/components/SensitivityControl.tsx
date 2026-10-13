import { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import { Gauge } from 'lucide-react-native';

import { COLORS } from '../constants/config';
import {
  SENSITIVITY_MAX,
  SENSITIVITY_MIN,
  SENSITIVITY_STEP,
  normalizeSensitivity,
} from '../services/mouse/sensitivity';

type SensitivityControlProps = {
  sensitivity: number;
  onChange: (sensitivity: number) => void;
};

function formatSensitivity(value: number): string {
  return `${normalizeSensitivity(value).toFixed(1).replace('.', ',')}×`;
}

export function SensitivityControl({ sensitivity, onChange }: SensitivityControlProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Pressable
        accessibilityLabel={`Sensibilidade do cursor ${formatSensitivity(sensitivity)}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: isOpen }}
        onPress={() => setIsOpen(true)}
        style={styles.button}
      >
        <Gauge color={COLORS.text} size={19} />
        <Text style={styles.buttonLabel}>{formatSensitivity(sensitivity)}</Text>
      </Pressable>
      <Modal
        animationType="fade"
        onRequestClose={() => setIsOpen(false)}
        statusBarTranslucent
        transparent
        visible={isOpen}
      >
        <View style={styles.modalRoot}>
          <Pressable
            accessibilityLabel="Fechar ajuste de sensibilidade"
            onPress={() => setIsOpen(false)}
            style={StyleSheet.absoluteFill}
          />
          <View accessibilityViewIsModal style={styles.panel}>
            <View style={styles.titleRow}>
              <View style={styles.headingBlock}>
                <Text style={styles.eyebrow}>CONTROLE DO CURSOR</Text>
                <Text style={styles.heading}>Sensibilidade</Text>
              </View>
              <Text style={styles.value}>{formatSensitivity(sensitivity)}</Text>
            </View>
            <Slider
              accessibilityLabel="Sensibilidade do cursor"
              maximumTrackTintColor={COLORS.border}
              maximumValue={SENSITIVITY_MAX}
              minimumTrackTintColor={COLORS.accent}
              minimumValue={SENSITIVITY_MIN}
              onValueChange={onChange}
              step={SENSITIVITY_STEP}
              thumbTintColor={COLORS.accent}
              value={sensitivity}
            />
            <View style={styles.rangeLabels}>
              <Text style={styles.rangeLabel}>MAIS LENTO</Text>
              <Text style={styles.rangeLabel}>MAIS RÁPIDO</Text>
            </View>
            <Pressable onPress={() => setIsOpen(false)} style={styles.doneButton}>
              <Text style={styles.doneLabel}>CONCLUÍDO</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    backgroundColor: COLORS.surfaceRaised,
    borderColor: COLORS.border,
    borderRadius: 18,
    borderWidth: 1,
    bottom: 14,
    flexDirection: 'row',
    gap: 8,
    height: 48,
    justifyContent: 'center',
    left: 14,
    minWidth: 98,
    paddingHorizontal: 13,
    position: 'absolute',
    zIndex: 3,
  },
  buttonLabel: { color: COLORS.text, fontSize: 12, fontWeight: '800' },
  modalRoot: {
    alignItems: 'center',
    backgroundColor: '#0009',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  panel: {
    backgroundColor: COLORS.surfaceRaised,
    borderColor: COLORS.border,
    borderRadius: 22,
    borderWidth: 1,
    gap: 22,
    maxWidth: 420,
    padding: 22,
    width: '100%',
  },
  titleRow: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  headingBlock: { gap: 6 },
  eyebrow: { color: COLORS.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.6 },
  heading: { color: COLORS.text, fontSize: 20, fontWeight: '700' },
  value: { color: COLORS.accent, fontSize: 20, fontWeight: '800' },
  rangeLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: -18 },
  rangeLabel: { color: COLORS.muted, fontSize: 8, fontWeight: '800', letterSpacing: 1 },
  doneButton: {
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    borderRadius: 13,
    height: 46,
    justifyContent: 'center',
  },
  doneLabel: { color: COLORS.background, fontSize: 10, fontWeight: '900', letterSpacing: 1.2 },
});
