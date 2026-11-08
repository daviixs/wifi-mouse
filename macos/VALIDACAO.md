# Estado da validação desta entrega

## Resolução canônica e identidade observável (base 460dc17)

**Evidência recebida:** após converter/remontar, CoreFoundation retornou `/Volumes/Remote Mouse/.background/background.png`, não o fundo de `mount-ro`; `stale=true`. O guard já comparava com `samefile`, portanto não era só divergência textual: a mensagem específica mostra que retornou identidade divergente naquele instante, não um erro stat de arquivo ausente. O log não registrava os números de device/inode nem os caminhos canônicos. Não demonstra cache, outra imagem montada, nem o motivo do fallback. Não há fundamento para culpar uma montagem deixada pelo usuário.

**Divergência corrigida:** o pipeline forçava dois mountpoints privados, diferente de `hdiutil attach` normal no dmgbuild. Agora cria um nome interno exclusivo `Remote Mouse <12 hex>` (25 bytes, campo Alias v2 suporta 27), deixa hdiutil criar `/Volumes/<nome>` e exige esse mesmo caminho na escrita e na montagem readonly, sem rename do volume entre fases. O sufixo fica visível no título do volume; nomes do app/DMG e layout/arte não mudam. O caminho já ocupado ou sufixado é rejeitado sem remover entradas em /Volumes ou desmontar imagens alheias.

**Não é relaxamento:** Alias.for_file permanece intacto, destino relativo, datas/CNIDs e comparação nativa contra arquivo vivo continuam obrigatórios. O resolvedor não ganha UI, montagem de volumes, base relativa especulativa nem fallback por hash. Agora a comparação device/inode (mesma regra de samefile) mostra existência, path canônico e os IDs de ambos os arquivos. Symlink canônico equivalente é aceito, arquivo de conteúdo idêntico com outro inode é recusado; stale é apenas informação. Falhas de layout incluem só entidades hdiutil do arquivo de imagem desta execução, não a tabela de discos alheios. Os IDs de device são comparados dentro de cada fase, nunca entre RW e RO.

**Testado Linux:** 17 testes metadata (codecs binários/fixture upstream reais, identidade nativa/resolvedor com fixture declarada), 14 testes de orquestração com mocks de ferramentas Apple, 4 testes CoreFoundation com stubs, 12 resources, checker 45×3, sintaxe Python/shell e diff. Lint, typecheck e 39 testes motion/services também passam. Casos novos: mesmo mount canônico RW/RO, nome exclusivo/campo Alias, recusa de caminho ocupado/sufixado, diagnósticos limitados à imagem própria, identidade de arquivos reais/symlink/ausente, stale=true com identidade correta aceito. Nenhum comando Mac foi executado.

**Pendente:** resolução CoreFoundation/mac_alias nativos, hdiutil e renderização Finder no Mac. Corrigiu-se uma divergência concreta do fluxo upstream, não se provou a causa interna do resolvedor nem o resultado visual. Aprovação nativa exige build com identidade exata nas duas fases, metadata/PNG/digest íntegros e depois abertura visual com ornamentos/texto e centros alinhados. Se falhar, enviar o diagnóstico stat/montagens desta imagem; não iniciar uma sequência de compensações. App/Rust/arte não alterados.

As seções abaixo registram etapas anteriores.

## Fundo: Alias upstream intacto e resolução nativa (base 4bd2182)

O DMG anterior foi produzido no Mac, com arquivo de layout e PNG íntegros, mas a UI ficou branca. O log/captura não demonstra a causa exclusiva da renderização. A arte PNG desta box foi inspecionada e contém os ornamentos/texto aprovados.

**Defeito verificado no código:** o writer removia `volume.posix_path` e `disk_image_alias` do Alias nativo, ao contrário do dmgbuild, e os testes anteriores exigiam essa remoção. Isso não era equivalência integral com o upstream. Corrigido para gravar os bytes originais de `Alias.for_file(...).to_bytes()` sem sanitização. Destino relativo do arquivo é preservado; a dica de mountpoint do volume não é o destino do fundo.

**Formato agora conferido contra origem independente:** fixture binária produzida pelo writer sem alterações do wheel oficial dmgbuild 1.6.7, com hashes/proveniência e gerador reproduzível. Apenas comandos Apple e identidade nativa têm fixtures; não é uma captura de Finder. Confirma códigos bwsp/icvp/icvl/vSrn, `backgroundImageAlias` (não AliasData), backgroundType=2 e ShowStatusBar=false. Não se adicionaram códigos legados sem evidência.

