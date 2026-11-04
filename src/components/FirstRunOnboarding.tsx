import { useCallback, useEffect, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ArrowRight,
  Keyboard,
  MousePointer2,
  MousePointerClick,
  SlidersHorizontal,
  Wifi,
} from 'lucide-react-native';

import { COLORS, RADIUS, SHADOWS, SPACE } from '../theme/tokens';

const ONBOARDING_STORAGE_KEY = '@remote-mouse/onboarding-v1';

const PAGES = [
  {
    title: 'Seu computador, na ponta dos dedos.',
    description: 'Use o celular como touchpad, teclado e controle remoto para o computador.',
    Icon: Wifi,
  },
  {
    title: 'Mova e role com naturalidade.',
    description: 'Arraste um dedo para mover o cursor. Use dois dedos para rolar a tela.',
    Icon: MousePointer2,
  },
  {
    title: 'Cliques sem esforço.',
    description: 'Toque para clicar à esquerda e mantenha pressionado para o clique direito.',
    Icon: MousePointerClick,
  },
  {
    title: 'Digite e ajuste do seu jeito.',
    description: 'Use o teclado para enviar texto e ajuste a sensibilidade do cursor.',
    Icon: Keyboard,
    SecondaryIcon: SlidersHorizontal,
  },
  {
    title: 'Prepare a conexão.',
    description:
      'Deixe o celular e o computador na mesma rede Wi-Fi e abra o Remote Mouse Agent no computador.',
    Icon: Wifi,
  },
] as const;

