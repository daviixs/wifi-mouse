# Remote Mouse Agent

Agente leve para macOS e Windows. Escuta comandos WebSocket do aplicativo mobile e os encaminha para os eventos de mouse e teclado do sistema operacional.

## Requisitos

- Rust estável (MSRV 1.87)
- macOS ou Windows

## Executar

Na raiz do projeto:

```sh
cd rust-agent
cargo run --release
```

Por padrão, o agente escuta em `0.0.0.0:8765`, aceitando uma conexão por vez. Para mudar o endereço ou a porta:

```sh
REMOTE_MOUSE_BIND=0.0.0.0:9000 cargo run --release
```

No Windows PowerShell:

```powershell
$env:REMOTE_MOUSE_BIND = "0.0.0.0:9000"
cargo run --release
```

No app, digite o IPv4 Wi-Fi deste computador na tela inicial. O agente mostra `0.0.0.0:8765` ao iniciar porque escuta em todas as interfaces; não digite `0.0.0.0` no celular. Ambos precisam estar na mesma rede e o firewall deve permitir conexões TCP na porta escolhida. O app usa a porta padrão `8765`.

No macOS, permita que o agente controle o computador em **Ajustes do Sistema → Privacidade e Segurança → Acessibilidade** quando solicitado.

## Protocolo

Recebe mensagens de texto JSON com `version: 1` e os tipos `mouse.move`, `mouse.click`, `mouse.scroll`, `keyboard.text` e `keyboard.key`, conforme `src/types/protocol.ts` do app. `keyboard.key` aceita `backspace` e `enter`. Mensagens binárias, JSON inválido e versões desconhecidas são ignorados. Frames e mensagens são limitados a 1 KiB.

O crate usa runtime Tokio de thread única, um único cliente ativo e dependências mínimas, sem framework HTTP. Os comandos não recebem confirmação de aplicação. Esta primeira versão não implementa descoberta automática, autenticação nem criptografia; use apenas em uma rede confiável.
