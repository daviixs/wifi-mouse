import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Pressable,
  useWindowDimensions,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Laptop, Wifi } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { AppHeader } from '../components/ui/AppHeader';
import { GlassCard } from '../components/ui/GlassCard';
import { GradientButton } from '../components/ui/GradientButton';
import { ScreenBackground } from '../components/ui/ScreenBackground';
import { LaptopIllustration } from '../components/illustrations/LaptopIllustration';
import { FirstRunSetupNotice } from '../components/FirstRunSetupNotice';
import { FirstRunOnboarding } from '../components/FirstRunOnboarding';
import { COLORS, RADIUS, SPACE } from '../theme/tokens';
import { focusedAddressScrollOffset } from '../services/websocket/addressInput';
import { APP_CONFIG } from '../constants/config';
import { parseServerAddress } from '../services/websocket/serverUrl';
import { useConnectionStore } from '../stores/connection.store';
import { DiscoveredComputers } from '../components/DiscoveredComputers';
import { useComputerDiscovery } from '../hooks/useComputerDiscovery';
import {
  withLastComputerFirst,
  type DiscoveredComputer,
} from '../services/discovery/discoveredComputers';
import {
  loadLastComputer,
  saveLastComputer,
  type LastComputer,
} from '../services/discovery/lastComputer';

