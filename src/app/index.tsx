import { useState } from 'react';
import {
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
import { ArrowRight, Wifi } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FirstRunSetupNotice } from '../components/FirstRunSetupNotice';
import { COLORS, RADIUS, SHADOWS, SPACE } from '../theme/tokens';
import { isValidIpv4Address } from '../services/websocket/serverUrl';
import { useConnectionStore } from '../stores/connection.store';

export default function HomeScreen() {
  const [address, setAddress] = useState('');
  const [validationMessage, setValidationMessage] = useState<string | null>(null);
  const connectToServer = useConnectionStore((state) => state.connectToServer);
  const isConnecting = useConnectionStore(
    (state) => state.status === 'connecting' || state.status === 'reconnecting',
  );

  const connect = () => {
    const normalizedAddress = address.trim();
    if (!isValidIpv4Address(normalizedAddress)) {
      setValidationMessage('Digite um endereço IPv4 válido, como 192.168.1.10.');
      return;
    }

    Keyboard.dismiss();
    setValidationMessage(null);
    connectToServer(normalizedAddress);
    router.push('/touchpad');
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
              <View style={styles.brandMark}>
                <Wifi color={COLORS.surface} size={17} strokeWidth={2.1} />
              </View>
              <Text style={styles.brandText}>
                REMOTE <Text style={styles.brandLight}>MOUSE</Text>
              </Text>
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
                  }}
                  onSubmitEditing={connect}
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

                <Pressable
                  accessibilityRole="button"
                  accessibilityState={{ disabled: isConnecting }}
                  disabled={isConnecting}
                  onPress={connect}
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
      <FirstRunSetupNotice />
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
  topBar: { alignItems: 'center', flexDirection: 'row', gap: SPACE.xs, height: 44 },
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
