# Referência independente: dmgbuild 1.6.7

`dmgbuild-1.6.7-reference.dsstore` foi produzido pelo **writer original, sem alterações**, da distribuição PyPI dmgbuild 1.6.7. O JSON registra hashes do wheel, core.py e fixture. Licença MIT do upstream em `../vendor/dmgbuild-LICENSE.txt`.

É uma fixture do formato escrito pelo upstream, **não uma captura de Finder/macOS**. Na geração, apenas hdiutil/processos e a coleta de identidade nativa Alias foram substituídos por fixtures explícitas; os codecs e o writer do upstream executaram de verdade. Isso verifica códigos/chaves independentemente das constantes do nosso writer. O alias conserva o tag POSIX de mountpoint `/Volumes/Reference`.

O teste compara bwsp/icvp/icvl, prova `backgroundImageAlias` (não `backgroundImageAliasData`), ausência dos códigos legados BKGD/pict no writer moderno e preservação de bytes do alias. Não valida renderização nem ABI CoreFoundation.

Para reproduzir, obtenha o wheel oficial (SHA fixado no gerador) e execute `python3 macos/scripts/fixtures/generate_upstream_layout.py /caminho/dmgbuild-1.6.7-py3-none-any.whl`. Não é preciso instalá-lo. A geração não usa rede e intercepta todos os processos; não faz parte do build nem dos testes normais. Os testes normais usam a fixture incluída e funcionam offline.