export default function HomeScreen() {
  const [address, setAddress] = useState('');
  const scrollRef = useRef<ScrollView>(null);
  const addressFocused = useRef(false);
  const mainTop = useRef(0),
    cardTop = useRef(0),
    inputTop = useRef(0);
  const revealAddress = () =>
    scrollRef.current?.scrollTo({
      y: focusedAddressScrollOffset(mainTop.current, cardTop.current, inputTop.current, SPACE.md),
      animated: true,
    });

  useEffect(() => {
    const listener = Keyboard.addListener('keyboardDidShow', () => {
      if (addressFocused.current) revealAddress();
    });
    return () => listener.remove();
  }, []);
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [isMacHelpVisible, setIsMacHelpVisible] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [pendingAddress, setPendingAddress] = useState<string | null>(null);
  const connectToServer = useConnectionStore((state) => state.connectToServer);
  const cancelConnection = useConnectionStore((state) => state.cancelConnection);
  const isConnecting = pendingAddress !== null;
  const { width } = useWindowDimensions();
  const heroWidth = Math.min(width * 0.78, 340);
  const [lastComputer, setLastComputer] = useState<LastComputer | null>(null);
  const discovery = useComputerDiscovery();
  const computers = withLastComputerFirst(discovery.computers, lastComputer);

  useEffect(() => {
    let active = true;
    void loadLastComputer(AsyncStorage).then((stored) => {
      if (!active || !stored) return;
      setLastComputer(stored);
      setAddress((current) => current || `${stored.ip}:${stored.port ?? APP_CONFIG.agentPort}`);
    });
    return () => {
      active = false;
    };
  }, []);

  const connect = async (target?: DiscoveredComputer) => {
    if (isConnecting) return;
    const endpoint = parseServerAddress(target ? `${target.ip}:${target.port}` : address);
    if (!endpoint) {
      setValidationMessage('Digite IP ou nome e porta opcional, como 192.168.1.10:8765.');
      return;
    }

    const normalizedAddress = endpoint.address;
    Keyboard.dismiss();
    setValidationMessage(null);
    setConnectionError(null);
    setPendingAddress(normalizedAddress);
    let outcome;
    try {
      outcome = await connectToServer(
        normalizedAddress,
        target ? { os: target.os, name: target.name } : undefined,
      );
    } catch {
      outcome = { kind: 'failed' as const, error: 'Não foi possível conectar ao computador.' };
    }
    setPendingAddress(null);
    if (outcome.kind === 'connected') {
      const remembered: LastComputer = {
        ip: endpoint.host,
        port: endpoint.port,
        name: target?.name ?? (lastComputer?.ip === endpoint.host ? lastComputer.name : null),
        id: target?.id ?? (lastComputer?.ip === endpoint.host ? lastComputer.id : null),
      };
      setLastComputer(remembered);
      setAddress(normalizedAddress);
      void saveLastComputer(AsyncStorage, remembered);
      router.push('/conectado');
    } else if (outcome.kind === 'failed') {
      setConnectionError(outcome.error);
    }
  };

  const cancel = () => {
    cancelConnection();
  };

  return (
    <ScreenBackground>
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView behavior="padding" style={styles.flex}>
          <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
            <ScrollView
              ref={scrollRef}
              onLayout={() => {
                if (addressFocused.current && Keyboard.isVisible()) revealAddress();
              }}
              keyboardDismissMode="on-drag"
              contentContainerStyle={styles.screen}
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
            >
              <AppHeader onHelp={() => setIsMacHelpVisible(true)} />

              <View
                style={styles.main}
                onLayout={(event) => {
                  mainTop.current = event.nativeEvent.layout.y;
                }}
              >
                <View style={styles.hero}>
                  <LaptopIllustration width={heroWidth} />
                </View>
                <Text style={styles.title}>
                  Seu computador,{`\n`}na ponta dos <Text style={styles.titleAccent}>dedos.</Text>
                </Text>
                <Text style={styles.subtitle}>
                  Conecte o celular e o computador à mesma rede Wi-Fi para começar.
                </Text>

                <DiscoveredComputers
                  computers={computers}
                  disabled={isConnecting}
                  isAvailable={discovery.isAvailable}
                  lastComputerId={lastComputer?.id ?? null}
                  lastComputerIp={lastComputer?.ip ?? null}
                  onRefresh={discovery.refresh}
                  onSelect={(computer) => void connect(computer)}
                  status={discovery.status}
                />

                <GlassCard
                  style={styles.connectionCard}
                  onLayout={(event) => {
                    cardTop.current = event.nativeEvent.layout.y;
                  }}
                >
                  <View style={styles.cardHeading}>
                    <Text style={styles.cardTitle}>Ou digite o IP manualmente</Text>
                    <Text style={styles.cardSubtitle}>
                      {lastComputer?.name
                        ? `Último conectado: ${lastComputer.name}`
                        : 'Informe o endereço IP do agente'}
                    </Text>
                  </View>

                  <Text style={styles.inputLabel}>IP DO COMPUTADOR</Text>
                  <View
                    style={[styles.inputRow, validationMessage && styles.inputInvalid]}
                    onLayout={(event) => {
                      inputTop.current = event.nativeEvent.layout.y;
                    }}
                  >
                    <Laptop color={COLORS.accent} size={24} strokeWidth={1.8} />
                    <TextInput
                      accessibilityLabel="Endereço IP do computador"
                      autoCapitalize="none"
                      autoCorrect={false}
                      keyboardAppearance="dark"
                      keyboardType="url"
                      maxLength={270}
                      onChangeText={(value) => {
                        setAddress(value);
                        if (validationMessage) setValidationMessage(null);
                        if (connectionError) setConnectionError(null);
                      }}
                      onFocus={() => {
                        addressFocused.current = true;
                        if (Keyboard.isVisible()) revealAddress();
                      }}
                      onBlur={() => {
                        addressFocused.current = false;
                      }}
                      editable={!isConnecting}
                      onSubmitEditing={() => void connect()}
                      placeholder="192.168.1.10:8765"
                      placeholderTextColor={COLORS.muted}
                      returnKeyType="go"
                      selectionColor={COLORS.accent}
                      style={styles.input}
                      value={address}
                    />
                  </View>
                  {validationMessage && (
                    <Text accessibilityLiveRegion="polite" style={styles.validationMessage}>
                      {validationMessage}
                    </Text>
                  )}
                  {connectionError && (
                    <View accessibilityLiveRegion="assertive" style={styles.errorBox}>
                      <Text style={styles.errorTitle}>Falha na conexão</Text>
                      <Text style={styles.errorText}>{connectionError}</Text>
                    </View>
                  )}

                  <View style={styles.buttonWrap}>
                    <GradientButton
                      disabled={isConnecting}
                      label={isConnecting ? 'Conectando…' : 'Conectar'}
                      onPress={() => void connect()}
                    />
                  </View>
                </GlassCard>

                <View style={styles.networkNote}>
                  <Wifi color={COLORS.muted} size={22} />
                  <Text style={styles.networkNoteText}>
                    O computador precisa estar ligado com o agente aberto.
                  </Text>
                </View>
              </View>
            </ScrollView>
          </TouchableWithoutFeedback>
        </KeyboardAvoidingView>
        {pendingAddress && (
          <View accessibilityViewIsModal style={styles.loadingOverlay}>
            <GlassCard style={styles.loadingCard}>
              <ActivityIndicator color={COLORS.accent} size="large" />
              <Text style={styles.loadingTitle}>Conectando...</Text>
              <Text style={styles.loadingSubtitle}>
                Aguardando resposta do computador em {pendingAddress}
              </Text>
              <Pressable
                accessibilityLabel="Cancelar tentativa de conexão"
                accessibilityRole="button"
                onPress={cancel}
                style={({ pressed }) => [
                  styles.cancelButton,
                  pressed && styles.cancelButtonPressed,
                ]}
              >
                <Text style={styles.cancelButtonLabel}>Cancelar</Text>
              </Pressable>
            </GlassCard>
          </View>
        )}
        <FirstRunOnboarding />
        <FirstRunSetupNotice
          onDismiss={() => setIsMacHelpVisible(false)}
          visible={isMacHelpVisible}
        />
      </SafeAreaView>
    </ScreenBackground>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  flex: { flex: 1 },
  screen: {
    flexGrow: 1,
    paddingBottom: SPACE.lg,
    paddingHorizontal: SPACE.lg,
    paddingTop: SPACE.xs,
  },
  main: { alignSelf: 'center', maxWidth: 440, width: '100%' },
  hero: { alignItems: 'center', marginTop: SPACE.xs },
  title: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: '700',
    letterSpacing: -0.6,
    lineHeight: 39,
    marginTop: SPACE.xs,
    textAlign: 'center',
  },
  titleAccent: { color: COLORS.accent },
  subtitle: {
    alignSelf: 'center',
    color: COLORS.muted,
    fontSize: 15,
    lineHeight: 22,
    marginTop: SPACE.sm,
    maxWidth: 340,
    textAlign: 'center',
  },
  connectionCard: { marginTop: SPACE.lg, padding: SPACE.lg, paddingTop: SPACE.xl },
  cardHeading: { alignItems: 'center', gap: SPACE.xxs, marginBottom: SPACE.lg },
  cardTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  cardSubtitle: { color: COLORS.muted, fontSize: 14 },
  inputLabel: {
    color: COLORS.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 2,
    marginLeft: SPACE.xxs,
  },
  inputRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(6, 12, 50, 0.55)',
    borderColor: COLORS.border,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    flexDirection: 'row',
    gap: SPACE.md,
    marginTop: SPACE.sm,
    minHeight: 60,
    paddingHorizontal: SPACE.md,
  },
  input: { color: COLORS.text, flex: 1, fontSize: 18, letterSpacing: 0.4, minHeight: 58 },
  inputInvalid: { borderColor: COLORS.danger },
  validationMessage: { color: COLORS.danger, fontSize: 12, lineHeight: 16, marginTop: SPACE.xs },
  buttonWrap: { marginTop: SPACE.lg },
  errorBox: {
    backgroundColor: COLORS.dangerSurface,
    borderColor: COLORS.danger,
    borderRadius: RADIUS.medium,
    borderWidth: StyleSheet.hairlineWidth,
    gap: SPACE.xxs,
    marginTop: SPACE.sm,
    padding: SPACE.sm,
  },
  errorTitle: { color: COLORS.danger, fontSize: 12, fontWeight: '800' },
  errorText: { color: COLORS.text, fontSize: 12, lineHeight: 17 },
  loadingOverlay: {
    alignItems: 'center',
    backgroundColor: 'rgba(2, 5, 25, 0.72)',
    bottom: 0,
    justifyContent: 'center',
    left: 0,
    padding: SPACE.xl,
    position: 'absolute',
    right: 0,
    top: 0,
  },
  loadingCard: {
    alignItems: 'center',
    gap: SPACE.sm,
    maxWidth: 360,
    padding: SPACE.xl,
    width: '100%',
  },
  loadingTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  loadingSubtitle: { color: COLORS.muted, fontSize: 13, textAlign: 'center' },
  cancelButton: {
    alignItems: 'center',
    borderColor: COLORS.border,
    borderRadius: RADIUS.pill,
    borderWidth: 1,
    justifyContent: 'center',
    marginTop: SPACE.sm,
    minHeight: 46,
    paddingHorizontal: SPACE.xl,
  },
  cancelButtonPressed: { opacity: 0.7 },
  cancelButtonLabel: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  networkNote: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: SPACE.sm,
    marginTop: SPACE.lg,
    maxWidth: 280,
  },
  networkNoteText: { color: COLORS.muted, flex: 1, fontSize: 13, lineHeight: 18 },
});
