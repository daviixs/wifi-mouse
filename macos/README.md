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
- Python 3 para validação estrita dos resources no build/testes e para os scripts de DMG/smoke (biblioteca padrão; sem pacotes pip).

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

### Validação dos bundles de idiomas

A estrutura interna de um resource bundle depende do backend do SwiftPM. O backend native pode produzir `RemoteMouse_RemoteMouse.bundle/pt-br.lproj/Localizable.strings`; o SwiftBuild/macOS também produz `RemoteMouse_RemoteMouse.bundle/Contents/Resources/pt-br.lproj/Localizable.strings`. O nome de idioma pode ser normalizado para minúsculas. Isso não indica perda da tradução.

O erro antigo **“Erro: tradução ausente: pt-BR”** vinha do próprio `build-app.sh`: seu guard examinava apenas `.lproj` diretamente abaixo de `.bundle`. Ele já aceitava `pt-br` e `pt-BR`; trocar apenas a caixa não corrigia o layout aninhado. O guard rodava depois do build Swift e antes de finalizar/assinar o `.app`, portanto esse erro não vinha do `build-dmg.sh` e interrompia a cadeia `&&` antes de gerar o DMG.

Agora `bundle_resources.py` resolve os layouts flat e `Contents/Resources`, normaliza caixa e `_`/`-` do idioma, e verifica **todas as chaves e todos os valores** de pt-BR/en/es contra as fontes. Aceita `.strings` texto e plist binário/XML; em macOS usa o `plutil` nativo para formatos OpenStep/UTF-16. Tradução realmente ausente, desatualizada, ambígua ou com link externo continua sendo erro, com a raiz efetiva e os locais encontrados na mensagem.

O bundle inteiro é copiado sem mudar a hierarquia e validado novamente **no staging do app**, antes da assinatura. O smoke test usa o mesmo resolvedor. No runtime Swift, o diretório efetivo vem de `Bundle.resourceURL`, em vez de pressupor uma estrutura física ou depender de um diretório `.build` antigo.

Fixture de regressão reproduz a estrutura macOS SwiftBuild com `Contents/Resources/pt-br.lproj` e comprova que o guard antigo falhava mesmo com a tradução presente. Também cobre o bundle flat, nomes normalizados e tabelas compiladas; não é uma captura do computador do proprietário.