**Gate novo:** além de identidade/PNG/sha, o build pede ao CoreFoundation resolver o registro Alias em cada montagem, sem UI/montagem de outros volumes, com processo separado e timeout 20s. `samefile` deve identificar o fundo da montagem atual. Alias parseável mas resolvendo para outra cópia é rejeitado. Não se considera leitura dos próprios bytes prova de resolução/renderização.

Ocultos: orientação ⌘⇧. opcional do usuário. Nenhum defaults global ou diretório de sistema é modificado/apagado. Statusbar usa a mesma chave upstream; não se promete corrigir UI/cache apenas pelos metadados. Orientação de teste exige ejetar manualmente a imagem antiga e arquivar o DMG existente antes da reconstrução.

Executado Linux: **15 testes metadata** (incluindo referência upstream e preservação de bytes), **4 testes do fluxo CoreFoundation com stubs** (não ABI nativa), **10 testes de orquestração com mocks**, **12 resources**, checker **45×3**, sintaxe Python/shell e diff. **Não executado:** resolução CoreFoundation real, Finder ou novo DMG no Mac; a correção de formato é comprovada, o resultado visual continua pendente de uma verificação nativa. App/Rust/arte não alterados. Também passaram lint, typecheck e os **39 testes motion/services**.

As seções seguintes são históricas; a remoção das dicas de Alias nelas descrita foi corrigida acima.

## Layout binário: substituição pontual do estágio Finder (base df98a7d)

**Evidência real recebida:** bounds invariáveis, y240 após set e y253 para ambos os ícones após reopen; seletores de pasta/janela concordam. Assim, contexto de seletor não explicou a falha. `background=0` ocorreu antes de reopen, mas o código anterior escondia exceção de leitura/coerção e comparação negativa de alias no mesmo valor. Causa exata desse zero e origem nativa dos 13 pontos **não demonstradas**; não se atribui a título/scroll/label sem prova.

**Estratégia:** parar de variar AppleScript/compensações. Substituído apenas o estágio de escrita/leitura do layout pelo formato e codecs do dmgbuild. ds_store 1.3.1/mac_alias 2.2.2 vêm em wheels oficiais Python puros, com SHA-256 e MIT; sem instalação/rede durante build e compatíveis com o Python 3.9 de CLT. Pipeline hdiutil/cópia/assinatura/limpeza preservado. Script AppleScript e parser de snapshots removidos porque não fazem mais parte do build.

Modelo: retângulo nominal 640×480 nos metadados (não bounds AppleScript +22), Iloc (170,240)/(470,240), icon72/text12, scroll/grid offset zero, grid spacing 80 dentro do limite documentado, sem arrange/barras/sidebar. Alias criado com identidade nativa do arquivo e volume; destino estritamente relativo `.background/background.png`, sem dica de mountpoint ou imagem do host. Verificação na montagem final somente leitura exige todos os valores, identidade real do Alias, PNG byte a byte e SHA-256 idêntico de `.DS_Store`. Não se relaxou posição para aceitar +13.

Executado em Linux:

- **11 testes de metadados binários reais**: roundtrip codecs/arquivos, centros/conteúdo, deslocamento um ponto e +13 rejeitados, opções estritas, erros agregados, Alias malformado/volume/CNID/caminho/hint incorretos, falta de registro, arquivo corrupto, symlink, relocalização e leitura sem modificar bytes/mtime. Identidade nativa usa fixture explícita; não é uma integração Apple.
- **10 testes de orquestração/safety**, com ferramentas Apple simuladas, incluindo não publicação se o hash da montagem readonly mudar e limpeza segura.
- **12 testes resources**, checker **45×3 idiomas**, sintaxe Python/shell e diff: passaram.
- `npm run lint`, `npm run typecheck` e `npm run test:motion` (**39 testes**): passaram.

**Não executado:** Alias.for_file no macOS, hdiutil/DMG real, assinatura nativa e renderização do Finder. Não se afirma causa nativa definitivamente provada nem build macOS certificado. O novo caminho evita as duas operações AppleScript problemáticas; seu resultado visual ainda deve ser confirmado uma vez no Mac. Não houve comandos no Mac, CloudAgent, clone, push ou PR, nem alterações de app/Rust/assets.

As seções abaixo registram entregas históricas, supersedidas no estágio de layout por esta implementação.

## Correção/diagnóstico incremental: posições dos ícones

