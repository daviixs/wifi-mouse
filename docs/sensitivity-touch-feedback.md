# Sensibilidade, feedback contínuo e endpoint literal

Entrega incremental após a cadeia mobile `6ea6c83`, sem alterar Rust, protocolo,
configuração Expo, dependências ou nativos gerados. Nenhum APK/DMG foi gerado.

## Causas e comportamento

- Sensibilidade era um multiplicador real: padrão **1×**, mínimo 0,5×, máximo
  3×, passo 0,1. Agora o padrão é **3×** (exatamente o antigo valor 3), com máximo
  **6×** para permitir aumentar além do novo padrão. Não se renumera a escala nem
  se adiciona aceleração. Rolagem continua independente desse ganho.
- A chave de preferência não muda e não há migração que escreva 3 sobre uma
  escolha explícita. Valores já salvos, inclusive 1×, continuam iguais. Apenas
  ausência/valor inválido/falha de leitura usa 3×; quem salvou outro valor pode
  ajustar o slider manualmente. Os dois controles já usam os limites compartilhados
  e mostram o multiplicador, não um nível arbitrário. Armazenamento vazio inválido
  também passa a usar o padrão, em vez de virar 0 e ser limitado a 0,5×.
- O brilho **não tinha um timer de expiração**: longPress, move e scroll escreviam
  no mesmo `pressed`. Em Gesture.Race, a ativação de um reconhecedor cancela os
  demais; seus finalizers zeravam o estado mesmo com pan ativo. Agora cada um
  (incluindo tap) possui um bit de feedback: finalizar um perdedor não apaga o
  vencedor. A superfície ativa é opaca e realmente mais clara. Não muda limiares,
  competição, cliques, long-press ou deltas dos gestos.
- END/FAILED/CANCELLED limpam o proprietário; disable/desconexão/unmount limpam
  todos, param o frame callback e descartam movimento ainda pendente. O componente
  só habilita gestos conectado. Callbacks RN já agendados consultam um guard de
  lifecycle, não acessam refs React em worklets. O contador/máscara roda no UI
  thread como worklet e não depende de timers ou de atualizações React por frame.
- No Mac, `Text("\(ip):\(model.port)")` criava LocalizedStringKey e interpolava a
  porta numérica com agrupamento local (ex.: 8,765 em inglês). Agora usa
  `Text(verbatim:)` com o mesmo String formatter cru já utilizado pela cópia.
  Resultado: `192.168.24.45:8765` em qualquer idioma; IP/porta não são quantidades
  traduzíveis. As traduções pt-BR/en/es e o WebSocket interno ficam intactos.

## Validação e limites

- Lint, TypeScript, npm test e test:motion: 56 testes Node. Ganho/persistência e
  transições da máscara executam funções reais. O teste do guard executa o hook
  real com primitivas React **mockadas**; wiring de lifecycle/cor é estrutural,
  não uma simulação do motor RNGH nativo.
- Babel real do preset Expo57 transforma componente e helper em worklets. Isso
  verifica a transformação/serialização de código, não execução Hermes/UI nativa.
- Recursos nas três línguas e 52 testes Python portáveis passam; os testes de
  montagem usam hdiutil mockado, não produzem um DMG real. Sintaxe shell e parse
  gramatical dos 10 arquivos Swift passam, sem alegar compilação Mac.
- XCTest acrescentado para String sem grouping sob en_US/pt_BR/es_ES e guard
  estrutural de Text(verbatim:). XCTest e renderização SwiftUI **não executados**
  no Linux. Rust não mudou, portanto cargo não foi repetido.

O usuário confirmou helper autorizado e servidor online; não se modifica a
política de Acessibilidade nem se pede novamente o diagnóstico já superado.

## Aplicação e teste no aparelho

```sh
git am ~/Downloads/remote-mouse-sensitivity-touchpad.patch
macos/scripts/test.sh && macos/scripts/build-app.sh arm64
```

Encerrar a versão antiga antes de substituir o bundle inteiro
`macos/dist/arm64/Remote Mouse.app` em `/Applications`, e abrir essa cópia.
Não precisa gerar DMG. Confirmar endereço sem agrupamento nos três idiomas.

A parte mobile só aparecerá em uma próxima build/reinstalação do Android:
aplicar o patch **não altera o APK já instalado**. A pipeline Expo/Gradle da
entrega anterior continua válida; preservar nativos existentes antes de qualquer
prebuild --clean. A próxima geração de APK é uma etapa separada, quando solicitada.
No aparelho, testar toque, arraste longo, rolagem de dois dedos, cancelamento,
desconexão e reconexão: realce deve durar toda a interação e apagar ao terminar.
Conferir primeiro lançamento sem preferência em 3×, restauração de preferência
explícita diferente de 3× e aumento acima de 3×.

Referências: Expo57 Gesture Handler (~2.32.0) e Reanimated (4.5.1), iguais aos
instalados; RNGH 2.x states-events e gesture-composition documentam Race/cancel e
onBegin/onFinalize. APIs de SwiftUI Text(verbatim:) são públicas no macOS13.
