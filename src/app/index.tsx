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
import { ArrowRight, Monitor, Wifi } from 'lucide-react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { FirstRunSetupNotice } from '../components/FirstRunSetupNotice';
import { COLORS, APP_CONFIG } from '../constants/config';
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
                <Wifi color={COLORS.accent} size={17} strokeWidth={2.1} />
              </View>
              <Text style={styles.brandText}>
                REMOTE <Text style={styles.brandLight}>MOUSE</Text>
              </Text>
            </View>

            <View style={styles.main}>
              <View style={styles.eyebrowRow}>
                <View style={styles.eyebrowDot} />
                <Text style={styles.eyebrow}>CONTROLE REMOTO · WI-FI</Text>
              </View>
              <Text style={styles.title}>Seu computador,{`\n`}na ponta dos dedos.</Text>
              <Text style={styles.subtitle}>
                Conecte o celular e o computador à mesma rede Wi-Fi para começar.
              </Text>

              <View style={styles.connectionCard}>
                <View style={styles.cardHeading}>
                  <View style={styles.computerIcon}>
                    <Monitor color={COLORS.accent} size={19} strokeWidth={1.8} />
                  </View>
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
                  placeholderTextColor="#69716a"
                  returnKeyType="go"
                  style={[styles.input, validationMessage && styles.inputInvalid]}
                  value={address}
                />
                {validationMessage ? (
                  <Text accessibilityLiveRegion="polite" style={styles.validationMessage}>
                    {validationMessage}
                  </Text>
                ) : (
                  <View style={styles.portHint}>
                    <View style={styles.portDot} />
                    <Text style={styles.portText}>Porta do agente: {APP_CONFIG.agentPort}</Text>
                  </View>
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
                  <ArrowRight color="#15190f" size={18} strokeWidth={2.5} />
                </Pressable>
              </View>

              <View style={styles.networkNote}>
                <Wifi color={COLORS.muted} size={15} />
                <Text style={styles.networkNoteText}>
                  O computador precisa estar ligado com o agente aberto.
                </Text>
              </View>
            </View>

            <Text style={styles.footer}>
              FEITO PARA SUA REDE LOCAL <Text style={styles.footerDot}>●</Text> PRIVADO POR DESIGN
            </Text>
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
    paddingHorizontal: 24,
    paddingTop: 16,
  },
  topBar: { alignItems: 'center', flexDirection: 'row', gap: 10, height: 44 },
  brandMark: {
    alignItems: 'center',
    backgroundColor: '#242b20',
    borderColor: '#39452c',
    borderRadius: 11,
    borderWidth: 1,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  brandText: { color: COLORS.text, fontSize: 11, fontWeight: '800', letterSpacing: 1.4 },
  brandLight: { color: COLORS.muted, fontWeight: '500' },
  main: { alignSelf: 'center', maxWidth: 440, width: '100%' },
  eyebrowRow: { alignItems: 'center', flexDirection: 'row', gap: 8, marginBottom: 14 },
  eyebrowDot: { backgroundColor: COLORS.accent, borderRadius: 4, height: 7, width: 7 },
  eyebrow: { color: COLORS.accent, fontSize: 9, fontWeight: '800', letterSpacing: 2 },
  title: {
    color: COLORS.text,
    fontSize: 32,
    fontWeight: '600',
    letterSpacing: -1.1,
    lineHeight: 38,
  },
  subtitle: { color: COLORS.muted, fontSize: 14, lineHeight: 21, marginTop: 12, maxWidth: 330 },
  connectionCard: {
    backgroundColor: COLORS.surface,
    borderColor: COLORS.border,
    borderRadius: 24,
    borderWidth: 1,
    marginTop: 30,
    padding: 20,
  },
  cardHeading: { alignItems: 'center', flexDirection: 'row', gap: 12, marginBottom: 23 },
  computerIcon: {
    alignItems: 'center',
    backgroundColor: '#242b20',
    borderRadius: 13,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  cardHeadingCopy: { flex: 1, gap: 4 },
  cardTitle: { color: COLORS.text, fontSize: 14, fontWeight: '700' },
  cardSubtitle: { color: COLORS.muted, fontSize: 11 },
  inputLabel: { color: COLORS.muted, fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  input: {
    backgroundColor: COLORS.background,
    borderColor: COLORS.border,
    borderRadius: 14,
    borderWidth: 1,
    color: COLORS.text,
    fontSize: 17,
    letterSpacing: 0.5,
    marginTop: 9,
    minHeight: 54,
    paddingHorizontal: 15,
  },
  inputInvalid: { borderColor: COLORS.danger },
  validationMessage: { color: COLORS.danger, fontSize: 11, lineHeight: 16, marginTop: 8 },
  portHint: { alignItems: 'center', flexDirection: 'row', gap: 7, marginTop: 10 },
  portDot: { backgroundColor: COLORS.accent, borderRadius: 3, height: 5, width: 5 },
  portText: { color: COLORS.muted, fontSize: 11 },
  connectButton: {
    alignItems: 'center',
    backgroundColor: COLORS.accent,
    borderRadius: 15,
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 21,
    minHeight: 54,
    paddingHorizontal: 20,
  },
  connectButtonPressed: { backgroundColor: COLORS.accentDark, transform: [{ scale: 0.99 }] },
  connectButtonDisabled: { opacity: 0.65 },
  connectButtonLabel: { color: '#15190f', fontSize: 14, fontWeight: '800', marginRight: 8 },
  networkNote: {
    alignItems: 'center',
    alignSelf: 'center',
    flexDirection: 'row',
    gap: 8,
    marginTop: 20,
    maxWidth: 300,
  },
  networkNoteText: { color: COLORS.muted, flex: 1, fontSize: 11, lineHeight: 16 },
  footer: {
    color: '#6e776f',
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.1,
    paddingBottom: 17,
    textAlign: 'center',
  },
  footerDot: { color: COLORS.accent },
});
