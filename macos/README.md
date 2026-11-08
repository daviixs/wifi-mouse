# Remote Mouse para macOS

App nativo **SwiftUI + AppKit**, residente na barra de menus, para macOS 13 ou superior. Clique esquerdo no ícone de mouse no topo abre/fecha o painel; clique direito abre o menu **Sair / Quit / Salir**, conforme o idioma, inclusive sem permissão. O macOS decide a posição dos itens: o aplicativo não pode fixar seu ícone ao lado da câmera/notch. Não há ícone no Dock (`LSUIElement`).

O painel usa o azul-marinho, gradientes azuis, cards arredondados e a ilustração de computador do visual mobile como referência. Interface em pt-BR, inglês ou espanhol, escolhida automaticamente pelo idioma do sistema na abertura (fallback em inglês). Não é um app iOS e não altera o mobile nem os diretórios gerados `ios/`/`android/`.

## O que esta versão faz

- Iniciar/parar o servidor e encerrar pelo botão **Sair** (também ⌘Q no painel).
- Status confirmado pelo próprio helper **depois** do bind, da criação do controlador de input e da tentativa de anunciar mDNS. Um processo iniciado não é automaticamente considerado servidor pronto.
- Diferencia servidor online, aguardando celular e WebSocket realmente conectado.
- Nome do Mac, IPs IPv4, porta 8765, cópia do primeiro endereço `ws://IP:8765` e orientação para conexão mobile.
- Atualiza IPs e permissão do helper a cada dois segundos enquanto o servidor está ativo.
- Mostra a permissão de Acessibilidade do **agente que injeta input**, separada da permissão do app Swift; abre os ajustes de Acessibilidade e Rede.
- Exibe falhas de inicialização/porta ocupada sem tomar a porta ou encerrar outro agente.

Enquanto a permissão **real do helper** estiver negada, desconhecida ou com erro de verificação, um aviso bloqueia o painel. O dashboard é retirado da árvore visual/VoiceOver, não apenas escurecido; a tela e o card do aviso têm superfícies RGB totalmente opacas, sem material/transparência. O texto cresce verticalmente e os CTAs ficam separados em uma área rolável; **Abrir ajustes**, **Mostrar agente no Finder** e **Sair/⌘Q** continuam disponíveis. A autorização apenas do app Swift não libera o painel.

Um processo curto do próprio helper executa `--check-accessibility` a cada dois segundos (também ao reativar o app). Ele retorna somente a autorização do processo real, **antes de interpretar o bind, construir Enigo, abrir servidor, anunciar mDNS ou injetar input**. `--request-accessibility` é usado somente após clicar no CTA para solicitar a autorização. A consulta não depende de iniciar o servidor, evitando o bloqueio circular de exigir permissão para verificar permissão. Um bind propositalmente inválido é passado às consultas para impedir que um helper antigo/incompatível abra servidor por acidente.

Concessão libera o painel automaticamente; revogação ou falha de verificação volta a bloquear e encerra o servidor pertencente ao app. A verificação tem timeout de cinco segundos e é repetida automaticamente. Se o processo ignorar SIGTERM, SIGKILL após mais dois segundos libera o slot apenas após sua terminação; só existe uma consulta em voo. Processos novos evitam confiar no cache de autorização de um servidor antigo. Ao conceder novamente, o servidor **não** reinicia sozinho: clique em Iniciar servidor. O aviso tem indicador de rolagem; Sair fica fora da área rolável. O dashboard normal continua rolável sem indicador.

Por segurança, o servidor só inicia quando você clica em **Iniciar servidor**. Não há inicialização automática no login nesta versão.

### Atribuição TCC: sem fingir autorização

AXIsProcessTrustedWithOptions verifica o **processo que chama a API**; o prompt é assíncrono e seu retorno não significa que o usuário acabou de aceitar. A atribuição TCC também considera o app responsável pela cadeia de execução: um helper iniciado diretamente pelo app pode aparecer nos ajustes como **Remote Mouse**, sem exigir uma segunda entrada. Não se usa API privada para separar essa responsabilidade.

O CTA agora solicita apenas pelo helper embutido, com a mesma cadeia `Process`, diretório e executável usados pelo servidor; não dispara dois prompts concorrentes app/helper. O estado do app Swift é mostrado apenas como diagnóstico. **Nunca** se faz `appTrusted || helperTrusted`: a liberação depende de uma resposta válida/exit 0 da consulta real do helper. Além disso, o próprio servidor consulta AX novamente **antes do bind e de Enigo**, rejeitando início se negado. Concessão não inicia o listener automaticamente.

