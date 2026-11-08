# Arte do instalador

- `background-source.jpg`: arquivo aprovado pelo proprietário, preservado byte a byte. Dimensões reais: **1152×864**, proporção 4:3.
- `background.png`: versão RGB **640×480**, redimensionada com Lanczos, sem mudar o desenho/texto aprovado. Pronta para uso: Pillow não é dependência do build no Mac.

O build copia apenas `background.png` para `.background/background.png` dentro do volume. A pasta oculta e `.DS_Store` não aparecem como ícones em uma visualização normal do Finder. A imagem não faz parte do bundle do aplicativo nem altera o painel SwiftUI.

A seta central fica próxima de (313, 241); app em (170, 240), Applications em (470, 240), ícones de 72 pontos e nomes de 12 pontos. A legenda em português faz parte da arte aprovada e não muda com o idioma do app.
