# Remote Mouse para macOS

App nativo **SwiftUI + AppKit**, residente na barra de menus, para macOS 13 ou superior. Clique no ícone de mouse no topo da tela para abrir o painel. O macOS decide a posição dos itens: o aplicativo não pode fixar seu ícone ao lado da câmera/notch. Não há ícone no Dock (`LSUIElement`).

O painel usa o azul-marinho, gradientes azuis, cards arredondados e a ilustração de computador do visual mobile como referência. Interface em pt-BR, inglês ou espanhol, escolhida automaticamente pelo idioma do sistema na abertura (fallback em inglês). Não é um app iOS e não altera o mobile nem os diretórios gerados `ios/`/`android/`.

## O que esta versão faz

- Iniciar/parar o servidor e encerrar pelo botão **Sair** (também ⌘Q no painel).
- Status confirmado pelo próprio helper **depois** do bind, da criação do controlador de input e da tentativa de anunciar mDNS. Um processo iniciado não é automaticamente considerado servidor pronto.
- Diferencia servidor online, aguardando celular e WebSocket realmente conectado.
- Nome do Mac, IPs IPv4, porta 8765, cópia do primeiro endereço `ws://IP:8765` e orientação para conexão mobile.
- Atualiza IPs e permissão do helper a cada dois segundos enquanto o servidor está ativo.
- Mostra a permissão de Acessibilidade do **agente que injeta input**, separada da permissão do app Swift; abre os ajustes de Acessibilidade e Rede.
- Exibe falhas de inicialização/porta ocupada sem tomar a porta ou encerrar outro agente.

Enquanto a permissão **real do helper** estiver negada, desconhecida ou com erro de verificação, um aviso bloqueia o painel. O fundo fica sem interação e fora da navegação do VoiceOver; **Abrir ajustes**, **Mostrar agente no Finder** e **Sair/⌘Q** continuam disponíveis. A autorização apenas do app Swift não libera o painel.

Um processo curto do próprio helper executa `--check-accessibility` a cada dois segundos (também ao reativar o app). Ele retorna somente a autorização do processo real, **antes de interpretar o bind, construir Enigo, abrir servidor, anunciar mDNS ou injetar input**. `--request-accessibility` é usado somente após clicar no CTA para solicitar a autorização. A consulta não depende de iniciar o servidor, evitando o bloqueio circular de exigir permissão para verificar permissão. Um bind propositalmente inválido é passado às consultas para impedir que um helper antigo/incompatível abra servidor por acidente.

Concessão libera o painel automaticamente; revogação ou falha de verificação volta a bloquear e encerra o servidor pertencente ao app. A verificação tem timeout de cinco segundos e é repetida automaticamente. Processos novos evitam confiar no cache de autorização de um servidor antigo. Ao conceder novamente, o servidor **não** reinicia sozinho: clique em Iniciar servidor. Indicadores de rolagem estão ocultos, mas conteúdo e aviso continuam roláveis por trackpad/roda e acessíveis.

Por segurança, o servidor só inicia quando você clica em **Iniciar servidor**. Não há inicialização automática no login nesta versão.

## Arquitetura e ciclo de vida

O bundle contém:

```text
Remote Mouse.app/
  Contents/Info.plist
  Contents/MacOS/RemoteMouse         # UI SwiftUI / MenuBarExtra (.window)
  Contents/MacOS/remote-mouse-agent  # o agente Rust deste repositório
  Contents/Resources/RemoteMouse.icns
  Contents/Resources/RemoteMouse_RemoteMouse.bundle/  # Localizable.strings pt-BR/en/es
  Contents/Resources/{pt-BR,en,es}.lproj/InfoPlist.strings
```

A UI inicia apenas o executável irmão dentro do próprio bundle, com `REMOTE_MOUSE_DESKTOP=1` e `REMOTE_MOUSE_BIND=0.0.0.0:8765`. Ela mantém um `Process` e pipes privados. Não procura processos por nome, não usa `killall`/`pgrep`, não reaproveita um servidor desconhecido e não abre outra porta para IPC.

