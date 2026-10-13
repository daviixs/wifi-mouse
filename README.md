# Remote Mouse

Aplicativo mobile em React Native, Expo e TypeScript que transforma o celular em um touchpad para computadores na mesma rede Wi-Fi. O app se conecta ao agente Rust pelo endereço IPv4 informado na tela inicial, usando WebSocket na porta `8765`.

## Iniciar o aplicativo

```sh
npm install
npm start
```

Use `i` ou `a` no terminal do Expo para abrir o simulador iOS ou Android. Também é possível ler o QR code com o Expo Go.

## Conectar ao computador

1. No computador, inicie o agente Rust:

   ```sh
   cd rust-agent
   cargo run --release
   ```

2. Confira o IPv4 do computador na rede Wi-Fi. O agente mostra `0.0.0.0:8765` ao iniciar porque escuta em todas as interfaces; esse endereço é apenas de escuta, então use o IPv4 Wi-Fi do computador no app.
3. Conecte celular e computador à mesma rede Wi-Fi, digite esse IPv4 no app e toque em **Conectar**.
4. Permita a porta TCP `8765` no firewall do computador. No macOS, autorize o processo do agente em **Ajustes do Sistema → Privacidade e Segurança → Acessibilidade**.

O app abre o touchpad durante a conexão e mostra o estado atual do WebSocket. A reconexão automática permanece ativa caso a conexão caia.

## Build Android release local

O diretório `android/` é gerado pelo Expo Prebuild e permanece ignorado pelo Git. Para gerar o projeto nativo e compilar o APK release para `arm64-v8a`, execute na raiz do repositório:

```sh
# Android SDK (ajuste se o SDK estiver em outro local)
export ANDROID_HOME="$HOME/Library/Android/sdk"
export ANDROID_SDK_ROOT="$ANDROID_HOME"

# 1. Regenerar a pasta android/ quando necessário
npx expo prebuild --platform android

# 2. Compilar release
cd android
export NODE_ENV=production
./gradlew :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
```

O APK será criado em `android/app/build/outputs/apk/release/app-release.apk`.

## Estrutura

- `src/app`: rotas Expo Router para conexão manual e touchpad.
- `src/components`: touchpad, botões do mouse, estado da conexão e aviso inicial.
- `src/services/websocket`: cliente persistente, montagem do endereço, fila de comandos e reconexão exponencial.
- `src/stores`: estado global da conexão em Zustand.
- `src/types`: protocolo versionado compartilhado com o agente.
- `src/constants`: configuração, paleta, porta e desempenho da fila.
- `rust-agent`: agente leve para macOS e Windows.

## Gestos e protocolo

Um dedo envia deltas `mouse.move`; tap envia `mouse.click` esquerdo; dois dedos enviam `mouse.scroll` nos eixos vertical e horizontal; long press envia clique direito. Os gestos são processados pelo Gesture Handler/Reanimated, e a fila agrega o envio em intervalos curtos sem renderizar novamente a tela a cada movimento.

Os comandos são objetos JSON versionados, por exemplo:

```json
{ "version": 1, "type": "mouse.move", "payload": { "dx": 12, "dy": -4 } }
```

O agente escuta em `0.0.0.0:8765`, recebe uma conexão por vez e implementa `mouse.move`, `mouse.click` e `mouse.scroll`. A descoberta automática de computadores não está habilitada; a conexão usa o IP digitado no app. Ainda não há autenticação, criptografia, handshake ou confirmação de comandos; use o agente apenas em uma rede confiável. Consulte [rust-agent/README.md](rust-agent/README.md) para detalhes.

## Verificações

```sh
npm run typecheck
npm run lint
npx expo-doctor
```
