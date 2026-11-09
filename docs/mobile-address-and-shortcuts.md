# Endereço, teclado e atalhos — entrega incremental mobile

Base: a cadeia macOS até `da168ab` (startup), sem merge/rebase de outros trabalhos.
APK: Remote Mouse **1.0.1**, Android versionCode **20261108**; pacote
`com.davixavier.remotemouse`. Variante release, assinatura de desenvolvimento do
projeto (não é uma assinatura de publicação Play Store).

## Causas verificadas no código e alterações

- O campo usava `decimal-pad`, limite de 15 caracteres e removia tudo que não
  fosse dígito/ponto: impossibilitava `:`. Agora usa teclado URL, sem capitalização
  ou autocorreção, e aceita IPv4/nome DNS com porta opcional (1–65535). Porta
  padrão: 8765. `ws://host:porta/` colado também é aceito por compatibilidade.
  Caminhos, credenciais, query e IPv6 não fazem parte deste contrato.
- A descoberta agora respeita sua porta anunciada; o último computador preserva
  porta customizada, mantendo leitura do formato antigo sem porta.
- O endereço exibido/copiado pelo painel Mac é `host:porta`. O transporte continua
  sendo `ws://host:porta`; não se remove o esquema da conexão WebSocket.
- No Android o KeyboardAvoidingView antes não tinha comportamento. Agora padding
  em ambas as plataformas, configuração Expo resize e rolagem até a geometria
  medida do campo focado (não uma altura de teclado ou scrollToEnd presumidos).
- GlassCard deixa de combinar contêiner/gradiente translúcido e passa a ter uma
  única superfície opaca; os tokens de superfícies internas são coerentes e
  escuros. Não muda botões pressionados/estados de foco. O GlassCard de `main`
  e `feat/macos-menubar` remoto foi apenas lido e correspondia à base local.
  O trabalho Bevel mencionado em outro worktree não foi importado nem alterado;
  não se afirma ter reproduzido essa composição visual não mesclada.
- O agente já distingue `meta` como Command no macOS: não existe conversão
  indiscriminada de Alt em Cmd. O cliente antes mostrava simultaneamente grupos
  Windows/Mac. Agora escolhe pelo OS do **destino**, via mDNS e, no agente novo,
  mensagem opcional `server.info` v1. Cmd+W fecha janela, Cmd+Q encerra app;
  Windows mantém Alt+F4. Linux preserva Ctrl/Alt usuais sem prometer Win+D.
  Um agente antigo/manual sem OS exige escolha explícita do sistema no painel de
  atalhos. A escolha não vaza entre conexões. Comandos v1 permanecem inalterados.

## Instalação / rebuild no Mac

Aplique este patch depois dos anteriores, na branch existente (git am já cria o
commit; não é preciso git add .):

```sh
git am ~/Downloads/remote-mouse-mobile-fixes.patch
macos/scripts/test.sh && macos/scripts/build-app.sh arm64
```

Encerre a versão antiga pelo menu do ícone antes de substituir o bundle inteiro
Remote Mouse.app gerado pelo build em /Applications. Abra a cópia de
/Applications, não uma cópia no DMG/Downloads. O rebuild inclui tanto a cópia sem
prefixo quanto o greeting do helper; atualizar só o APK mantém fallback mDNS ou
seleção manual com agentes antigos. Não é necessário gerar DMG nesta etapa.

Na entrega original a Acessibilidade aguardava diagnóstico. Posteriormente o
usuário confirmou helper autorizado e servidor online. A política de autorização
não foi alterada; nenhuma entrega finge grant ou contorna a permissão real.

## Validação

Executáveis no Linux: lint, TypeScript, testes Node reais de parsing/porta,
armazenamento e seleção/serialização de atalhos; socket fake para mensagens e
socket antigo; funções reais de geometria; asserts estruturais de configuração
(não renderização); testes Python portáveis dos recursos/DMG; Rust cargo check
com testes para aarch64-apple-darwin; parse gramatical Swift (não compilação).
O XCTest de formato de endereço foi adicionado, mas só executa no Mac.

O APK é gerado de prebuild Expo limpo (sem editar nativos à mão), JDK17 e
assembleRelease limitado a arm64-v8a/armeabi-v7a. Conferir versão, ABIs, manifest,
assinatura e hash no artefato novo, nunca reutilizar o APK anterior.

Checklist **ainda a executar nos dispositivos**, sem alegar validação nativa:

1. Android pequeno: abrir teclado URL, digitar `192.168.1.10:8765`, confirmar
   campo e cursor visíveis; girar/fechar/reabrir teclado e colar host DNS/porta.
2. Tocar fora/recolher teclado, validar conexão, cancelar/reconectar e restaurar
   último computador com porta customizada; verificar superfícies/contraste.
3. Mac autorizado: atalhos só Mac, Cmd+W em janela descartável e Cmd+Q em app de
   teste; não testar encerrar trabalho não salvo. Windows: Alt+F4 preservado.
4. Agente antigo sem greeting: mDNS ou escolha manual correta; trocar conexão
   não deve herdar uma escolha manual anterior. Revogação TCC continua bloqueada.

Referências consultadas nesta entrega: Expo57 config/app e guia keyboard-handling
(https://docs.expo.dev/versions/v57.0.0/config/app/ e
https://docs.expo.dev/guides/keyboard-handling/).