O helper mantém protocolo WebSocket v1, mDNS `_remotemouse._tcp` e injeção enigo existentes. Apenas o modo desktop publica linhas JSON prefixadas por `REMOTE_MOUSE_EVENT ` em stdout e aceita `status`/`stop` em stdin. Logs normais são ignorados pela UI; stderr é drenado com limite de memória. O modo CLI normal continua funcionando sem stdin de controle.

`stop` ou EOF do pipe inicia encerramento limpo, inclusive se houver cliente preso antes do handshake WebSocket. São removidos anúncio mDNS e listener. Se o helper não sair, a UI envia SIGINT após 3 segundos e SIGTERM após 6 segundos **somente ao Process que criou**. Ao sair, a UI aguarda a terminação. Se a UI cair, EOF encerra o helper. Não há serviço privilegiado nem daemon instalado.

mDNS disponível significa que a biblioteca aceitou o anúncio; não é confirmação de que outro dispositivo o descobriu. Firewall, isolamento de rede ou permissão de Rede Local podem impedir a descoberta mesmo com servidor online.

## Pré-requisitos no Mac

- macOS 13+; Xcode ou Command Line Tools com SDK macOS e Swift 5.9+ (Xcode 15+ recomendado).
- Rust/Cargo 1.87+ e `rustup` (a dependência do agente requer essa versão).
- `python3` apenas para o smoke test opcional.

Os scripts usam apenas ferramentas Apple e Cargo; não exigem Homebrew, Tauri, Electron ou XcodeGen. É um projeto Swift Package: abra `macos/RemoteMouse/Package.swift` no Xcode para editar. **Para executar como app de barra de menus, use o bundle produzido pelo script**, não `swift run` nem o executável solto do Xcode: eles não têm o helper/Info.plist empacotados.

## Build local de teste

Na raiz do repositório, escolha a arquitetura do Mac de destino:

```bash
# Apple Silicon (M1/M2/M3/M4…)
rustup target add aarch64-apple-darwin
macos/scripts/test.sh
macos/scripts/build-app.sh arm64
macos/scripts/build-dmg.sh arm64

# Intel: use estes comandos no lugar dos dois builds acima
# rustup target add x86_64-apple-darwin
# macos/scripts/build-app.sh x86_64
# macos/scripts/build-dmg.sh x86_64
```

Saídas:

- `macos/dist/arm64/Remote Mouse.app`
- `macos/dist/arm64/Remote-Mouse-arm64.dmg`
- ou os mesmos caminhos em `macos/dist/x86_64/` para Intel.

Cada pacote leva **UI e Rust da mesma arquitetura**, verificados com `lipo`. Não é um universal binary. O build permite gerar a outra arquitetura no Mac, desde que o target Rust esteja instalado. Testes `swift test`/`cargo test` executam na arquitetura do host.

O script gera assinatura ad-hoc (`-`) por padrão, útil para desenvolvimento; isso **não** torna o app confiável pelo Gatekeeper. Para testes locais, copie o app para `/Applications`, abra-o pelo Finder e, se o macOS bloquear, confira **Ajustes do Sistema → Privacidade e Segurança → Abrir Mesmo Assim**, somente se reconhecer sua própria compilação. Não desative o Gatekeeper nem remova quarentena em massa.

Bundles anteriores são preservados com sufixo `previous.<data-hora>` (hora local do Mac). DMG existente não é sobrescrito: mova-o antes de gerar outro.

## Janela do instalador DMG

O fundo branco minimalista aprovado está em `macos/Resources/dmg/`. O original JPEG (1152×864) é preservado, e a imagem pronta para o Finder mede **640×480**. O instalador usa área útil nominal 640×480 e bounds iniciais do Finder **{120,120,760,622}**: janela externa de **640×502** pontos, reservando aproximadamente 22 pontos para o título. O chrome/escala do macOS pode variar ligeiramente; a legenda e os ornamentos têm margem.

