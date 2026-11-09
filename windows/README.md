# Remote Mouse para Windows

App **nativo Win32 em Rust** que fica na **área de notificação** (ao lado do relógio), equivalente ao app de barra de menus do macOS em [`macos/`](../macos/README.md). Não usa Tauri, Electron nem webview.

- **Clique esquerdo** no ícone do mouse abre/fecha o painel. **Esc** ou clicar fora fecha.
- **Clique direito** abre o menu **Abrir · Iniciar/Parar servidor · Idioma · Sair**.
- Painel: status Online/Offline, nome do PC, endereços `IP:8765` (sem `ws://` e sem separador de milhar), **Copiar endereço** (copia o primeiro, ex. `192.168.0.12:8765`), configurações de rede, Firewall do Windows, **Iniciar/Parar servidor** e **Sair**.
- Idiomas: pt-BR (automático em qualquer Windows em português), inglês e espanhol; fallback em inglês. O botão **PT/EN/ES** no topo do painel (ou o menu **Idioma**) troca e salva a escolha em `HKCU\Software\RemoteMouse`.
- Uma única cópia por usuário: abrir de novo apenas mostra o painel da cópia em execução.
- O servidor só inicia quando você clica em **Iniciar servidor** (igual ao macOS).

## Arquitetura

| Parte | Onde | Observação |
| --- | --- | --- |
| UI (tray + painel) | `windows/src/ui.rs` | Win32 puro via [`windows-sys`](https://crates.io/crates/windows-sys) (crate oficial da Microsoft): `Shell_NotifyIconW`, janela popup `WS_POPUP` desenhada com GDI (cards, gradientes e botões *owner-draw* no visual do mac), ícones Segoe MDL2 Assets, DPI por monitor (PerMonitorV2), cantos arredondados no Windows 11. |
| Estado/textos | `windows/src/model.rs`, `windows/src/l10n.rs` | Sem Win32; testados em qualquer sistema (`cargo test`). Textos derivados de `macos/.../Localizable.strings`. |
| Servidor | `rust-agent` (biblioteca) | O app roda `remote_mouse_agent::server::run` **no mesmo processo**, em uma thread própria com runtime Tokio *current-thread*. Não há helper separado. |

Por que Win32 direto em vez de native-windows-gui/winsafe: o `windows-sys` já faz parte do agente (enigo/tokio), é mantido pela Microsoft, não traz runtime extra e o executável fica em ~1 MB. Os textos dos botões são o nome acessível lido pelo Narrador; Tab/Shift+Tab, Espaço/Enter e Esc funcionam no painel.

O agente continua funcionando como antes: `rust-agent` agora é **lib + bin**. O binário `remote-mouse-agent` (CLI e helper do macOS, com `REMOTE_MOUSE_DESKTOP=1` e controle por stdin/stdout) apenas mapeia os eventos da biblioteca para o mesmo protocolo de antes.

## Requisitos (no Windows)

1. Windows 10 1809+ ou Windows 11.
2. [Rust](https://rustup.rs) com a toolchain MSVC (padrão do rustup no Windows).
3. **Visual Studio Build Tools 2022** com a carga **Desenvolvimento para desktop com C++** (inclui MSVC e o **Windows 11 SDK**, que traz `rc.exe`, `MakeAppx.exe` e `signtool.exe`).
4. Para ARM64 (opcional): no Visual Studio Installer marque também **MSVC ... ARM64/ARM64EC build tools**.

## Compilar e executar

Na raiz do repositório (PowerShell):

```powershell
rustup target add x86_64-pc-windows-msvc
cargo build --release --locked --manifest-path windows\Cargo.toml --target x86_64-pc-windows-msvc
.\windows\target\x86_64-pc-windows-msvc\release\RemoteMouse.exe
```

ARM64 (opcional):

```powershell
rustup target add aarch64-pc-windows-msvc
cargo build --release --locked --manifest-path windows\Cargo.toml --target aarch64-pc-windows-msvc
```

Testes:

```powershell
cargo test --locked --manifest-path rust-agent\Cargo.toml
cargo test --locked --manifest-path windows\Cargo.toml
```

No Windows 11, ícones novos podem ficar escondidos na seta **^** da barra de tarefas. Na primeira execução aparece um aviso dizendo onde o app está. Para deixar o ícone sempre visível: **Configurações → Personalização → Barra de tarefas → Outros ícones da bandeja do sistema → Remote Mouse**.

Um `.exe` sem assinatura baixado da internet pode mostrar o SmartScreen ("O Windows protegeu o computador"). Para teste, use **Mais informações → Executar assim mesmo**. A versão da Store é assinada pela Microsoft.

## Firewall do Windows e porta 8765

- **Executável solto (.exe):** ao clicar em **Iniciar servidor** pela primeira vez, o Windows Defender Firewall mostra **"Permitir acesso"**. Marque **Redes privadas** e clique em **Permitir acesso**. Se o diálogo foi fechado ou negado, use **Abrir Firewall do Windows** no painel → **Permitir outro aplicativo…/Alterar configurações** e libere o `RemoteMouse.exe` em **Privada**.
- **Pacote MSIX/Store:** o manifesto já instala regras de entrada TCP 8765 (WebSocket) e UDP 5353 (mDNS/descoberta), só para redes de **domínio/privadas**. Não aparece o diálogo.
- A rede Wi-Fi precisa estar como **Privada**: **Configurações → Rede e Internet → Wi-Fi → (sua rede) → Tipo de perfil de rede → Rede privada**. Em rede pública o Windows bloqueia (comportamento seguro).
- **Porta em uso:** o painel mostra "A porta 8765 já está em uso…". Descubra quem usa com `netstat -ano | findstr :8765` e `tasklist /fi "PID eq <pid>"`. **Porta recusada** aparece se o Windows reservou a porta (Hyper-V/WSL: `netsh int ipv4 show excludedportrange protocol=tcp`) ou se um antivírus/política bloqueia.
- O botão de Wi-Fi abre **Configurações → Rede e Internet**.

## Limitações conhecidas

- Como todo app sem privilégio de administrador, o Windows (UIPI) **não deixa controlar janelas elevadas** (Gerenciador de Tarefas, instaladores, prompts do UAC), a tela de bloqueio nem a área segura. Não rode o app como administrador. A Store não aceita `uiAccess`.
- Sem QR code: o app do celular não lê QR. Use a descoberta automática (mDNS) ou **Copiar endereço**.
- Atende um celular por vez, igual ao agente atual.

## Pacote MSIX (teste local)

Os logotipos em `windows/packaging/Assets` e o ícone `windows/resources/RemoteMouse.ico` são gerados a partir de `assets/images/icon.png` com `python3 windows/scripts/generate-assets.py` (já versionados, não precisa rodar).

```powershell
# Se o PowerShell bloquear scripts: Set-ExecutionPolicy -Scope Process Bypass
.\windows\scripts\package-msix.ps1 -SelfSign
```

O script compila, monta `windows\dist\msix-x64\`, gera `windows\dist\RemoteMouse_1.0.0.0_x64.msix` e o assina com um certificado de teste. Depois, **uma vez**, em um PowerShell **como Administrador**:

```powershell
Import-Certificate -FilePath .\windows\dist\RemoteMouse-teste.cer -CertStoreLocation Cert:\LocalMachine\TrustedPeople
```

E instale/desinstale normalmente:

```powershell
Add-AppxPackage .\windows\dist\RemoteMouse_1.0.0.0_x64.msix
Get-AppxPackage *RemoteMouse* | Remove-AppxPackage
```

Opcional: valide com o **Windows App Certification Kit** (`appcert.exe`, no Windows SDK) antes de enviar.

## Publicar na Microsoft Store

1. Crie a conta de desenvolvedor em [Partner Center](https://partner.microsoft.com/dashboard) (individual ou empresa).
2. **Apps e jogos → Novo produto → Aplicativo MSIX ou PWA** e **reserve o nome**. "Remote Mouse" provavelmente já está em uso na Store; reserve um nome único (ex.: "Remote Mouse Wi-Fi"). O `DisplayName` do pacote precisa ser **idêntico** ao nome reservado.
3. Em **Gerenciamento do produto → Identidade do produto**, copie `Package/Identity/Name`, `Package/Identity/Publisher` e `Package/Properties/PublisherDisplayName`.
4. Gere o pacote **sem assinatura** (a Store assina):

   ```powershell
   .\windows\scripts\package-msix.ps1 -Version 1.0.0.0 `
     -IdentityName "<Package/Identity/Name>" `
     -Publisher "<CN=... de Package/Identity/Publisher>" `
     -PublisherDisplayName "<PublisherDisplayName>" `
     -DisplayName "<nome reservado>"
   ```

   Para ARM64, repita com `-Arch arm64` e envie os dois `.msix`. A cada envio, aumente a versão, sempre com o último número `0` (ex.: `1.0.1.0`).
5. Na submissão:
   - **Pacotes:** envie `windows\dist\RemoteMouse_<versão>_x64.msix`.
   - **Opções de envio → Funcionalidades restritas:** justifique `runFullTrust`. Sugestão: "Aplicativo desktop Win32 que recebe comandos do app Remote Mouse no celular pela rede local e simula mouse e teclado com SendInput; precisa de confiança total para injetar entrada e abrir um servidor local na porta 8765."
   - **Propriedades:** categoria **Utilitários e ferramentas**. Informe uma **URL de política de privacidade**: o app usa a rede local (`privateNetworkClientServer`). Ela pode dizer que nenhum dado sai da rede local e que nada é coletado.
   - **Classificação etária:** responda o questionário.
   - **Listagens da Store:** pt-BR, inglês e espanhol, com descrição e pelo menos 1 captura de tela (1366×768 ou maior) do painel.
6. Envie para certificação, que costuma levar de algumas horas a 3 dias úteis.
