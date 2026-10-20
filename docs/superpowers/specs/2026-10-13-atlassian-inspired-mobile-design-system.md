# Design: sistema visual mobile inspirado na Atlassian

**Data:** 2026-10-13  
**Status:** aprovada e aplicada; direção visual refinada com referência Bevel em 2026-10-20
**Projeto:** Remote Mouse, Expo SDK 57 e React Native 0.86

## Objetivo

Substituir o visual escuro e verde-lima atual por uma interface clara, consistente e própria do Remote Mouse. Usar a paleta enviada pelo usuário junto com princípios semânticos do Atlassian Design System para reduzir decisões visuais ad hoc e remover elementos decorativos identificados pelo usuário.

## Leitura do produto

Aplicativo mobile para controlar um computador pela rede local. A tela de conexão coleta o endereço IPv4 do agente. A tela principal oferece uma superfície de touchpad, cliques, entrada de teclado e ajuste de sensibilidade. O gesto de touchpad é a ação central e deve receber a maior área útil e contraste visual.

## Direção aprovada

- Tema claro com tokens semânticos inspirados na Atlassian e acabamento de superfícies inspirado nas referências do app Bevel enviadas pelo usuário.
- Fundo frio claro, cartões brancos com cantos amplos e sombras suaves; profundidade reservada a painéis e controles flutuantes.
- Usar a referência Bevel como linguagem de acabamento, sem importar métricas de saúde, conteúdo ou padrões que não pertencem ao controle remoto.
- Componentes implementados com React Native nativo. Atlaskit e os componentes web Atlassian não serão instalados no app mobile.
- Design tokens com nomes semânticos para cores e espaçamento. A inspiração não implica reprodução literal de Jira ou outro produto Atlassian.
- Manter rotas, texto e comportamento existentes, exceto remoções explicitamente pedidas.
- Não adicionar dependências de interface.

## Paleta

Paleta de referência: `#086288`, `#4D8DBA`, `#97D7FF`, `#FFEFC4`.

Papéis definidos:

| Papel | Valor | Uso |
| --- | --- | --- |
| Ação primária | `#086288` | Botão principal, seleção e foco |
| Ação secundária | `#4D8DBA` | Controles secundários e elementos de apoio |
| Destaque frio | `#97D7FF` | Realce suave e superfícies informativas |
| Destaque quente | `#FFEFC4` | Área de apoio pontual, sem ocupar a tela inteira |
| Fundo | `#F3F5F8` | Fundo global claro, neutro frio |
| Superfície | `#FFFFFF` | Controles e painéis |
| Texto primário | `#172B36` | Títulos e conteúdo principal |
| Texto secundário | `#445968` | Descrições e metadados necessários |
| Borda | `#D9E3E8` | Separadores e contornos de controles |
| Sucesso | `#216E4E` | Estado conectado |
| Erro | `#AE2E24` | Erro de conexão e validação |

Os valores neutros e semânticos são uma proposta de implementação para apoiar a paleta. Validar contraste em texto, botões, foco e estados antes de concluir. Se a validação exigir ajuste, manter os quatro valores da paleta para os mesmos papéis de marca e ajustar apenas os neutros ou valores semânticos.

## Tokens e limites arquiteturais

Criar `src/theme/tokens.ts` como fonte única para cores, escalas de espaçamento/raio e sombras compartilhadas. Migrar o uso de `COLORS` e cores literais de interface para papéis semânticos, sem mover constantes de protocolo ou configuração de rede para o tema. Usar espaçamentos em passos de 4 e 8 pontos e documentar uma escala curta de raios para botões, campos e painéis.

Escopo visual:

