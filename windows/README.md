# Remote Mouse para Windows

App **nativo Win32 em Rust** que fica na **área de notificação** (ao lado do relógio), equivalente ao app de barra de menus do macOS em [`macos/`](../macos/README.md). Não usa Tauri, Electron nem webview.

- **Clique esquerdo** no ícone do mouse abre/fecha o painel. **Esc** ou clicar fora fecha.
- **Clique direito** abre o menu **Abrir · Iniciar/Parar servidor · Idioma · Iniciar com o Windows · Sair**.
- Painel: status Online/Offline, nome do PC, endereços `IP:8765` (sem `ws://` e sem separador de milhar), **Copiar endereço** (copia o primeiro, ex. `192.168.0.12:8765`), configurações de rede, Firewall do Windows, **Iniciar/Parar servidor** e **Sair**.
- Idiomas: pt-BR (automático em qualquer Windows em português), inglês e espanhol; fallback em inglês. O botão **PT/EN/ES** no topo do painel (ou o menu **Idioma**) troca e salva a escolha em `HKCU\Software\RemoteMouse`.
- Uma única cópia por usuário: abrir de novo apenas mostra o painel da cópia em execução.
- O servidor só inicia quando você clica em **Iniciar servidor** (igual ao macOS). A exceção é quando o app abre sozinho com o Windows (veja [Iniciar com o Windows](#iniciar-com-o-windows)): aí ele já liga o servidor e fica só no ícone da bandeja.

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

## Instalador com assistente (Inno Setup)

Gera `windows\dist\ConnectMouse-Setup-<versão>.exe`, um instalador clássico "Avançar → Avançar → Concluir" em português, inglês ou espanhol (escolhe pelo idioma do Windows).

1. Instale o **Inno Setup 6** (grátis): <https://jrsoftware.org/isdl.php> (ou `winget install JRSoftware.InnoSetup`). O Inno Setup 7 também funciona.
2. Na raiz do repositório (PowerShell):

   ```powershell
   # Se o PowerShell bloquear scripts: Set-ExecutionPolicy -Scope Process Bypass
   .\windows\installer\build-installer.ps1
   ```

   O script lê a versão do `windows\Cargo.toml`, roda `cargo build --release --locked --target x86_64-pc-windows-msvc`, acha o `ISCC.exe` (PATH, registro ou `Program Files`) e compila `windows\installer\ConnectMouse.iss`. Opções: `-Arch arm64`, `-SkipBuild`, `-Version 1.0.1`, `-Iscc "C:\...\ISCC.exe"`. Também dá para abrir o `.iss` no Inno Setup e clicar em **Compile** (depois do `cargo build --release`).

O que o instalador faz:

- Instala **só para o usuário atual**, sem pedir administrador, em `%LOCALAPPDATA%\Programs\ConnectMouse`. Na primeira tela dá para escolher **Instalar para todos os usuários** (pede administrador, vai para `C:\Program Files\ConnectMouse`).
- Atalho no menu Iniciar; atalho na área de trabalho é opcional.
- Caixa **"Iniciar o ConnectMouse quando o Windows iniciar"** (marcada por padrão): grava o mesmo valor que o menu do app usa (veja abaixo).
- Só na instalação para todos os usuários: caixa **"Liberar o ConnectMouse no Firewall do Windows"**, que cria as regras de entrada TCP 8765 e UDP 5353 para redes **privadas/domínio** (`netsh advfirewall`). Na instalação por usuário não há como criar regras sem administrador; o Windows mostra o aviso "Permitir acesso" na primeira vez que o servidor inicia (veja a seção do Firewall).
- Define o idioma inicial do app igual ao do instalador (se ainda não houver escolha salva).
- Se o app estiver aberto, fecha antes de atualizar/desinstalar. Ao final, oferece abrir o ConnectMouse.
- Desinstalar (Configurações → Aplicativos ou menu Iniciar) fecha o app, remove o "Iniciar com o Windows" e as regras de firewall que ele criou. As preferências em `HKCU\Software\RemoteMouse` ficam.
- Atualizar = rodar um instalador mais novo por cima (o `AppId` do `.iss` nunca muda).
- Silencioso (TI/scripts): `ConnectMouse-Setup-1.0.0.exe /VERYSILENT /TASKS="autostart"` (sem `autostart` para não iniciar com o Windows; `/ALLUSERS /TASKS="autostart,firewall"` para todos os usuários).

**SmartScreen:** um instalador sem assinatura digital baixado da internet mostra "O Windows protegeu o computador" (**Mais informações → Executar assim mesmo**) e alguns antivírus desconfiam. Para distribuir fora da Store, assine o `Setup.exe` (e o `RemoteMouse.exe`) com um certificado de assinatura de código (OV/EV, ou Azure Trusted Signing) usando a diretiva `SignTool` do Inno Setup. A versão da Microsoft Store não tem esse problema.

## Iniciar com o Windows

No menu do botão direito do ícone: **Iniciar com o Windows** (marcado = ligado). Ao abrir sozinho no login, o app vai direto para a bandeja **com o servidor já ligado** e sem o aviso de boas-vindas.

| Versão | Como funciona |
| --- | --- |
| `.exe` (instalador ou solto) | Valor `ConnectMouse` em `HKCU\Software\Microsoft\Windows\CurrentVersion\Run` com `"<caminho>\RemoteMouse.exe" --autostart`. É o mesmo valor que a caixa do instalador grava. Se você desligar em **Configurações → Aplicativos → Inicialização** (ou no Gerenciador de Tarefas), o menu mostra desmarcado; marcar de novo reativa. |
| MSIX / Microsoft Store | Apps empacotados ignoram a chave `Run`. O `AppxManifest.xml` declara uma tarefa `windows.startupTask` (`TaskId="ConnectMouseStartup"`, começa desligada) e o app usa a API WinRT `StartupTask`. Se o usuário desligou em **Configurações → Aplicativos → Inicialização**, o Windows não deixa o app religar sozinho: o menu vira **"Iniciar com o Windows (ativar em Configurações)…"** e abre essa página. Se uma política da empresa forçar ligado/desligado, o item fica cinza. |

Código: `windows/src/autostart.rs` (lógica testada com `cargo test`) e o item do menu em `windows/src/ui.rs`.

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

Os logotipos em `windows/packaging/Assets` e o ícone `windows/resources/RemoteMouse.ico` (e as imagens do assistente em `windows/installer/Wizard*.png`) são gerados a partir da logo do ConnectMouse (`website/public/favicon.svg`) com `python3 windows/scripts/generate-assets.py` (requer `pip install cairosvg pillow`; já versionados, não precisa rodar).

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
