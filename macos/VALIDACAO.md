# Estado da validação desta entrega

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