export function FirstRunOnboarding() {
  const [loaded, setLoaded] = useState(false);
  const [visible, setVisible] = useState(false);
  const [page, setPage] = useState(0);
  const [showSummary, setShowSummary] = useState(false);

  useEffect(() => {
    let isMounted = true;

    void AsyncStorage.getItem(ONBOARDING_STORAGE_KEY)
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

  const complete = useCallback(() => {
    setVisible(false);
    void AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, 'seen').catch(() => undefined);
  }, []);

  const handleContinue = () => {
    if (showSummary) {
      complete();
      return;
    }

    if (page === PAGES.length - 1) {
      setShowSummary(true);
      return;
    }

    setPage((currentPage) => currentPage + 1);
  };

  const handleRequestClose = () => {
    if (showSummary) {
      complete();
      return;
    }

    setPage((currentPage) => Math.max(0, currentPage - 1));
  };

  const currentPage = PAGES[page];
  const PageIcon = currentPage.Icon;
  const SummaryIcon = 'SecondaryIcon' in currentPage ? currentPage.SecondaryIcon : undefined;

  return (
    <Modal
      animationType="fade"
      onRequestClose={handleRequestClose}
      statusBarTranslucent
      transparent
      visible={loaded && visible}
    >
      <View style={styles.backdrop}>
        <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
          <View accessibilityViewIsModal style={styles.sheet}>
            <View style={styles.grabber} />

            {showSummary ? (
              <>
                <View style={styles.summaryHeader}>
                  <View style={styles.summaryIcon}>
                    <Wifi color={COLORS.primary} size={24} strokeWidth={2} />
                  </View>
                  <Text style={styles.summaryTitle}>Seu computador, na ponta dos dedos</Text>
                  <Text style={styles.summaryDescription}>
                    Para conectar, deixe os dois dispositivos na mesma rede Wi-Fi, mantenha o Remote
                    Mouse Agent aberto no computador e informe o IP dele na tela abaixo.
                  </Text>
                </View>

                <View style={styles.summarySteps}>
                  <SummaryStep number="01" text="Celular e computador na mesma rede Wi-Fi" />
                  <SummaryStep number="02" text="Remote Mouse Agent aberto no computador" />
                  <SummaryStep number="03" text="Endereço IP informado na tela de conexão" />
                </View>

                <Pressable
                  accessibilityRole="button"
                  onPress={complete}
                  style={({ pressed }) => [
                    styles.primaryButton,
                    styles.summaryButton,
                    pressed && styles.buttonPressed,
                  ]}
                >
                  <Text style={styles.primaryButtonLabel}>Entendi</Text>
                  <ArrowRight color={COLORS.onPrimary} size={18} strokeWidth={2.5} />
                </Pressable>
              </>
            ) : (
              <>
                <View style={styles.hero}>
                  <View style={styles.heroOrb}>
                    <PageIcon color={COLORS.primary} size={40} strokeWidth={1.7} />
                    {SummaryIcon && (
                      <View style={styles.secondaryIcon}>
                        <SummaryIcon color={COLORS.secondary} size={20} strokeWidth={1.8} />
                      </View>
                    )}
                  </View>
                </View>

                <View style={styles.pageCopy}>
                  <Text style={styles.pageCount}>PASSO {String(page + 1).padStart(2, '0')}</Text>
                  <Text style={styles.pageTitle}>{currentPage.title}</Text>
                  <Text style={styles.pageDescription}>{currentPage.description}</Text>
                </View>

                <View style={styles.footer}>
                  <View
                    accessibilityLabel={`Página ${page + 1} de ${PAGES.length}`}
                    accessibilityRole="progressbar"
                    style={styles.pagination}
                  >
                    {PAGES.map((item, index) => (
                      <View
                        key={item.title}
                        style={[styles.dot, index === page && styles.activeDot]}
                      />
                    ))}
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={
                      page === PAGES.length - 1 ? 'Ver resumo de conexão' : 'Continuar onboarding'
                    }
                    onPress={handleContinue}
                    style={({ pressed }) => [styles.primaryButton, pressed && styles.buttonPressed]}
                  >
                    <Text style={styles.primaryButtonLabel}>Continuar</Text>
                    <ArrowRight color={COLORS.onPrimary} size={18} strokeWidth={2.5} />
                  </Pressable>
                </View>
              </>
            )}
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

function SummaryStep({ number, text }: { number: string; text: string }) {
  return (
    <View style={styles.summaryStep}>
      <Text style={styles.summaryStepNumber}>{number}</Text>
      <Text style={styles.summaryStepText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    backgroundColor: 'rgba(2, 5, 25, 0.72)',
    flex: 1,
    justifyContent: 'flex-end',
  },
  safeArea: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: COLORS.background,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
    minHeight: '60%',
    overflow: 'hidden',
    paddingBottom: SPACE.lg,
    paddingHorizontal: SPACE.xl,
    paddingTop: SPACE.sm,
    ...SHADOWS.card,
  },
  grabber: {
    alignSelf: 'center',
    backgroundColor: COLORS.border,
    borderRadius: RADIUS.pill,
    height: 5,
    marginBottom: SPACE.lg,
    width: 38,
  },
  hero: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    minHeight: 170,
  },
  heroOrb: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    height: 116,
    justifyContent: 'center',
    width: 116,
    ...SHADOWS.floating,
  },
  secondaryIcon: {
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSubtle,
    borderColor: COLORS.onPrimary,
    borderRadius: RADIUS.pill,
    borderWidth: 3,
    bottom: 0,
    height: 42,
    justifyContent: 'center',
    position: 'absolute',
    right: -5,
    width: 42,
  },
  pageCopy: { gap: SPACE.sm, paddingBottom: SPACE.md },
  pageCount: { color: COLORS.primary, fontSize: 10, fontWeight: '800', letterSpacing: 1.5 },
  pageTitle: { color: COLORS.text, fontSize: 27, fontWeight: '700', letterSpacing: -0.6 },
  pageDescription: { color: COLORS.muted, fontSize: 15, lineHeight: 22 },
  footer: { gap: SPACE.lg, paddingTop: SPACE.sm },
  pagination: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: SPACE.xs,
    justifyContent: 'center',
  },
  dot: { backgroundColor: COLORS.border, borderRadius: RADIUS.pill, height: 7, width: 7 },
  activeDot: { backgroundColor: COLORS.primary, width: 20 },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    gap: SPACE.xs,
    height: 56,
    justifyContent: 'center',
    ...SHADOWS.floating,
  },
  buttonPressed: { transform: [{ scale: 0.99 }] },
  primaryButtonLabel: { color: COLORS.onPrimary, fontSize: 15, fontWeight: '700' },
  summaryHeader: { alignItems: 'center', gap: SPACE.sm },
  summaryIcon: {
    alignItems: 'center',
    backgroundColor: COLORS.surfaceSubtle,
    borderRadius: RADIUS.pill,
    height: 56,
    justifyContent: 'center',
    width: 56,
  },
  summaryTitle: { color: COLORS.text, fontSize: 22, fontWeight: '700', textAlign: 'center' },
  summaryDescription: { color: COLORS.muted, fontSize: 14, lineHeight: 21, textAlign: 'center' },
  summarySteps: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: RADIUS.large,
    borderWidth: StyleSheet.hairlineWidth,
    gap: SPACE.md,
    marginTop: SPACE.xl,
    padding: SPACE.lg,
    ...SHADOWS.floating,
  },
  summaryButton: { marginTop: SPACE.lg },
  summaryStep: { alignItems: 'center', flexDirection: 'row', gap: SPACE.sm },
  summaryStepNumber: { color: COLORS.primary, fontSize: 11, fontWeight: '800', width: 24 },
  summaryStepText: { color: COLORS.text, flex: 1, fontSize: 14, lineHeight: 20, fontWeight: '600' },
});
