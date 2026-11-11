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
- `rust-agent`: agente leve para macOS e Windows (biblioteca + binário).
- `windows`: app nativo Win32 na área de notificação (roda o agente no mesmo processo) e empacotamento MSIX/Store.

## Gestos e protocolo

Um dedo envia deltas `mouse.move`; tap envia `mouse.click` esquerdo; dois dedos enviam `mouse.scroll` nos eixos vertical e horizontal; long press envia clique direito. O Reanimated acumula os deltas na thread de UI e os despacha no máximo uma vez por frame ativo, sem renderizar novamente a tela a cada movimento. O WebSocket envia cada delta agregado imediatamente e combina comandos adjacentes apenas se estiverem temporariamente enfileirados.

Os botões flutuantes no touchpad abrem o teclado nativo e o ajuste de sensibilidade. Texto, Backspace e Enter são enviados ao computador em tempo real. A sensibilidade afeta apenas o movimento do cursor, varia de `0.5×` a `3×` e é salva localmente.

Durante a atividade, o app registra estatísticas agregadas a cada cinco segundos no log `[RemoteMouse][diag][app]`. O agente Rust imprime recebimento, tempo de aplicação e erros em `[RemoteMouse][diag][agent]`. Esses tempos são locais a cada dispositivo e não representam latência de ponta a ponta.

Os comandos são objetos JSON versionados, por exemplo:

```json
{ "version": 1, "type": "mouse.move", "payload": { "dx": 12, "dy": -4 } }
```

O agente escuta em `0.0.0.0:8765`, recebe uma conexão por vez e implementa `mouse.move`, `mouse.click`, `mouse.scroll`, `keyboard.text` e `keyboard.key`. A descoberta automática de computadores não está habilitada; a conexão usa o IP digitado no app. Ainda não há autenticação, criptografia, handshake ou confirmação de comandos; use o agente apenas em uma rede confiável. Consulte [rust-agent/README.md](rust-agent/README.md) para detalhes.

## Verificações

```sh
npm run typecheck
npm run lint
npm run test:motion
npx expo-doctor
```

## Mídia e volume do computador

- Comando `media.key` (`{"version":1,"type":"media.key","payload":{"key":"volume_up"}}`), chaves: `volume_up`, `volume_down`, `volume_mute`, `play_pause`, `next`, `previous`, `stop`. Chaves desconhecidas são rejeitadas no app e ignoradas (com log) pelo agente.
- Agente: teclas de mídia do `enigo` (Windows: `VK_VOLUME_*`/`VK_MEDIA_*`; macOS: eventos `NX_SYSDEFINED` de tecla auxiliar, enviados pelo próprio enigo). No macOS não existe tecla "stop", então `stop` é ignorado.
- Botões físicos de volume (opção "Usar botões de volume do celular", ligada por padrão), ativos nas telas Conectado e Touchpad enquanto conectado:
  - **Android**: módulo Expo local `modules/volume-keys` registra um `ReactActivityHandler` (`onKeyDown/onKeyUp`), consome `KEYCODE_VOLUME_UP/DOWN` e envia ao computador. O volume do celular não muda e o HUD não aparece. Segurar o botão repete. Não funciona com a tela bloqueada nem com o app em segundo plano.
  - **iOS (melhor esforço)**: não há API pública para interceptar os botões. O módulo observa `AVAudioSession.outputVolume`, envia a direção e restaura o volume com um `MPVolumeView` oculto (que também esconde o HUD). Em 0% ou 100% o volume é ajustado para 50% ao ativar. Pode perder pressões muito rápidas, e a App Store pode questionar o uso.
  - Web/Expo Go: indisponível (no-op).

## Aplicativo macOS (barra de menus)

O shell nativo SwiftUI e os scripts de `.app`/DMG ficam em [`macos/`](macos/README.md). Reutiliza o agente Rust, com iniciar/parar, status real, IPs e orientação de permissões. Requer macOS 13+ para compilar e executar.

## Aplicativo Windows (área de notificação)

App nativo Win32 em Rust, sem webview, em [`windows/`](windows/README.md): iniciar/parar, status, IPs, cópia do endereço, idioma, **Iniciar com o Windows** e orientação sobre o Firewall do Windows. Inclui o instalador com assistente (Inno Setup, `windows/installer/`) e o manifesto e o script MSIX para a Microsoft Store.