Ícones: app à esquerda em **(170,240)**, Applications à direita em **(470,240)**, alinhados à seta central; tamanho **72**, nomes **12**, labels embaixo. Visualização por ícones, sem organização automática, sem toolbar/sidebar/status bar. Apenas app e Applications são itens visíveis na visualização normal; o fundo fica em `.background/` e os metadados em `.DS_Store`. A preferência pessoal de exibir arquivos ocultos continua sob controle do usuário.

**Isto define/persiste o tamanho e as posições iniciais, não trava o resize do Finder.** O usuário ainda pode redimensionar, mover a janela e mudar a visualização; o Finder pode lembrar escolhas anteriores ou adaptar a janela à tela. Nenhuma preferência global do Finder é alterada.

### Reconstruir apenas o DMG, com o .app já existente

Requisitos adicionais para o layout: **Python 3**, ferramentas Apple `hdiutil`, `ditto`, `codesign`, `osascript` e uma sessão gráfica do Finder aberta. Não há pacote pip/npm/Homebrew a instalar. Este comando não recompila Swift/Rust nem modifica o app original.

Na raiz do repositório:

```bash
ARCH=arm64  # Apple Silicon; para Intel use ARCH=x86_64
DMG="macos/dist/$ARCH/Remote-Mouse-$ARCH.dmg"
# Preserva o DMG anterior em uma pasta nova, sem apagar ou sobrescrever:
if [ -e "$DMG" ] || [ -L "$DMG" ]; then
  ARCHIVE="$(mktemp -d "macos/dist/$ARCH/dmg-anterior.XXXXXX")"
  mv "$DMG" "$ARCHIVE/"
fi
macos/scripts/build-dmg.sh "$ARCH"
```

O app precisa existir em `macos/dist/$ARCH/Remote Mouse.app`. O resultado novo fica no mesmo diretório, como `Remote-Mouse-arm64.dmg` ou `Remote-Mouse-x86_64.dmg`. Pode-se reconstruir um DMG Intel a partir do app Intel existente em um Mac Apple Silicon (e vice-versa); empacotar não executa o aplicativo. Para recriar também o aplicativo, rode `macos/scripts/build-app.sh "$ARCH"` antes do build do DMG.

Para assinar o novo container, mantenha `CODESIGN_IDENTITY` com sua identidade Developer ID, como na seção de assinatura. A assinatura do app copiado é preservada/verificada; o novo DMG precisa de **nova notarização/staple**, mesmo que um DMG anterior já tenha sido notarizado.

### Como o layout é persistido e validado

`build-dmg.sh` chama `create-dmg.py` (biblioteca padrão). É criado um workspace único e uma imagem HFS+ gravável. O Finder grava o layout real por `dmg-layout.applescript`; não são fabricados bytes de `.DS_Store`. O fundo é um arquivo do próprio volume, referenciado por alias relativo à raiz desse volume, não uma string com o caminho temporário do host.

Depois de fechar a janela, o build aguarda `.DS_Store`, desmonta sua imagem, converte para **UDZO somente leitura**, monta novamente em **outro mountpoint privado**, e verifica no Finder tamanho, visualização, barras, posições, nomes e fundo **sem reaplicar configurações**. Somente após essas verificações, desmontagem, assinatura opcional e `hdiutil verify` o arquivo final é publicado atomicamente, sem sobrescrever destino existente.

O macOS pode pedir autorização para o Terminal/host de build controlar o **Finder** em **Privacidade e Segurança → Automação**. Isso é separado da Acessibilidade do app Remote Mouse. Se negar, se não houver sessão gráfica, ou se a automação/layout falhar, o build termina com erro; não produz silenciosamente um DMG com layout padrão. Apple Events têm timeout de 60 segundos e `osascript` tem limite total de 90 segundos. Não há UI scripting, alteração de TCC, desativação de proteções ou execução como administrador.

