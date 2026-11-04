import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Wifi } from 'lucide-react-native';

import { COLORS, RADIUS, SHADOWS, SPACE } from '../theme/tokens';

type FirstRunSetupNoticeProps = {
  visible: boolean;
  onDismiss: () => void;
};

export function FirstRunSetupNotice({ visible, onDismiss }: FirstRunSetupNoticeProps) {
  return (
    <Modal
      animationType="fade"
      onRequestClose={onDismiss}
      statusBarTranslucent
      transparent
      visible={visible}
    >
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.card}>
              <View style={styles.iconBadge}>
                <Wifi color={COLORS.primary} size={21} strokeWidth={2} />
              </View>
              <Text style={styles.eyebrow}>ANTES DE CONECTAR</Text>
              <Text style={styles.title}>Uma etapa no Mac</Text>
              <Text style={styles.description}>
                Se você for conectar a um Mac, o agente precisa de autorização para controlar o
                mouse. Essa permissão é concedida no computador, não no celular.
              </Text>

              <View style={styles.steps}>
                <Step number="01" title="Inicie o agente no Mac">
                  Quando ele abrir pela primeira vez, o macOS solicitará acesso.
                </Step>
                <Step number="02" title="Permita Acessibilidade">
                  Se necessário, abra Ajustes do Sistema → Privacidade e Segurança → Acessibilidade
                  e autorize o Remote Mouse Agent.
                </Step>
                <Step number="03" title="Volte para o app">
                  Com o agente ativo, toque em Conectar para usar o touchpad.
                </Step>
              </View>

              <Pressable
                accessibilityRole="button"
                onPress={onDismiss}
                style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
              >
                <Text style={styles.buttonLabel}>Entendi, continuar</Text>
              </Pressable>
              <Text style={styles.footnote}>No Windows, essa autorização não é necessária.</Text>
            </View>
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

type StepProps = {
  number: string;
  title: string;
  children: string;
};

function Step({ number, title, children }: StepProps) {
  return (
    <View style={styles.step}>
      <Text style={styles.stepNumber}>{number}</Text>
      <View style={styles.stepCopy}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepDescription}>{children}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(2, 5, 25, 0.72)',
    flex: 1,
  },
  safeArea: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: SPACE.lg,
    paddingVertical: SPACE.lg,
  },
  card: {
    alignSelf: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: RADIUS.large,
    borderWidth: 1,
    maxWidth: 480,
    padding: SPACE.xl,
    width: '100%',
    ...SHADOWS.card,
  },
  iconBadge: {
    alignItems: 'center',
    backgroundColor: COLORS.highlight,
    borderColor: COLORS.border,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    marginBottom: SPACE.xl,
    width: 52,
  },
  eyebrow: { color: COLORS.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.8 },
  title: { color: COLORS.text, fontSize: 27, fontWeight: '700', letterSpacing: -0.6, marginTop: 8 },
  description: { color: COLORS.muted, fontSize: 14, lineHeight: 21, marginTop: SPACE.xs },
  steps: { gap: SPACE.md, marginTop: SPACE.xl },
  step: { alignItems: 'flex-start', flexDirection: 'row', gap: SPACE.sm },
  stepNumber: {
    color: COLORS.primary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
    paddingTop: 2,
    width: 22,
  },
  stepCopy: { flex: 1, gap: SPACE.xxs },
  stepTitle: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  stepDescription: { color: COLORS.muted, fontSize: 12, lineHeight: 18 },
  button: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.medium,
    justifyContent: 'center',
    marginTop: SPACE.xl,
    minHeight: 54,
    paddingHorizontal: SPACE.lg,
  },
  buttonPressed: { backgroundColor: COLORS.primary, transform: [{ scale: 0.99 }] },
  buttonLabel: { color: COLORS.onPrimary, fontSize: 14, fontWeight: '800' },
  footnote: {
    color: COLORS.muted,
    fontSize: 11,
    lineHeight: 16,
    marginTop: SPACE.sm,
    textAlign: 'center',
  },
});