Base incremental: último bounds-fix `786c0f0`. O log nativo fornecido confirma bounds `{120,120,760,622}` após definir/reabrir; **não registra posições dos ícones**. Portanto não existe evidência suficiente para atribuir definitivamente a falha a coerção, seletor de pasta/janela, canvas, ordenação ou gravação de `.DS_Store`.

Constatado no código: posições eram definidas antes dos bounds finais, pelo seletor da pasta; a comparação de lista no Finder não exibia o valor e abortava no primeiro erro. `position` é a propriedade apropriada para ícones em janela, não `desktop position`. A ordem frágil foi corrigida para opções → geometria estável → posições explícitas no `targetWindow`, mantendo pontos/arte/tamanhos. A diferença entre seletores não é tratada como causa provada.

O protocolo v2 retorna snapshots completos após o setter e após reabrir, com ambos os ícones e opções visuais. Python valida valores numéricos estritos e agrega divergências de todas as propriedades em uma mensagem; não se removeu o gate de posição nem se introduziu tolerância. Foram adicionadas verificações de labels/info. O seletor de pasta antigo é apenas diagnóstico opcional, fora do critério de estabilidade. Continuidade de `.DS_Store`, montagem somente leitura, assinaturas, publicação sem sobrescrever e limpeza segura preservada. Se a desmontagem também falhar, o erro de limpeza preserva agora a mensagem original do layout, em vez de ocultá-la.

Executado na box Linux:

- **25 testes portáveis de DMG passaram**: validadores reais, coordenadas e opções exatas, múltiplas divergências/fases simultâneas, protocolo incompleto/duplicado rejeitado, seletor de pasta não substitui leitura da janela, metadados reais em temporários, guardas de fluxo/limpeza. Testes de orquestração Apple têm mocks; testes de ordem no source são estáticos.
- **12 testes de resources** e checker de **45 chaves × 3 idiomas** passaram.
- Sintaxe shell, bytecode Python e `git diff --check`: passaram.
- `npm run lint`, `npm run typecheck` e `npm run test:motion`: passaram (**39 testes**).

**Não executado:** compilação AppleScript, Finder, escrita/leitura nativa de `.DS_Store`, build/remontagem de DMG ou comandos no Mac. Não se afirma que o problema nativo esteja reproduzido/corrigido definitivamente. Se persistir, o novo erro captura as coordenadas/opções específicas necessárias, em vez de provocar outra tentativa especulativa. App Swift/Rust/mobile e assets não foram alterados; basta reconstruir o DMG com o `.app` existente.

## Correção/diagnóstico incremental: bounds do Finder

Evidência do código: a verificação anterior comparava o retângulo inteiro e chamava qualquer diferença de “tamanho inicial não persistido”, sem fase nem coordenadas. Isso confunde reposicionamento com redimensionamento. Não há evidência dos bounds reais do Mac no erro recebido, logo não se atribui a falha definitivamente a reposicionamento, título/chrome ou `.DS_Store`.

Implementado: coordenadas primitivas após setter/reabertura; validação numérica separada da origem, exigindo dimensões exatas 640×502 sem tolerância; fase configure vs verify e ambos os retângulos no erro. Pedido de bounds passa a ocorrer após as opções de visualização; removido o encolhimento intermediário de dez pontos; leituras estáveis limitadas; metadados não vazios com size/mtime estáveis antes da desmontagem. A imagem 640×480 e as posições dos ícones continuam intactas. Não foi aplicada compensação presumida para a decoração do Finder.

Validação Linux: **18 testes de DMG passaram**. Novos testes executam de verdade o parser/validador de coordenadas (translação/múltiplas telas permitidas, tamanho um ponto incorreto rejeitado, delta de 22 pontos rejeitado e reportado, fases diferentes, protocolo inválido) e escrita/stat de arquivos temporários para estabilidade/timeout de metadados. Testes de fluxo com hdiutil/osascript continuam com mocks e não provam Finder. Também passaram os 12 testes de resources, checker de 45 chaves × 3 idiomas, sintaxe shell e Python.

**Não executado:** compilação/execução AppleScript, Finder real, leitura real de `.DS_Store`, geração/remontagem de DMG no macOS. Não se promete que isso resolva o caso do Mac se a dimensão realmente estiver diferente: nesse caso o patch foi desenhado para parar com o dado mínimo necessário (fase, pedido, após setter, após reabertura). Apenas um novo log real permite decidir se a suposição anterior de decoração era válida. Não repetidas suítes mobile/Rust porque nenhum código do app/agente foi alterado.