Se o app informa autorizado e o helper informa negado, há mensagem específica. Isso não prova que o helper precise de entrada separada: assinatura ad-hoc alterada, cópia antiga, execução por Terminal/DMG ou cache/atribuição são hipóteses a distinguir. O padrão do build é assinatura ad-hoc; outro build pode exigir remover/adicionar **somente a entrada desta instalação** nos ajustes. Não se acessa/reset TCC.db nem se pede acesso amplo a Terminal.

**Copiar diagnóstico de permissão** copia somente caminhos/PIDs do próprio app/helper, resultados AX, saída/código/mode da última consulta e metadados públicos de assinatura no disco (validade, flags, identificador, team e cdhash). Não coleta banco TCC, rede ou conteúdo privado. A observação AX do app pode ter cache; não é prova de permissão do helper. Se continuar bloqueado, esse JSON é o diagnóstico mínimo necessário antes de outra mudança.

**Limite comprovado:** a sobreposição vinha de um dimmer alpha 0,65 + card alpha 0,45/0,55 sobre o dashboard. Corrigido por substituição da árvore e fundos sem alpha. A causa do grant não observado naquele Mac não foi reproduzida; fluxo/diagnóstico foram corrigidos sem contornar consentimento. SwiftUI, TCC e menu nativos ainda precisam ser compilados/testados no Mac.

