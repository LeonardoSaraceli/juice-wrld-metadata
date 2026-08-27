# Juice WRLD metadata

Aplicativo desktop Electron para organizar músicas, editar metadados e preparar arquivos lossless para Apple Music e Media Player.

## Recursos

- Editor focado em título, artista, participações, álbum, ano, gênero e capa.
- Detecção automática de capas na pasta `covers`.
- WAV seleciona automaticamente a conversão para ALAC.
- Apenas duas opções de saída: manter o formato ou converter para ALAC/M4A.
- Catálogo paginado exclusivamente de `Original Files`, com filtro por época/formato, reprodução, seleção múltipla e download.
- Busca manual de capas da API dentro do editor, salvando a escolhida na pasta `covers` da música.
- Busca do arquivo original pelo título, exibindo o nome original e comparando SHA-256, fluxo comprimido, PCM decodificado, duração, codec e espectro.
- Confirmação de MP3 após edição de metadados e de ALAC/M4A convertido sem perdas a partir do WAV original.
- Pesquisa sob demanda de covers; a imagem só é carregada quando `Visualizar` é selecionado.
- Tracker sob demanda combinando a planilha pública e a API: composição/créditos, participações, nomes alternativos, instrumental, datas, duração, produção e formatos disponíveis.
- Letras estáticas com diagnóstico de formatação seguindo as regras editoriais públicas do Apple Music e correções seguras opcionais.
- Área de qualidade paginada, com triagem leve de arquivos lossless e MP3 de alta taxa.
- Nenhum catálogo, biblioteca ou coleção remota é carregado automaticamente.
- Resultados remotos não são mantidos em cache.
- Processamento local com FFmpeg e FFprobe.
- Componentes de interface compilados localmente com Tailwind CSS e daisyUI, sem runtime JavaScript adicional.

## Requisitos

- Windows 10 ou 11.
- Node.js 22 ou superior para desenvolvimento.
- `ffmpeg` e `ffprobe` disponíveis no `PATH`.

## Desenvolvimento

```powershell
npm install
npm start
```

## Criar instalador

```powershell
npm run dist
```

O instalador é criado em `dist/`.

## Capas automáticas

Para uma música em `C:\Music\Album\Faixa.wav`, o app procura imagens em:

1. `C:\Music\Album\covers\Faixa.png` (também JPG, JPEG ou WebP)
2. `C:\Music\Album\covers\Album.png`
3. `C:\Music\Album\Album.png`

O ícone do aplicativo é uma marca original “999” gerada para este projeto com a ferramenta de geração de imagens integrada ao Codex.
