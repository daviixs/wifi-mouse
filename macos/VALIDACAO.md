# Estado da validação desta entrega

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