## Correção incremental: falso “tradução ausente: pt-BR”

Origem rastreada em `build-app.sh`: verificação física exclusivamente na raiz do `.bundle`, depois de `swift build`. A caixa já era tratada (`pt-br` e `pt-BR`). Uma fixture com o layout SwiftBuild macOS documentado (`Contents/Resources/pt-br.lproj/Localizable.strings`) reproduziu o falso negativo do guard antigo, enquanto o novo resolvedor encontrou e validou as 45 chaves. As fontes pt-BR/en/es e o manifest `.process`/`defaultLocalization` estão presentes/corretos.

O backend SwiftPM native pode gerar bundle flat, e SwiftBuild usa layout macOS aninhado conforme testes funcionais oficiais citados no README. Não foi lido o bundle real do Mac do proprietário; não se afirma uma observação remota do backend/caminho dele. O defeito concreto do guard foi reproduzido localmente com os dois formatos válidos.

Correção: resolvedor/validador compartilhado para build, source validator e smoke; validação integral contra as fontes antes/depois da cópia; tabelas texto/compiladas e nomes de idioma normalizados; erros reais não recebem fallback inglês. Runtime Swift usa `Bundle.resourceURL` e recebeu teste XCTest com bundles flat/aninhado.

Validação Linux: 12 testes novos de fixtures passaram (incluindo chamada simulada ao plutil para UTF-16); 9 testes portáveis de DMG passaram; checker das 45 chaves × 3 idiomas passou; sintaxe Python e shell passou. Testes nativos Swift/Foundation foram escritos mas não executados nesta box sem Swift/SDK macOS. Nenhum build `.app`/DMG nem runtime de Finder/TCC foi executado no Mac. Também passaram `npm run lint`, `npm run typecheck`, `npm test` e `npm run test:motion` (39 testes por execução da suíte), além de `cargo check --locked --all-targets --target aarch64-apple-darwin` no código Rust real. O check Rust é metadata/typecheck sem link/execução Apple.


## Incremento: fundo branco e tamanho inicial do DMG

- Asset aprovado copiado byte a byte (`background-source.jpg`, dimensões reais 1152×864, SHA256 `7ff8e3987383ebfe6a363c767c522350b02281526e8d583cd7e08ca5023e8c26`). PNG 640×480 gerado e decodificado/verificado com Pillow na box; Pillow não é dependência do build no Mac.
- Layout implementado por Finder/AppleScript, imagem gravável privada, `.DS_Store` nativo, conversão UDZO e verificação em nova montagem somente leitura antes de publicar. Bounds externos 640×502, fundo/área útil nominal 640×480, ícones 72 e nomes 12. Finder continua redimensionável.
- `python3 macos/scripts/test_dmg_layout.py`: **9 testes passaram**, todos portáveis. Testam dimensões, propriedade/escopo de montagens, preservação de DMG anterior, conteúdo visível, fluxo de remontagem/verificação, não publicação em falha de layout, timeout e preservação de temporários se não puder desmontar. Comandos Apple e metadados são simulados nesses testes, não constituem um teste de DMG real.
- `bash -n macos/scripts/*.sh` e compilação sintática Python dos scripts: passaram.
- `python3 macos/scripts/check-resources.py`: passou (45 chaves × 3 idiomas; integração de resources existente preservada).
- Alterações limitadas a assets, scripts de empacotamento/testes e documentação. Não foram repetidas as suítes mobile/Rust desta vez; app SwiftUI, protocolo e agente não mudaram.

**Limitação:** `osascript`/Finder/`hdiutil` não existem nesta box Linux. AppleScript não foi compilado aqui; comportamento nativo, persistência real após remontagem e distribuição, bounds sob diferentes telas/chrome e assinatura final precisam ser validados no Mac. Não foi gerado DMG, não houve automação/comandos no Mac do proprietário, nem alteração das permissões de Automação/Acessibilidade. O script se recusa a publicar quando sua validação nativa falha.


## Incremento: overlay de Acessibilidade e idiomas

Implementado após o fix de ownership `efa5daa`: bloqueio fail-closed até confirmação real do helper, consultas curtas sem servidor, concessão/revogação automáticas, parada do próprio servidor na perda da autorização, CTA de ajustes/Finder e saída sempre acessíveis; pt-BR/en/es automáticos, resources SwiftPM explicitamente copiados para o bundle e `InfoPlist.strings` localizados; rolagem preservada sem indicadores.

Executado nesta box Linux:

- `cargo check --locked --all-targets --target aarch64-apple-darwin`: passou no código real completo e testes, incluindo CoreFoundation/FFI de permissão. É typecheck do target Apple, **não** link/execução macOS.
- `cargo fmt --check`: passou.
- Harness portátil externo: **17 testes passaram**, incluindo modos explícitos de consulta e o teste do bloco real de shutdown do fix anterior. Não testa autorização Apple real.
- `python3 macos/scripts/check-resources.py`: passou; **45 chaves × 3 idiomas**, placeholders, descrições de privacidade, metadados, declaração de cópia do bundle e posição do guard check-only antes de bind/Enigo.
- Sintaxe Python e shell dos scripts: passou.
- `npm run lint`, `npm run typecheck`, `npm test` e `npm run test:motion`: passaram (39 testes em cada execução da suíte).

Novos testes XCTest de idioma/resources e transições do bloqueio foram escritos, mas **não executados** aqui: SwiftUI/AppKit/Swift e SDK macOS não estão disponíveis. Não foi gerado .app/DMG nem testada autorização/TCC/VoiceOver/posicionamento real do aviso. Ver checklist atualizado no README. O smoke test macOS recebeu `--permission-only`, utilizável mesmo quando a permissão ainda está negada, sem servidor/input.

O build deve ser validado no Mac instalado em /Applications: confirmar atribuição TCC ao app/helper, concessão/revogação em execução, timeout e saída, idiomas em cada preferência, bundle movido sem .build e acesso por teclado/leitor de tela. Não houve comandos no Mac do proprietário nem alteração do mobile/ios/android.

## Histórico da primeira entrega

## Implementado

Shell SwiftUI/AppKit de barra de menus, helper Rust empacotado, eventos reais de servidor/WebSocket/permissão, controle por pipe privado, encerramento por EOF, build por arquitetura, `.app`, DMG, documentação de assinatura/notarização e testes.

## Executado na box Linux

- `npm ci --ignore-scripts`: concluído, sem alteração do lockfile. O audit informou 20 vulnerabilidades na árvore existente (1 baixa, 14 moderadas, 5 altas); nenhuma correção automática/upgrade foi aplicado neste escopo.
- `npm run lint`: passou.
- `npm run typecheck`: passou.
- `npm test`: 39 testes passaram.
- `npm run test:motion`: 39 testes passaram (mesma suíte, executada novamente explicitamente).
- `cargo fmt --check --manifest-path rust-agent/Cargo.toml`: passou.
- `cargo test --locked` em `rust-agent/`: **não concluiu a compilação**. A configuração existente do enigo não habilita backend Linux; a dependência rejeita esse target. Isso não foi mascarado habilitando um backend diferente no agente.
- Harness isolado em `/workspace/remote-mouse-portable-tests`: compila diretamente os módulos reais `desktop.rs`, `discovery.rs`, `protocol.rs`, `diagnostics.rs`, sem enigo nem injeção. **15 testes passaram**, incluindo 3 novos testes do controle privado (parser, ordem/EOF, linha excessiva). O harness usa um stub apenas para enumeração de IPs e não valida o entrypoint/servidor completo nem o backend de input.
- `bash -n` nos três scripts shell: passou.
- `Info.plist` lido com `plistlib`: válido, `LSUIElement=true`, porta não definida no plist e permissões de Rede Local/Bonjour declaradas.
- `python3 -m py_compile macos/scripts/smoke-agent.py`: passou.
- Execução dos scripts de app/DMG/teste e smoke em Linux: recusou corretamente com erro explícito de plataforma, antes de gerar artefatos.

## NÃO compilado / NÃO testado aqui

A box é Linux, não tem Swift/SDK macOS, AppKit, SwiftUI, `codesign` nem `hdiutil`. **Não foi produzido `.app` nem DMG e não existe screenshot de aplicativo rodando.** Os testes Swift, os testes completos do agente macOS, o smoke test real e o checklist manual do README precisam rodar em um Mac. Nenhum comando foi executado no computador do Carlos.

Pontos de risco que exigem validação nativa: compilação Swift/FFI Apple, atribuição da permissão de Acessibilidade ao bundle/helper, atualização do estado após mudanças em TCC, Firewall/Rede Local/mDNS, posição/tamanho real do popover, encerramento com celular conectado e validação em Intel/Apple Silicon. Assinatura Developer ID, notarização e distribuição pública continuam pendentes de credenciais/certificados do proprietário.

Entrega pronta para **revisão e aplicação**, não uma release macOS validada.
