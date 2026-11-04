import { useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableWithoutFeedback,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { ArrowRight, CircleHelp, Wifi } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FirstRunSetupNotice } from '../components/FirstRunSetupNotice';
import { FirstRunOnboarding } from '../components/FirstRunOnboarding';
import { COLORS, RADIUS, SHADOWS, SPACE } from '../theme/tokens';
import { isValidIpv4Address } from '../services/websocket/serverUrl';
import { useConnectionStore } from '../stores/connection.store';

export default function HomeScreen() {
  const [address, setAddress] = useState('');
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const [isMacHelpVisible, setIsMacHelpVisible] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [pendingAddress, setPendingAddress] = useState<string | null>(null);
  const connectToServer = useConnectionStore((state) => state.connectToServer);
  const cancelConnection = useConnectionStore((state) => state.cancelConnection);
  const isConnecting = pendingAddress !== null;

  const connect = async () => {
    if (isConnecting) return;
    const normalizedAddress = address.trim();
    if (!isValidIpv4Address(normalizedAddress)) {
      setValidationMessage('Digite um endereço IPv4 válido, como 192.168.1.10.');
      return;
    }

    Keyboard.dismiss();
    setValidationMessage(null);
    setConnectionError(null);
    setPendingAddress(normalizedAddress);
    let outcome;
    try {
      outcome = await connectToServer(normalizedAddress);
    } catch {
      outcome = { kind: 'failed' as const, error: 'Não foi possível conectar ao computador.' };
    }
    setPendingAddress(null);
    if (outcome.kind === 'connected') {
      router.push('/touchpad');
    } else if (outcome.kind === 'failed') {
      setConnectionError(outcome.error);
    }
  };

  const cancel = () => {
    cancelConnection();
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            contentContainerStyle={styles.screen}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.topBar}>
              <View style={styles.brand}>
                <View style={styles.brandMark}>
                  <Wifi color={COLORS.surface} size={17} strokeWidth={2.1} />
                </View>
                <Text style={styles.brandText}>
                  REMOTE <Text style={styles.brandLight}>MOUSE</Text>
                </Text>
              </View>
              <Pressable
                accessibilityLabel="Ajuda para configurar o controle no Mac"
                accessibilityRole="button"
                onPress={() => setIsMacHelpVisible(true)}
                style={({ pressed }) => [styles.helpButton, pressed && styles.helpButtonPressed]}
              >
                <CircleHelp color={COLORS.primary} size={21} strokeWidth={1.9} />
              </Pressable>
            </View>

            <View style={styles.main}>
              <Text style={styles.title}>Seu computador,{`\n`}na ponta dos dedos.</Text>
              <Text style={styles.subtitle}>
                Conecte o celular e o computador à mesma rede Wi-Fi para começar.
              </Text>

              <View style={styles.connectionCard}>
                <View style={styles.cardHeading}>
                  <View style={styles.cardHeadingCopy}>
                    <Text style={styles.cardTitle}>Conectar ao computador</Text>
                    <Text style={styles.cardSubtitle}>Informe o endereço IP do agente</Text>
                  </View>
                </View>

                <Text style={styles.inputLabel}>IP DO COMPUTADOR</Text>
                <TextInput
                  accessibilityLabel="Endereço IP do computador"
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="decimal-pad"
                  maxLength={15}
                  onChangeText={(value) => {
                    setAddress(value.replace(/[^\d.,]/g, '').replace(/,/g, '.'));
                    if (validationMessage) setValidationMessage(null);
                    if (connectionError) setConnectionError(null);
                  }}
                  editable={!isConnecting}
                  onSubmitEditing={() => void connect()}
                  placeholder="192.168.1.10"
                  placeholderTextColor={COLORS.muted}
                  returnKeyType="go"
                  style={[styles.input, validationMessage && styles.inputInvalid]}
                  value={address}
                />
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

                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isConnecting }}
                  disabled={isConnecting}
                  onPress={() => void connect()}
                  style={({ pressed }) => [
                    styles.connectButton,
                    pressed && styles.connectButtonPressed,
                    isConnecting && styles.connectButtonDisabled,
                  ]}
                >
                  <Text style={styles.connectButtonLabel}>
                    {isConnecting ? 'Conectando…' : 'Conectar'}
                  </Text>
                  <ArrowRight color={COLORS.surface} size={18} strokeWidth={2.5} />
                </Pressable>
              </View>

              <View style={styles.networkNote}>
                <Wifi color={COLORS.muted} size={15} />
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
          <View style={styles.loadingCard}>
            <ActivityIndicator color={COLORS.primary} size="large" />
            <Text style={styles.loadingTitle}>Conectando...</Text>
            <Text style={styles.loadingSubtitle}>
              Aguardando resposta do computador em {pendingAddress}
            </Text>
            <Pressable
              accessibilityLabel="Cancelar tentativa de conexão"
              accessibilityRole="button"
              onPress={cancel}
              style={({ pressed }) => [styles.cancelButton, pressed && styles.cancelButtonPressed]}
            >
              <Text style={styles.cancelButtonLabel}>Cancelar</Text>
            </Pressable>
          </View>
        </View>
      )}
      <FirstRunOnboarding />
      <FirstRunSetupNotice
        onDismiss={() => setIsMacHelpVisible(false)}
        visible={isMacHelpVisible}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { backgroundColor: COLORS.background, flex: 1 },
  flex: { flex: 1 },
  screen: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: SPACE.xl,
    paddingTop: SPACE.md,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    height: 44,
    justifyContent: 'space-between',
  },
  brand: { alignItems: 'center', flexDirection: 'row', gap: SPACE.xs },
  helpButton: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: RADIUS.pill,
    borderWidth: StyleSheet.hairlineWidth,
    height: 40,
    justifyContent: 'center',
    width: 40,
    ...SHADOWS.floating,
  },
  helpButtonPressed: { transform: [{ scale: 0.96 }] },
  brandMark: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
    borderRadius: RADIUS.small,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  brandText: { color: COLORS.text, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  brandLight: { color: COLORS.muted, fontWeight: '500' },
  main: { alignSelf: 'center', maxWidth: 440, width: '100%' },
  title: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: '600',
    letterSpacing: -1.1,
    lineHeight: 38,
  },
  subtitle: {
    color: COLORS.muted,
    fontSize: 14,
    lineHeight: 21,
    marginTop: SPACE.sm,
    maxWidth: 330,
  },
  connectionCard: {
    backgroundColor: COLORS.surface,
    borderColor: '#E8EDF1',
    borderRadius: RADIUS.large,
    borderWidth: StyleSheet.hairlineWidth,
    marginTop: SPACE.xxl,
    padding: SPACE.lg,
    ...SHADOWS.card,
  },
  cardHeading: { marginBottom: SPACE.xl },
  cardHeadingCopy: { gap: SPACE.xxs },
  cardTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  cardSubtitle: { color: COLORS.muted, fontSize: 12 },
  inputLabel: { color: COLORS.muted, fontSize: 10, fontWeight: '800', letterSpacing: 1.4 },
  input: {
    backgroundColor: COLORS.background,
    borderColor: '#A9BBC6',
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    color: COLORS.text,
    fontSize: 17,
    letterSpacing: 0.5,
    marginTop: SPACE.xs,
    minHeight: 54,
    paddingHorizontal: SPACE.md,
  },
  inputInvalid: { borderColor: COLORS.danger },
  validationMessage: {
    color: COLORS.danger,
    fontSize: 11,
    lineHeight: 16,
    marginTop: SPACE.xs,
  },
  connectButton: {
    alignItems: 'center',
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.medium,
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: SPACE.lg,
    minHeight: 54,
    paddingHorizontal: SPACE.lg,
  },
  connectButtonPressed: { backgroundColor: COLORS.primary, transform: [{ scale: 0.99 }] },
  connectButtonDisabled: { opacity: 0.65 },
  connectButtonLabel: {
    color: COLORS.surface,
    fontSize: 14,
    fontWeight: '800',
    marginRight: SPACE.xs,
  },
  errorBox: {
    backgroundColor: '#FDECEC',
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
    bottom: 0,
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
    alignItems: 'center',
    backgroundColor: 'rgba(15, 23, 42, 0.45)',
    justifyContent: 'center',
    padding: SPACE.xl,
  },
  loadingCard: {
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    borderRadius: RADIUS.large,
    gap: SPACE.sm,
    maxWidth: 360,
    padding: SPACE.xl,
    width: '100%',
    ...SHADOWS.card,
  },
  loadingTitle: { color: COLORS.text, fontSize: 18, fontWeight: '700' },
  loadingSubtitle: { color: COLORS.muted, fontSize: 13, textAlign: 'center' },
  cancelButton: {
    alignItems: 'center',
    borderColor: COLORS.border,
    borderRadius: RADIUS.medium,
    borderWidth: 1,
    marginTop: SPACE.sm,
    minHeight: 46,
    justifyContent: 'center',
    paddingHorizontal: SPACE.xl,
  },
  cancelButtonPressed: { opacity: 0.7 },
  cancelButtonLabel: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  networkNote: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: SPACE.xs,
    marginTop: SPACE.lg,
    maxWidth: 300,
  },
  networkNoteText: { color: COLORS.muted, flex: 1, fontSize: 12, lineHeight: 17 },
});
