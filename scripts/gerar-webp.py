#!/usr/bin/env python3
"""
gerar-webp.py — as versoes leves das fotos reais da casa.

    pip install pillow
    python3 scripts/gerar-webp.py

Os originais (hero.jpg, chopp.jpg, balcao.jpg, porta.jpg, mapa.jpg) ficam em
assets/img/bar/ como MATRIZES: sao o que o otimizar-fotos.py grava e o que se
troca quando a casa fotografar de novo. O site NAO serve a matriz — serve as
copias desta tabela, em WebP (e JPEG so onde o <picture> precisa de reserva):

  hero     640 e 1280 px   o topo da home e o item mais pesado da pagina. A foto
                           fica sob um veu escuro (72-90%), entao um desfoque de
                           0,6 px e qualidade 60 nao se enxergam e tiram um
                           terco do peso (fios e galhos sao ruido para o WebP).
  chopp    480, 720, 1200  moldura da home (300 px) e capa do cardapio (tela cheia)
  balcao   480 e 720       moldura 4:5 da secao Ambiente
  porta    480 e 800       fachada, retrato 9:14
  mapa     640 e 1000      o mapa 4:3

Mudou uma matriz? Rode de novo. Idempotente: so reescreve o que existe.
O EXIF (inclusive o GPS) nao e copiado — o Pillow so grava o que se passa.
"""
from pathlib import Path
from PIL import Image, ImageFilter

PASTA = Path(__file__).resolve().parent.parent / 'assets' / 'img' / 'bar'

# nome da matriz -> (larguras, qualidade, tambem JPEG?, desfoque em px)
TABELA = {
    'hero':   ([640, 1280],       60, True,  0.6),
    'chopp':  ([480, 720, 1200],  68, False, 0),
    'balcao': ([480, 720],        74, False, 0),
    'porta':  ([480, 800],        74, False, 0),
    'mapa':   ([640, 1000],       74, False, 0),
}

for nome, (larguras, q, com_jpeg, desfoque) in TABELA.items():
    origem = PASTA / f'{nome}.jpg'
    if not origem.exists():
        print(f'  pulei {origem.name}: nao existe')
        continue
    im = Image.open(origem).convert('RGB')
    for w in larguras:
        if w > im.width:
            continue
        h = round(im.height * w / im.width)
        copia = im.resize((w, h), Image.LANCZOS)
        if desfoque:
            copia = copia.filter(ImageFilter.GaussianBlur(desfoque))
        destino = PASTA / f'{nome}-{w}.webp'
        copia.save(destino, 'WEBP', quality=q, method=6)
        print(f'  {destino.name:18} {w}x{h}  {destino.stat().st_size // 1024} KB')
        if com_jpeg:
            dj = PASTA / f'{nome}-{w}.jpg'
            copia.save(dj, 'JPEG', quality=q, optimize=True, progressive=True)
            print(f'  {dj.name:18} {w}x{h}  {dj.stat().st_size // 1024} KB')