- `src/app/_layout.tsx`: fundo de navegação e barra de status alinhados ao tema claro.
- `src/app/index.tsx`: marca, conexão IPv4, validação, estado de carregamento e texto de apoio.
- `src/app/touchpad.tsx`: cabeçalho, superfície de gesto, botões e dicas.
- Componentes em `src/components/`: estado de conexão, touchpad, botões, sensibilidade, teclado e aviso de primeira execução.
- `src/constants/config.ts`: remover apenas cores visuais caso tenham sido substituídas pelos tokens; manter `APP_CONFIG.agentPort` e as configurações de conexão.
- `app.json`: alinhar a cor de inicialização e superfícies nativas configuradas com a nova identidade, sem alterar identificadores, permissões ou rotas.

Manter a biblioteca de ícones que já existe no projeto, sem adicionar outra família ou dependência.

## Alterações aprovadas na tela de conexão

Remover:

- O rótulo `CONTROLE REMOTO · WI-FI`.
- O ícone de computador no título do painel de conexão.
- A linha visível `Porta do agente: 8765`.
- O rodapé `FEITO PARA SUA REDE LOCAL · PRIVADO POR DESIGN`.

Manter o ícone Wi-Fi ao lado do nome `REMOTE MOUSE` no topo. Manter nome, campo de IPv4, explicação de conexão e botão de conectar. A porta continua configurada internamente para a conexão, apenas deixa de ser exibida.

## Comportamento e estados

Não alterar Expo Router, protocolo WebSocket, stores, eventos de conexão, persistência de sensibilidade ou gestos. Preservar toque curto para clique esquerdo, toque longo para clique direito e dois dedos para rolagem. Aplicar os tokens visuais aos estados de toque, seleção, desabilitado e foco.

Preservar validação IPv4 e mensagem de erro junto ao campo. Preservar estado de conexão em andamento no botão e estados conectado, desconectado, reconectando e erro no touchpad. Preservar o aviso de primeira execução e os controles de teclado e sensibilidade.

## Acessibilidade e plataforma

- Verificar contraste de texto e controles contra superfícies em iOS e Android.
- Evitar depender apenas de cor para comunicar conexão: manter texto e ícone/indicador com rótulo acessível.
- Manter áreas de toque confortáveis e comportamento de gesto existente.
- Conferir a barra de status, tela de abertura e cor configurada para o ícone adaptativo Android.
- Antes de mudar APIs Expo ou React Native, consultar a documentação versionada do Expo SDK 57 e documentação específica da API aplicável.

## Critérios de aceite

1. As duas telas e todos os componentes compartilhados usam a nova fonte de tokens em vez de cores literais dispersas.
2. A interface usa a paleta aprovada com neutros auxiliares legíveis.
3. Os quatro itens listados para remoção não aparecem mais na interface.
4. O ícone Wi-Fi e o nome `REMOTE MOUSE` permanecem na barra superior da tela de conexão.
5. A porta do agente continua funcionando na conexão, apesar de não ser mostrada.
6. Rotas, conexão, teclado, sensibilidade e gestos continuam funcionando como antes.
7. Tela de inicialização e barra de status não mostram o tema antigo.
8. `npx expo lint` e `npx tsc --noEmit` terminam sem erros.

## Fora do escopo

- Alterar rotas, protocolo, textos não citados, lógica de conexão ou persistência.
- Adicionar Atlaskit, biblioteca de componentes ou biblioteca de ícones.
- Redesenhar o ícone ou logotipo do app.
- Implementar sincronização de preferências ou novo fluxo de configuração.

## Referências

- [Atlassian Design System: tokens](https://atlassian.design/foundations/design-tokens)
- [Atlassian Design System: espaçamento](https://atlassian.design/foundations/spacing)
- [Atlassian Design System: desenvolvimento](https://atlassian.design/get-started/develop)
- [Paleta Color Hunt fornecida pelo usuário](https://colorhunt.co/palette/0862884d8dba97d7ffffefc4)
- [Documentação Expo SDK 57](https://docs.expo.dev/versions/v57.0.0/)
- [Índice Expo para agentes](https://docs.expo.dev/llms.txt)