Limpeza verifica o caminho da imagem e o mountpoint específico criados por esta execução; nunca ejeta por nome de volume, não usa unmount forçado e não toca discos alheios. Se não puder confirmar a desmontagem, preserva o workspace indicado no erro em vez de remover uma pasta que ainda pode conter volume montado. Resolva essa montagem antes de remover seus temporários manualmente.

Testes portáveis (não substituem Finder real):

```bash
python3 macos/scripts/test_dmg_layout.py
bash -n macos/scripts/build-dmg.sh
```

Checklist obrigatório no Mac: gerar, ejetar e abrir o DMG final pelo Finder, confirmar fundo/ícones/bounds e somente dois itens visíveis; testar em outra pasta/Mac sem o workspace; arrastar para Applications; verificar que nenhum volume temporário ficou montado. O build aqui foi escrito/testado em Linux com mocks dos comandos Apple: **nenhum DMG real nem AppleScript/Finder runtime foi executado nesta box**.

## Primeira execução e permissões

1. Abra o DMG e arraste **Remote Mouse** para **Applications**. Ejete o DMG e execute a cópia instalada (não a cópia montada no DMG).
2. Clique no ícone na barra de menus e em **Abrir ajustes de Acessibilidade** no aviso sobreposto. Autorize Remote Mouse e, se necessário, `remote-mouse-agent`. **Mostrar agente no Finder** revela o executável para adicioná-lo com o botão + nos ajustes. O painel só é liberado após a consulta real ao helper confirmar autorização. Ele fica em `/Applications/Remote Mouse.app/Contents/MacOS/remote-mouse-agent` (no seletor do Finder, use ⌘⇧G para ir ao caminho).
3. A mudança de permissão é detectada automaticamente, sem abrir servidor para consultar. Depois de o aviso sumir, clique em **Iniciar servidor**. Se revogar a autorização, o aviso retorna e o servidor é encerrado automaticamente. A verificação do helper é a fonte do status de controle, não a suposição de que o app pai foi autorizado.
4. Permita **Rede Local** se o macOS solicitar e **conexões de entrada** no Firewall. Em versões com esse controle, confira **Privacidade e Segurança → Rede Local** se a descoberta falhar. O botão Wi-Fi abre os ajustes de rede.
5. No celular, conectado à mesma rede Wi-Fi, escolha este Mac na descoberta automática. Como alternativa, digite no mobile um dos IPs exibidos (não o IP de VPN/outra interface). A porta é 8765. **Copiar endereço** copia a URL completa para diagnóstico.

Se a porta 8765 estiver ocupada por um agente aberto no Terminal, encerre **você mesmo esse agente** antes de iniciar o servidor pelo painel. O app não o encerra nem assume que ele lhe pertence.

Acesso à câmera, gravação de tela, monitoramento de entrada e privilégios de administrador não são necessários para as funções desta versão. Não há App Sandbox: o agente precisa das APIs de input e rede. Teste a atribuição de permissões do helper no bundle assinado final: o macOS pode atribuir o pedido ao app responsável ou listar o executável.

**Rede confiável apenas:** esta versão reaproveita o servidor sem autenticação e sem TLS, acessível em todas as interfaces IPv4. Quem alcançar a porta pode enviar comandos de mouse/teclado. Não exponha a porta à internet. Pare o servidor em redes públicas. Pairing/WSS não foram adicionados.

## Assinatura e notarização para distribuição

Use sua própria conta Apple Developer e um certificado **Developer ID Application** já instalado. Não há certificado, senha ou Team ID embutido no projeto.

```bash
CODESIGN_IDENTITY='Developer ID Application: SUA IDENTIDADE (SEU_TEAM_ID)'   macos/scripts/build-app.sh arm64
CODESIGN_IDENTITY='Developer ID Application: SUA IDENTIDADE (SEU_TEAM_ID)'   macos/scripts/build-dmg.sh arm64
```

O script assina primeiro o helper, depois o app, com Hardened Runtime e timestamp quando uma identidade real é fornecida. Não usa `codesign --deep` para assinar (apenas para verificar). Assinatura estável reduz problemas de autorização após atualizações; builds ad-hoc diferentes podem exigir remover e adicionar **apenas o Remote Mouse** novamente nos ajustes de Acessibilidade.

