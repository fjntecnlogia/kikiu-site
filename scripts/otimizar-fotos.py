#!/usr/bin/env python3
"""
otimizar-fotos.py — prepara foto de celular para entrar no site.

    pip install pillow
    python3 scripts/otimizar-fotos.py <pasta-de-origem>/foto.jpg <destino>

O destino diz o formato, e cada um tem um motivo:

  hero      1920x1080  topo do site. Larga, com veu da marca por cima.
  porta      900x1400  painel da casa na landing do grupo. Retrato.
  galeria   1200x1200  caixa da galeria. Cabe deitada ou em pe.
  ambiente  1200x1600  as molduras de ambiente da home, que sao 3:4 em pe.
                       Usar 'galeria' (quadrada) nelas corta duas vezes: uma
                       aqui para virar quadrado, outra no object-fit para
                       virar 3:4 — e foto de salao perde o teto nas duas.
  og        1200x630   previa do link no WhatsApp, Instagram e Google. E a
                       primeira imagem que alguem ve do restaurante, quase
                       sempre antes do site.
  prato     1000x1250  a foto grande da vitrine da home e do cardapio.

O que ela faz em toda foto, sem excecao:

  - **gira pelo EXIF antes de cortar.** Foto de celular vem deitada com uma
    etiqueta dizendo "na verdade estou em pe"; quem corta sem ler a etiqueta
    corta a foto errada e so descobre no ar.
  - **apaga o EXIF depois.** A etiqueta guarda o GPS de onde a foto foi tirada
    e o modelo do aparelho. Isso nao tem por que subir para a internet.
  - corta pelo centro na proporcao do destino, redimensiona e grava
    progressivo (o navegador ja mostra uma versao borrada enquanto baixa).
"""
import sys
from pathlib import Path
from PIL import Image, ImageOps

# iPhone grava HEIC por padrao, e e nesse formato que a foto chega quando se
# puxa pelo cabo. Sem isto o Pillow nao abre e o erro nao diz o motivo.
#     pip install pillow-heif
try:
    import pillow_heif
    pillow_heif.register_heif_opener()
except ImportError:
    pass

FORMATOS = {
    'hero':    (1920, 1080, 82),
    'porta':   (900, 1400, 82),
    'galeria': (1200, 1200, 80),
    'ambiente': (1200, 1600, 82),
    'og':      (1200, 630, 84),
    # As fotos de prato antigas sairam a 420x560 — suficiente para a ficha
    # pequena do cardapio, pequeno demais para a vitrine da home, onde a foto
    # ocupa meia tela e o objetivo e dar vontade. 4:5 em pe porque prato
    # fotografado de cima enche melhor o retrato do que o deitado.
    'prato':   (1000, 1250, 84),
}


def preparar(origem, destino, formato):
    larg, alt, qualidade = FORMATOS[formato]
    im = ImageOps.exif_transpose(Image.open(origem)).convert('RGB')
    # cover: preenche a caixa e corta a sobra pelo centro
    im = ImageOps.fit(im, (larg, alt), Image.LANCZOS, centering=(0.5, 0.5))
    destino = Path(destino)
    destino.parent.mkdir(parents=True, exist_ok=True)
    # sem exif=: o Pillow so grava o que a gente passar, entao o original fica
    # para tras junto com o GPS
    im.save(destino, 'JPEG', quality=qualidade, optimize=True, progressive=True)
    kb = destino.stat().st_size // 1024
    print(f'  {destino}  {larg}x{alt}  {kb} KB')


if __name__ == '__main__':
    if len(sys.argv) != 4:
        raise SystemExit(f'uso: {sys.argv[0]} <origem.jpg> <destino.jpg> <{"|".join(FORMATOS)}>')
    preparar(sys.argv[1], sys.argv[2], sys.argv[3])