Referências públicas: [SwiftPM — Bundling resources](https://docs.swift.org/latest/documentation/packagemanagerdocs/bundlingresources/) e [teste funcional oficial que distingue native vs SwiftBuild](https://github.com/swiftlang/swift-package-manager/blob/5f6d79f6100d294948c3343f72c3472df26a697e/Tests/FunctionalTests/ResourcesTests.swift).

Para verificar somente um bundle existente (substitua o caminho pelo exibido pelo build):

```bash
python3 macos/scripts/bundle_resources.py /caminho/RemoteMouse_RemoteMouse.bundle \
  --source macos/RemoteMouse/Sources/RemoteMouse/Resources
python3 macos/scripts/test_bundle_resources.py
```

Após aplicar o patch de correção, retome `macos/scripts/test.sh && macos/scripts/build-app.sh arm64 && macos/scripts/build-dmg.sh arm64`. Não é necessário apagar `.build`, mudar o manifest de idiomas nem remover validações. Se já houver DMG anterior, arquive-o conforme a seção do instalador antes de gerar outro.

O script gera assinatura ad-hoc (`-`) por padrão, útil para desenvolvimento; isso **não** torna o app confiável pelo Gatekeeper. Para testes locais, copie o app para `/Applications`, abra-o pelo Finder e, se o macOS bloquear, confira **Ajustes do Sistema → Privacidade e Segurança → Abrir Mesmo Assim**, somente se reconhecer sua própria compilação. Não desative o Gatekeeper nem remova quarentena em massa.

Bundles anteriores são preservados com sufixo `previous.<data-hora>` (hora local do Mac). DMG existente não é sobrescrito: mova-o antes de gerar outro.

## Janela do instalador DMG

O fundo branco minimalista aprovado está em `macos/Resources/dmg/`. O original JPEG (1152×864) é preservado, e a imagem pronta para o Finder mede **640×480**. A arte/área útil pretendida é **640×480**. O pedido atual ao Finder é **{120,120,760,622}**, um retângulo de **640×502 nas coordenadas AppleScript**. A versão inicial presumiu 22 pontos de título, mas isso não foi calibrado no Mac do proprietário: não se deve afirmar que esses números sejam universalmente a moldura externa ou a área de conteúdo. O novo diagnóstico registra o retorno real do Finder antes/depois de reabrir. A legenda e os ornamentos têm margem.

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

Depois de fechar a janela, o build aguarda `.DS_Store` não vazio com tamanho/mtime estáveis por amostras consecutivas (máximo 10 segundos), desmonta sua imagem, converte para **UDZO somente leitura**, monta novamente em **outro mountpoint privado**, e verifica no Finder tamanho, visualização, barras, posições, nomes e fundo **sem reaplicar configurações**. Somente após essas verificações, desmontagem, assinatura opcional e `hdiutil verify` o arquivo final é publicado atomicamente, sem sobrescrever destino existente.

O macOS pode pedir autorização para o Terminal/host de build controlar o **Finder** em **Privacidade e Segurança → Automação**. Isso é separado da Acessibilidade do app Remote Mouse. Se negar, se não houver sessão gráfica, ou se a automação/layout falhar, o build termina com erro; não produz silenciosamente um DMG com layout padrão. Apple Events têm timeout de 60 segundos e `osascript` tem limite total de 90 segundos. Não há UI scripting, alteração de TCC, desativação de proteções ou execução como administrador.

Limpeza verifica o caminho da imagem e o mountpoint específico criados por esta execução; nunca ejeta por nome de volume, não usa unmount forçado e não toca discos alheios. Se não puder confirmar a desmontagem, preserva o workspace indicado no erro em vez de remover uma pasta que ainda pode conter volume montado. Resolva essa montagem antes de remover seus temporários manualmente.

### Diagnóstico de ícones e opções de visualização

O log real recebido do Mac confirmou bounds corretos após definir/reabrir, mas a mensagem antiga “posição do app incorreta” **não continha nenhuma coordenada dos ícones**. Não é possível provar a causa nativa daquele erro só com os bounds.

Constatado no código anterior: posições eram escritas na pasta `volumeRoot` **antes** de definir os bounds finais; a validação lia a pasta, fazia comparação de lista dentro de `tell Finder` e abortava no primeiro erro, sem mostrar o valor lido. A propriedade `position` já era a propriedade correta: significa posição dentro da janela pai. `desktop position` é outra propriedade, exclusiva da posição no desktop; **não é a correção** e não se deve somar a origem de tela aos pontos dos ícones. A diferença entre `item of volumeRoot` e `item of targetWindow` não é uma causa demonstrada: normalmente ambos podem identificar o mesmo item.

O incremento torna o contexto explícito: opções/`not arranged` → bounds finais estáveis → `position of item ... of targetWindow` → update → snapshot estável → fechar/reabrir → outro snapshot. Não muda arte, bounds, ícones **(170,240)/(470,240)** nem tamanhos 72/12; não tenta novas coordenadas, não reaplica ícones após reabrir e não escreve nenhuma posição no desktop. O modo `verify` somente lê o layout da imagem final.

Cada snapshot agora contém bounds, posições de **ambos** os ícones, visualização, arrangement (flag e nome), tamanhos, barras/sidebar, labels, informação extra e correspondência do fundo com o volume. Há até 25 leituras, pedindo quatro snapshots consecutivos iguais; isso espera estabilidade, **não** aceita um resultado errado. O seletor antigo da pasta é lido adicionalmente em `folder_app`/`folder_applications`, apenas para comparação diagnóstica; esses campos não dirigem escrita, validação nem estabilidade.

Os valores concretos são serializados para o protocolo v2 e comparados numericamente em Python, fora da terminologia/referências de objetos do Finder. Não se afirma que comparação de listas ou coerção fosse a causa original. Todas as divergências legíveis são agregadas em **um único erro**, incluindo os dois snapshots e a fase, em vez de descobrir um assert novo a cada tentativa. Uma opção ilegível que impeça a coleta ainda gera erro nativo identificado pela fase. Se a desmontagem também falhar, o diagnóstico da limpeza mantém a falha original e preserva os temporários. Tamanho/posições/opções continuam estritos, sem tolerância geométrica.

Como interpretar um eventual novo diagnóstico:

- Posição já errada em `configure:after-set`: o desvio ocorreu antes de fechar, não é demonstravelmente uma falha exclusiva de persistência.
- Posição correta no setter e diferente em `configure:after-reopen`: alteração ao reabrir; ainda pode ser persistência ou adaptação da janela/canvas, não se presume `.DS_Store` corrompido.
- Diferença entre `app` e `folder_app`: evidencia diferença entre seletores naquela execução; só as coordenadas do item da janela aberta validam o layout.
- `verify:after-reopen`: diferença na remontagem somente leitura; nenhuma correção é reaplicada para esconder a falha.
- `arrangement_none=0`: consultar `arrangement_text` para distinguir snap-to-grid/ordenação de posições livres. `1` significa a opção esperada, `0` significa falso; demais campos numéricos mostram os valores reais.

**Se falhar novamente, basta copiar o erro completo com ambos os snapshots** — não é preciso recompilar o app nem experimentar tolerâncias. Este é um ajuste de ordem/contexto e diagnóstico, **não uma causa macOS provada nem garantia de conclusão do build**. Finder/AppleScript não foram executados na box Linux.

Referências públicas consultadas: [dicionário Finder — position/desktop position/arrangement](https://github.com/ali-rantakari/trash/blob/master/Finder.sdef), [template create-dmg — container window, bounds antes de posicionar](https://github.com/create-dmg/create-dmg/blob/master/support/template.applescript). São referências de semântica/exemplos, não um teste do Mac do proprietário.

### Diagnóstico de tamanho e persistência

O erro antigo “tamanho inicial não persistido” comparava os **quatro números** de bounds. Portanto, podia acusar tamanho errado quando apenas x/y mudavam ao reabrir/remontar em outra posição de tela. Esse defeito de classificação é verificável no código; não prova que tenha sido a diferença observada no Mac, porque o erro antigo não registrava os números reais.

A correção separa origem de **largura/altura**, sem tolerância: o contrato atual continua exigindo exatamente **640×502 nas coordenadas retornadas por bounds**. Um retângulo transladado de mesmo tamanho passa; diferenças de um ponto ou de 22 pontos **não** são aceitas automaticamente. Também não se supõe que “is not” de AppleScript esteja quebrado: o cálculo numérico/testável agora ocorre em Python sobre coordenadas primitivas retornadas pelo Finder.

O tamanho é definido **uma vez, depois** de opções/barras/fundo e **antes** das posições dos ícones. Foi removida a sequência intermediária de encolher dez pontos e aumentar novamente. São coletadas leituras estáveis após o setter e após fechar/reabrir; a remontagem somente leitura continua apenas verificando, nunca corrigindo configurações. O script não altera preferências globais nem tenta corrigir chrome por números mágicos.

O log contém `pedido`, `após definir`, `após reabrir` e a fase:

- `configure:after-set`: Finder não retornou o tamanho solicitado após o setter; pode ser semântica de coordenadas/chrome ou limitação de tela.
- `configure:after-reopen`: setter estava correto, mas a reabertura retornou dimensão diferente; precisa investigar persistência/ajuste do Finder.
- `verify:after-reopen`: divergência após conversão/remontagem somente leitura.
- `configure:DS_Store`: o arquivo de metadados não ficou estável no limite de espera.

Essas são classificações, não diagnósticos definitivos de uma causa macOS. **Se ainda falhar, envie a linha completa `Finder[...]` com os dois retângulos reais**; não basta a mensagem antiga sem coordenadas. Isso permite decidir se há diferença de decoração ou gravação, sem escolher tamanhos ao acaso ou enfraquecer o gate. Enquanto uma dimensão real diferir do contrato, o DMG não é publicado.

Se o `.app` já foi criado, não recompile o app/Rust: basta `macos/scripts/build-dmg.sh arm64` (Intel: `x86_64`). Caso um DMG anterior exista, arquive-o com o bloco da seção acima; não o apague para diagnosticar.

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
