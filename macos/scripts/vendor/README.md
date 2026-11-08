# Codecs de metadados do DMG (MIT)

Distribuições oficiais PyPI, sem alterações, incluídas como wheels ZIP de Python puro:

| Distribuição | Versão | SHA-256 |
| --- | --- | --- |
| ds_store | 1.3.1 | fbacbb0bd5193ab3e66e5a47fff63619f15e374ffbec8ae29744251a6c8f05b5 |
| mac_alias | 2.2.2 | 504ab8ac546f35bbd75ad014d6ad977c426660aa721f2cd3acf3dc2f664141bd |

Fontes: https://pypi.org/project/ds-store/1.3.1/ e https://pypi.org/project/mac-alias/2.2.2/ . Wheels obtidos dos links oficiais do JSON PyPI, bytes conferidos contra os hashes publicados. `dmg_metadata.py` reconfere SHA-256 antes de importar por zipimport; não executa pip, não usa rede, não extrai arquivos e não altera Python global no build.

Versões escolhidas são compatíveis com Python >=3.7, evitando exigir upgrade do Python 3.9 fornecido por algumas CLTs. Não se afirma que sejam as versões mais recentes (as versões atuais de ambos exigem Python >=3.10). Licenças MIT originais permanecem dentro dos wheels e foram copiadas para os arquivos LICENSE deste diretório.

Modelo de `bwsp`, `icvp`, `icvl`, `vSrn`, `Iloc` e `backgroundImageAlias` baseado em [dmgbuild/core.py](https://github.com/dmgbuild/dmgbuild/blob/main/src/dmgbuild/core.py), MIT; licença incluída. Não usamos seu pipeline de montagem/desmontagem, nem `-force`, nem copiamos um `.DS_Store` estático de outro volume.

Os codecs leem/escrevem bytes reais portavelmente. A criação de Alias com CNIDs e identidade do volume via `Alias.for_file` exige macOS. Testes Linux usam identidade de fixture explícita e não demonstram a resolução/renderização nativa do Finder.