Referências: [AXUIElement.h — caller e prompt assíncrono](https://raw.githubusercontent.com/phracker/MacOSX-SDKs/master/MacOSX11.3.sdk/System/Library/Frameworks/ApplicationServices.framework/Versions/A/Frameworks/HIServices.framework/Versions/A/Headers/AXUIElement.h), [responsible process — Qt](https://www.qt.io/blog/the-curious-case-of-the-responsible-process), [Apple TN2206 — identidade de código](https://developer.apple.com/library/archive/technotes/tn2206/_index.html).

## Arquitetura e ciclo de vida

O bundle contém:

```text
Remote Mouse.app/
  Contents/Info.plist
  Contents/MacOS/RemoteMouse         # UI SwiftUI / NSStatusItem + NSPopover
  Contents/MacOS/remote-mouse-agent  # o agente Rust deste repositório
  Contents/Resources/RemoteMouse.icns
  Contents/Resources/RemoteMouse_RemoteMouse.bundle/  # Localizable.strings pt-BR/en/es
  Contents/Resources/{pt-BR,en,es}.lproj/InfoPlist.strings
```

A UI inicia apenas o executável irmão dentro do próprio bundle, com `REMOTE_MOUSE_DESKTOP=1` e `REMOTE_MOUSE_BIND=0.0.0.0:8765`. Ela mantém um `Process` e pipes privados. Não procura processos por nome, não usa `killall`/`pgrep`, não reaproveita um servidor desconhecido e não abre outra porta para IPC.

O helper mantém protocolo WebSocket v1, mDNS `_remotemouse._tcp` e injeção enigo existentes. Apenas o modo desktop publica linhas JSON prefixadas por `REMOTE_MOUSE_EVENT ` em stdout e aceita `status`/`stop` em stdin. Logs normais são ignorados pela UI; stderr é drenado com limite de memória. O modo CLI normal continua funcionando sem stdin de controle.

`stop` ou EOF do pipe inicia encerramento limpo, inclusive se houver cliente preso antes do handshake WebSocket. São removidos anúncio mDNS e listener. Se o helper não sair, a UI envia SIGINT após 3 segundos e SIGTERM após 6 segundos e SIGKILL como último recurso após 8 segundos **somente ao Process que criou**. Ao sair, a UI aguarda a terminação do servidor e da eventual consulta curta de permissão antes de concluir `applicationShouldTerminate`. Se a UI cair, EOF encerra o helper. Não há serviço privilegiado nem daemon instalado.

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

O fundo branco aprovado continua em `macos/Resources/dmg/`, PNG **640×480**, sem alterações de arte. Ícones centrados em **(170,240)** e **(470,240)**, tamanho 72, nomes 12 abaixo. Apenas app e link Applications são visíveis normalmente; o fundo permanece oculto em `.background/background.png`.

### Por que deixar de automatizar Finder

O log real de `df98a7d` confirmou: após o setter os ícones estavam em y240, após reabrir ambos passaram para y253; bounds e demais opções não mudaram e ambos os seletores concordaram. Logo a hipótese de divergência entre seletor de pasta/janela não se confirmou nesse Mac. `background=0` já era observado antes de reabrir, mas o guard antigo condensava **erro de leitura/coerção** e **comparação falsa de alias** no mesmo zero: esse log não prova que a imagem estivesse ausente ou que o setter tivesse falhado.

Não há evidência suficiente para atribuir os 13 pontos a título, origem de scroll, centro da legenda ou serialização interna do Finder. Não há compensação `-13`, tolerância ou loop tentando coordenadas novas. Em vez de outra variação do AppleScript, apenas a etapa de layout foi substituída pelo modelo de metadados usado pelo **dmgbuild**; hdiutil, ditto, assinaturas, publicação e limpeza segura continuam no pipeline existente.

### Layout persistido por codecs conhecidos

`dmg_metadata.py` usa **ds_store 1.3.1** e **mac_alias 2.2.2** (MIT). Os dois wheels Python puros vêm no repositório/patch, com licenças e hashes verificados antes da importação. Não requer pip, Homebrew, download durante o build, novo Python ou alteração de ambiente global. Ver `macos/scripts/vendor/README.md`.

São escritos registros reais `.DS_Store`: `bwsp` para a janela, `icvp` para visualização/fundo, `icvl=icnv`, `vSrn=1` e `Iloc` para os centros dos ícones. O contrato agora é **640×480 nominal nos metadados**, via `WindowBounds={{120,120},{640,480}}`, como no dmgbuild — não o retângulo de bounds da API AppleScript. Não se soma uma decoração de 22 pontos. Os `Iloc` mantêm precisamente os pontos aprovados; scroll e grid offset ficam em zero, grid spacing 80 (dentro do limite documentado), `arrangeBy=none`, barras/sidebar ocultos.

O Alias do fundo é criado **nativamente** no Mac a partir do arquivo dentro da imagem montada, com identidade real de volume, datas e CNIDs; não é um blob inventado nem um `.DS_Store` de outro disco. O destino deve ser relativo à raiz desse volume, exatamente `.background/background.png`. O registro é preservado **integralmente**, como no dmgbuild, inclusive a dica POSIX do mountpoint. A dica do volume é diferente do destino do arquivo: o destino continua relativo ao volume. O build anterior apagava essa dica; isso era uma divergência indevida do upstream. A nova verificação exige que o macOS resolva o Alias na montagem atual, sem depender de relocalização entre dois mountpoints privados.

O volume HFS+ recebe um nome interno exclusivo por build, `Remote Mouse <12 hex>`, mantido sem renomeação durante conversão/publicação. Esse sufixo aparece no título do volume no Finder; nome do `.app`, arte e arquivo `Remote-Mouse-arm64.dmg` não mudam. São 25 bytes ASCII, dentro do campo de 27 bytes do Alias v2. Como no dmgbuild, `hdiutil attach` escolhe o mountpoint canônico `/Volumes/<nome>`; não há `-mountpoint`, criação manual nem remoção de entradas em `/Volumes`. O caminho deve estar desocupado; sufixo automático ou outro caminho causa erro, nunca ejeção de outro disco.

Depois de fechar/fsync do arquivo, ele é lido e validado; a imagem é desmontada, convertida a **UDZO**, montada somente leitura no **mesmo caminho canônico** e validada de novo. Assim, Alias intacto, nome de volume e sua dica POSIX continuam coerentes nas duas fases. O nome exclusivo evita ambiguidade com imagens de outros builds; não se afirma que alguma estivesse montada no erro recebido. A validação: A validação:

- exige todas as opções e coordenadas `Iloc` exatas, sem tolerância (inclusive um ponto ou +13 é rejeitado);
- lê e interpreta o Alias; exige caminho relativo, identidade do volume e identidade do arquivo iguais às obtidas nativamente do fundo na montagem atual;
- converte o registro Alias em Bookmark e o resolve pelo **CoreFoundation do macOS**, sem UI e sem montar volumes; exige a mesma identidade real **device/inode** do fundo da montagem atual (equivalente a `samefile`, aceitando caminhos/symlinks canônicos equivalentes), não apenas um parser aceitando seus próprios bytes;
- confere fundo byte a byte contra o PNG aprovado e link `/Applications`;
- exige o mesmo SHA-256 de `.DS_Store` antes e depois da conversão/remontagem;
- continua verificando assinatura do app copiado e `hdiutil verify`, antes de publicar sem sobrescrever.

Não abre Finder, não lê seu cache, não altera TCC ou preferências globais e não precisa de permissão de Automação/sessão gráfica. O build precisa de **macOS, Python 3 e ferramentas hdiutil/ditto/codesign**; `Alias.for_file` é uma API nativa via a biblioteca. A resolução nativa roda em processo separado com limite de 20s. Se falhar, o erro identifica `metadata[write|verify]`, mountpoint, CFError/caminho resolvido, valores reais, identidade e dica POSIX do Alias, existência/caminho canônico/device/inode dos dois arquivos e entidades hdiutil **somente desta imagem**; não mascara a falha com um Boolean genérico. `stale=true` é informativo, não reprova um arquivo com identidade correta. Falha de desmontagem mantém o erro original e preserva o workspace; discos alheios não são desmontados.

**Limite:** a validação é dos metadados efetivos na imagem somente leitura, não um teste de renderização do Finder. O layout segue uma implementação pública usada em produção; a criação nativa do Alias, o DMG, a dimensão visível de conteúdo/chrome e a aparência ainda precisam de validação no Mac. Nada disso foi executado na box Linux. Finder continua redimensionável e pode adaptar a janela à tela do usuário.

### Resolução fora da montagem após `460dc17`

**Comprovado:** o CoreFoundation retornou `/Volumes/Remote Mouse/.background/background.png`, enquanto o build usava dois mounts privados diferentes. O gate anterior já usava `samefile`, não mera igualdade de strings: essa mensagem específica significa que a comparação retornou identidade divergente naquele instante (arquivo ausente teria produzido erro stat). Faltavam os números de device/inode e caminhos canônicos para localizar a divergência. O fluxo também diferia do dmgbuild, que deixa hdiutil escolher o caminho canônico. Corrige-se essa divergência com o fluxo canônico exclusivo acima, preservando integralmente o Alias e o gate de identidade — não se relaxa a verificação.

**Não comprovado:** por que o resolvedor escolheu aquele caminho (cache nativo, fallback da conversão Alias→Bookmark ou outra imagem). `stale=true` sozinho não identifica causa nem significa resolução inválida. As flags CF continuam sem UI/montagem; não se inventou base relativa para um Alias com identidade própria. A estratégia remove a necessidade de relocalização, mas a resolução e o fundo visual continuam pendentes do teste Mac. O nome interno do volume não deve ser alterado depois de criar o Alias; mover/renomear o arquivo `.dmg` externo não equivale a renomear esse volume.

### Fundo branco e itens ocultos: correção após o primeiro DMG

A arte PNG foi inspecionada: contém ornamentos, seta e texto. No build anterior os bytes chegavam íntegros à imagem, mas isso não provava que o Finder resolvesse seu Alias. O defeito verificável no código era a **remoção de campos do Alias nativo que o dmgbuild conserva**; o efeito exclusivo disso na renderização ainda depende do teste Mac. Foi removida a sanitização e acrescentada a resolução nativa real acima. Não foram inventadas chaves `backgroundImageAliasData`, BKGD/PctB ou flags de janela: a fixture binária gerada pelo writer original dmgbuild 1.6.7 confirma `icvp.backgroundImageAlias`, `backgroundType=2`, `icvl` e `ShowStatusBar=false`. Ver `scripts/fixtures/README.md`.

Pastas `.background` e `.fseventsd` esmaecidas são compatíveis com **mostrar itens ocultos** ligado no Finder. Para a visualização normal, use **⌘⇧. (Command+Shift+ponto)** na janela do Finder, se quiser desligar essa preferência. O prefixo ponto já oculta essas pastas no modo normal; flags adicionais não anulam a opção de mostrar ocultos. O build não altera defaults globais e **não apaga `.fseventsd`**, que é do sistema.

A flag de barra de status é igual à usada pelo upstream e não foi alterada às cegas. Antes de testar, ejete **manualmente no Finder** as cópias antigas deste DMG que você abriu, feche suas janelas e só então abra a imagem nova. Montagens simultâneas com o mesmo nome/cache e preferências da janela podem confundir o teste; são hipóteses, não causas confirmadas. Se a barra continuar visível, registre isso no teste visual; o arquivo sozinho não comprova o estado da UI.

### Reconstruir apenas o DMG

O `.app` existente não é recompilado nem modificado. **Ejete antes a imagem antiga pelo Finder** (não discos alheios). Arquive o DMG existente em vez de apagá-lo. Na raiz do repositório:

```bash
ARCH=arm64  # Intel: x86_64
DMG="macos/dist/$ARCH/Remote-Mouse-$ARCH.dmg"
if [ -e "$DMG" ] || [ -L "$DMG" ]; then
  ARCHIVE="$(mktemp -d "macos/dist/$ARCH/dmg-anterior.XXXXXX")"
  mv "$DMG" "$ARCHIVE/"
fi
macos/scripts/build-dmg.sh "$ARCH"
```

Se o build anterior falhou sem publicar DMG, basta `macos/scripts/build-dmg.sh arm64`. Identidade `CODESIGN_IDENTITY` e processo de notarização continuam os mesmos; um DMG novo exige nova notarização/staple para distribuição.

Testes portáveis:

```bash
python3 macos/scripts/test_dmg_metadata.py
python3 macos/scripts/test_alias_resolution.py
python3 macos/scripts/test_dmg_layout.py
bash -n macos/scripts/build-dmg.sh
```

Os testes de metadados escrevem/reabrem `.DS_Store` e Alias **binários reais**, mas usam identidade de filesystem de fixture declarada no Linux. A fixture upstream usa seu writer original com processos/identidade nativa simulados; os testes CoreFoundation também têm stubs e **não** são execução nativa. A orquestração hdiutil/codesign tem mocks. Checklist no Mac: gerar, ejetar, abrir a imagem final em outra pasta, conferir imagem/legendas/ícones alinhados, arrastar para Applications e confirmar ausência de volumes temporários. A renderização não é certificada por um teste de bytes.

Referências: [settings/window_rect e limite grid_spacing](https://dmgbuild.readthedocs.io/en/latest/settings.html), [dmgbuild core](https://github.com/dmgbuild/dmgbuild/blob/main/src/dmgbuild/core.py), [hdiutil: mounts em /Volumes e plist](https://keith.github.io/xcode-man-pages/hdiutil.1.html), [formato Iloc — centro do ícone, sem legenda](https://metacpan.org/dist/Mac-Finder-DSStore/view/DSStoreFormat.pod), [mac_alias — caminho relativo ao volume](https://github.com/dmgbuild/mac_alias/blob/master/src/mac_alias/alias.py).

## Primeira execução e permissões

1. Abra o DMG e arraste **Remote Mouse** para **Applications**. Ejete o DMG e execute a cópia instalada (não a cópia montada no DMG).
2. Clique no ícone na barra de menus e em **Abrir ajustes de Acessibilidade** na tela opaca de permissão. Autorize a instalação atual do Remote Mouse. Só adicione `remote-mouse-agent` separadamente se o macOS solicitar esse executável. **Mostrar agente no Finder** revela o executável para adicioná-lo com o botão + nos ajustes. O painel só é liberado após a consulta real ao helper confirmar autorização. Ele fica em `/Applications/Remote Mouse.app/Contents/MacOS/remote-mouse-agent` (no seletor do Finder, use ⌘⇧G para ir ao caminho).
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

**Atenção:** o smoke abaixo executa o helper como filho do Terminal/Python, não reproduz a cadeia responsável do app aberto pelo Finder. Um resultado diferente não prova defeito na permissão do app; não autorize o Terminal para mascarar isso. A consulta dentro do painel é o teste relevante do bundle instalado.

O modo `--permission-only` roda com configuração de bind inválida para comprovar que a consulta não chega à inicialização do servidor; resultado `false` é válido e não é falha do processo. O smoke test completo inicia **seus próprios** helpers em porta temporária; não envia input e não mexe em processos existentes. Verifica evento ready/permissão real, conflito de porta, stop com cliente travado no handshake e encerramento por EOF. Pode solicitar permissão para o helper de teste; valide também o app instalado.

Checklist manual obrigatório no Mac:

- Sem Dock; esquerdo abre/fecha painel; direito abre menu Sair/Quit/Salir nos três idiomas, com permissão negada, servidor parado e servidor ativo. O menu usa somente NSStatusItem/NSPopover/NSMenu públicos, sem inspecionar janelas de outros hosts.
- Permissão inicialmente negada/desconhecida: aviso opaco sem letras do dashboard por trás, rolagem até todos os CTAs e Sair/⌘Q visíveis; não há servidor ou anúncio mDNS durante consultas.
- Concessão sem iniciar servidor libera automaticamente; só autorizar o app pai não deve bastar se o helper não estiver autorizado.
- Revogação enquanto conectado retorna aviso e para servidor; concessão posterior libera sem reiniciar servidor automaticamente.
- Falha/timeout do helper não libera o painel; novas consultas recuperam sem travar a UI.
- Idiomas pt-BR, en, es nas preferências do sistema/app (reinicie o app após mudar idioma), textos longos, leitores de tela e indicador no aviso; verificar 380×720 e tela pequena.
- Mover o .app para outra pasta/Mac sem a pasta .build: traduções e descrição de Rede Local continuam disponíveis.
- Porta ocupada não mata outro processo; tentar novamente funciona após liberar a porta.
- Iniciar/parar várias vezes; conexão/desconexão do celular atualiza o painel.
- Mouse, teclado, atalhos, mídia e volume continuam funcionando pelo celular.
- IP/cópia em Wi-Fi, múltiplas interfaces e troca de rede; descoberta mDNS/manual.
- **Sair** pelo menu direito, pelo painel/⌘Q, fechamento do painel e encerramento forçado da UI: fechar painel não para servidor; sair/EOF para o helper. Não deve sobrar listener na porta.
- Build Intel/Apple Silicon, app instalado em `/Applications`, Firewall e Rede Local.

Consulte [VALIDACAO.md](VALIDACAO.md) para distinguir implementação de validação real. Não há teste de runtime macOS no Linux.


## Aplicar este patch e testar a instalação correta

Este patch é incremental sobre `e059be5` (correção de Alias). Não há confirmação visual do último DMG; esta entrega não altera nem certifica seu layout. Na raiz:

```bash
git am ~/Downloads/remote-mouse-macos-accessibility-fix.patch
macos/scripts/test.sh
macos/scripts/build-app.sh arm64
```

Encerre o Remote Mouse antigo usando Sair antes de substituir o app. Pelo Finder, preserve/mova a cópia antiga de `/Applications/Remote Mouse.app` para uma pasta de arquivo, depois copie **o bundle inteiro** `macos/dist/arm64/Remote Mouse.app` para `/Applications`. Abra essa cópia pelo Finder, não seu executável interno/Terminal e não de um DMG montado. Não copie apenas um executável ou traduções sobre uma assinatura existente. Autorize essa instalação; a consulta silenciosa deve liberar o painel sem iniciar servidor. Depois teste Iniciar, revogar, conceder novamente e relançar. Se não liberar, copie o diagnóstico do próprio painel e pare antes de tentar outra correção especulativa. Regerar DMG é opcional para este teste; siga a seção de arquivamento se precisar dele.

### Se os testes pararam em caminhos `/var` versus `/private/var`

A correção incremental sobre `e5aff0f` é `remote-mouse-macos-paths-fix.patch`. Os erros recebidos eram fixtures misturando caminhos canônicos com mocks/expectativas crus; `attached_paths` real já normalizava seu resultado. Agora produção e testes comparam identidade real (samefile) ou grafia canônica quando o arquivo não existe mais, sem remover `/private` ou afrouxar ownership. Fixtures usam symlinks reais e recusam outra imagem/montagem.

```bash
git am ~/Downloads/remote-mouse-macos-paths-fix.patch
macos/scripts/test.sh && macos/scripts/build-app.sh arm64
```

A saída `DMG gerado .../tmp.../result.dmg` nos testes é simulada; não confirma que exista um DMG final novo. Continue o teste do bundle instalado descrito acima. Nenhum rebuild de DMG é necessário para verificar aviso opaco, permissão e clique direito.

## Como enviar os commits ao GitHub

`git am` **já cria um commit para cada patch**; não há necessidade de `git add .` nem de recommitar os mesmos arquivos como outra pessoa. A branch deste checkout é `feat/macos-menubar`; o remote existente `origin` aponta para `https://github.com/daviixs/wifi-mouse.git`. Não foi alterado nem houve push/fetch nesta entrega. No seu checkout confira, antes de enviar:

```bash
git status --short
git log -12 --oneline
git branch --show-current
git remote -v
git diff --cached --stat
# Somente depois de conferir branch, destino e commits:
git push -u origin "$(git branch --show-current)"
```

Não inclua builds, credenciais, patches baixados ou `docs/superpowers/plans/`. `.gitignore` cobre `rust-agent/target`, `macos/dist`, `.build/.swiftpm`, segredos comuns e planos locais. Ignore não remove arquivos já rastreados: confira `git ls-files docs/superpowers/plans` (vazio nesta base) e `git status --short`. Uma spec antiga em `docs/superpowers/specs` já era rastreada; não foi removida/alterada. Se houver mudanças próprias além dos patches, revise e adicione somente caminhos explícitos desejados; não use `git add .`. Se o push for recusado por divergência, pare e examine o histórico — não use force-push/reset.
