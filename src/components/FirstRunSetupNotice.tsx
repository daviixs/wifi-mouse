import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Wifi } from 'lucide-react-native';

import { COLORS } from '../constants/config';

const NOTICE_STORAGE_KEY = '@remote-mouse/mac-accessibility-notice-v1';

export function FirstRunSetupNotice() {
  const [loaded, setLoaded] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void AsyncStorage.getItem(NOTICE_STORAGE_KEY)
      .then((value) => {
        if (isMounted) setVisible(value !== 'seen');
      })
      .catch(() => {
        if (isMounted) setVisible(true);
      })
      .finally(() => {
        if (isMounted) setLoaded(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const dismiss = useCallback(() => {
    setVisible(false);
    void AsyncStorage.setItem(NOTICE_STORAGE_KEY, 'seen').catch(() => undefined);
  }, []);

  return (
    <Modal
      animationType="fade"
      onRequestClose={dismiss}
      statusBarTranslucent
      transparent
      visible={loaded && visible}
    >
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.safeArea}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.card}>
              <View style={styles.iconBadge}>
                <Wifi color={COLORS.accent} size={21} strokeWidth={2} />
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
                onPress={dismiss}
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
    backgroundColor: 'rgba(5, 7, 6, 0.78)',
    flex: 1,
  },
  safeArea: { flex: 1 },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 20,
  },
  card: {
    alignSelf: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 26,
    borderWidth: 1,
    maxWidth: 480,
    padding: 24,
    width: '100%',
  },
  iconBadge: {
    alignItems: 'center',
    backgroundColor: '#242b20',
    borderColor: '#39452c',
    borderRadius: 16,
    borderWidth: 1,
    height: 52,
    justifyContent: 'center',
    marginBottom: 24,
    width: 52,
  },
  eyebrow: { color: COLORS.accent, fontSize: 10, fontWeight: '800', letterSpacing: 1.8 },
  title: { color: COLORS.text, fontSize: 27, fontWeight: '700', letterSpacing: -0.6, marginTop: 8 },
  description: { color: COLORS.muted, fontSize: 14, lineHeight: 21, marginTop: 10 },
  steps: { gap: 18, marginTop: 25 },
  step: { alignItems: 'flex-start', flexDirection: 'row', gap: 12 },
  stepNumber: {
    color: COLORS.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.7,
    paddingTop: 2,
    width: 22,
  },
  stepCopy: { flex: 1, gap: 3 },
  stepTitle: { color: COLORS.text, fontSize: 13, fontWeight: '700' },
  stepDescription: { color: COLORS.muted, fontSize: 12, lineHeight: 18 },
  button: {
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    borderRadius: 15,
    justifyContent: 'center',
    marginTop: 26,
    minHeight: 54,
    paddingHorizontal: 20,
  },
  buttonPressed: { backgroundColor: COLORS.accentDark, transform: [{ scale: 0.99 }] },
  buttonLabel: { color: '#15190f', fontSize: 14, fontWeight: '800' },
  footnote: { color: '#788079', fontSize: 11, lineHeight: 16, marginTop: 13, textAlign: 'center' },
});