Para distribuir, use um perfil de notarização que você já tenha configurado no Keychain. Exemplo, **substituindo** o nome do perfil e arquitetura:

```bash
xcrun notarytool submit macos/dist/arm64/Remote-Mouse-arm64.dmg   --keychain-profile SEU_PERFIL --wait
# Somente depois de receber Accepted:
xcrun stapler staple macos/dist/arm64/Remote-Mouse-arm64.dmg
xcrun stapler validate macos/dist/arm64/Remote-Mouse-arm64.dmg
spctl --assess --type open --context context:primary-signature --verbose=2   macos/dist/arm64/Remote-Mouse-arm64.dmg
```

Opcionalmente notarize e faça staple do `.app` via ZIP antes de montar o DMG (para também distribuir o app fora do DMG); após alterar o app, gere e notarize **um novo DMG**. Gerar DMG, assinar e notarizar são etapas diferentes. Os scripts não enviam nada à Apple e não afirmam que um artefato foi notarizado.

## Testes

```bash
# Na raiz, regressões mobile (sem alterar o app)
npm ci
npm run lint
npm run typecheck
npm test
npm run test:motion

# Em qualquer host com Python 3: tabelas, placeholders e declarações de empacotamento
python3 macos/scripts/check-resources.py

# Em macOS: testes completos Rust + unitários Swift
macos/scripts/test.sh

# Após o build, mesmo sem autorização: consulta sem servidor/input
python3 macos/scripts/smoke-agent.py "macos/dist/arm64/Remote Mouse.app" --permission-only

# Após autorização de Acessibilidade:
python3 macos/scripts/smoke-agent.py "macos/dist/arm64/Remote Mouse.app"
```

O modo `--permission-only` roda com configuração de bind inválida para comprovar que a consulta não chega à inicialização do servidor; resultado `false` é válido e não é falha do processo. O smoke test completo inicia **seus próprios** helpers em porta temporária; não envia input e não mexe em processos existentes. Verifica evento ready/permissão real, conflito de porta, stop com cliente travado no handshake e encerramento por EOF. Pode solicitar permissão para o helper de teste; valide também o app instalado.

Checklist manual obrigatório no Mac:

- Sem Dock; ícone abre/fecha o painel; painel não ultrapassa a área útil (há rolagem).
- Permissão inicialmente negada/desconhecida: aviso indeletável, fundo inativo, CTA e Sair/⌘Q funcionam; não há servidor ou anúncio mDNS durante consultas.
- Concessão sem iniciar servidor libera automaticamente; só autorizar o app pai não deve bastar se o helper não estiver autorizado.
- Revogação enquanto conectado retorna aviso e para servidor; concessão posterior libera sem reiniciar servidor automaticamente.
- Falha/timeout do helper não libera o painel; novas consultas recuperam sem travar a UI.
- Idiomas pt-BR, en, es nas preferências do sistema/app (reinicie o app após mudar idioma), textos longos, leitores de tela e rolagem sem indicadores.
- Mover o .app para outra pasta/Mac sem a pasta .build: traduções e descrição de Rede Local continuam disponíveis.
- Porta ocupada não mata outro processo; tentar novamente funciona após liberar a porta.
- Iniciar/parar várias vezes; conexão/desconexão do celular atualiza o painel.
- Mouse, teclado, atalhos, mídia e volume continuam funcionando pelo celular.
- IP/cópia em Wi-Fi, múltiplas interfaces e troca de rede; descoberta mDNS/manual.
- **Sair**, fechamento do painel e encerramento forçado da UI: fechar painel não para servidor; sair/EOF para o helper. Não deve sobrar listener na porta.
- Build Intel/Apple Silicon, app instalado em `/Applications`, Firewall e Rede Local.

Consulte [VALIDACAO.md](VALIDACAO.md) para distinguir implementação de validação real. Não há teste de runtime macOS no Linux.
