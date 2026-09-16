#!/usr/bin/env python3
"""
extrair-capas-bebidas.py — tira as capas do menu de bebidas das fotos que a
casa mandou.

As fotos foram tiradas com o cardápio na mão, sob a luz VERMELHA do bar:
vêm tortas e com dominante forte. Aqui elas são

  1. endireitadas  (transformação de perspectiva pelos 4 cantos do papel)
  2. neutralizadas (a faixa BRANCA do rodapé da capa, onde ficam os logos,
                    é a referência de branco — dela sai o iluminante, que
                    vale para as duas fotos: foram tiradas com 7 s de
                    diferença, na mesma luz)
  3. recortadas    na região que interessa

⚠️ Resolução: o papel ocupa ~720 px de largura nas fotos. Em 163 mm impressos
isso dá ~112 dpi — abaixo dos 300 dpi de gráfica. Serve para a copiadora e
para aprovar o layout. Para a gráfica, pedir à Casa Pro Coquetéis o arquivo
original da capa (ou as fotos soltas dos drinks).

    pip install pillow
    python3 scripts/extrair-capas-bebidas.py <pasta-com-as-fotos>
"""
import sys
from pathlib import Path
from PIL import Image, ImageEnhance, ImageFilter, ImageStat

PASTA = Path(sys.argv[1] if len(sys.argv) > 1 else '.')
SAIDA = Path('assets/img/capas')
SAIDA.mkdir(parents=True, exist_ok=True)

# cantos do papel em cada foto, no sentido horário a partir do alto-esquerda
CAPA  = ('15_11.24.25.jpg', [(74, 103), (688, 10), (800, 1522), (80, 1548)])
VERSO = ('16_11.24.32.jpg', [(118, 33), (706, 78), (792, 1516), (108, 1556)])

LARG, ALT = 1200, 2452          # 163 x 333 mm na mesma proporção


def resolver(M):
    """Eliminacao de Gauss com pivotamento. Evita puxar numpy so por isto."""
    n = len(M)
    for i in range(n):
        p = max(range(i, n), key=lambda r: abs(M[r][i]))
        M[i], M[p] = M[p], M[i]
        d = M[i][i]
        M[i] = [v / d for v in M[i]]
        for r in range(n):
            if r == i:
                continue
            f = M[r][i]
            if f:
                M[r] = [a - f * b for a, b in zip(M[r], M[i])]
    return [linha[n] for linha in M]


def coeficientes(destino, origem):
    """Coeficientes da transformação de perspectiva do PIL (destino -> origem)."""
    M = []
    for (xd, yd), (xo, yo) in zip(destino, origem):
        M.append([xd, yd, 1, 0, 0, 0, -xo * xd, -xo * yd, xo])
        M.append([0, 0, 0, xd, yd, 1, -yo * xd, -yo * yd, yo])
    return resolver(M)


def endireitar(caminho, cantos):
    im = Image.open(caminho).convert('RGB')
    destino = [(0, 0), (LARG, 0), (LARG, ALT), (0, ALT)]
    c = coeficientes(destino, cantos)
    return im.transform((LARG, ALT), Image.PERSPECTIVE, c, Image.BICUBIC)


def iluminante(im, caixa):
    """Ganho por canal que torna branca a região indicada."""
    media = ImageStat.Stat(im.crop(caixa)).mean
    alvo = max(media)
    return [alvo / max(m, 1) for m in media]


def neutralizar(im, ganho):
    canais = [c.point(lambda v, g=g: min(255, int(v * g))) for c, g in zip(im.split(), ganho)]
    return Image.merge('RGB', canais)


capa = endireitar(PASTA / CAPA[0], CAPA[1])
# a faixa dos logos: papel branco puro, a melhor referência que existe aqui
ganho = iluminante(capa, (150, 2180, 1050, 2300))
print('ganho por canal (R,G,B):', [round(g, 3) for g in ganho])

capa = neutralizar(capa, ganho)
capa = ImageEnhance.Contrast(capa).enhance(1.06)
# só a foto do drink: abaixo do título impresso, acima da faixa dos logos
# 460: logo abaixo do titulo impresso — a tipografia da capa nova e redesenhada
# em cima, entao o titulo velho nao pode entrar junto.
# 1830: onde comeca a faixa branca dos logos.
# As bordas laterais levam um dedo de recorte: sobra do papel e da mesa.
foto = capa.crop((22, 460, LARG - 45, 1830)).filter(ImageFilter.UnsharpMask(1.6, 90, 3))
foto.save(SAIDA / 'bebidas-capa-drink.jpg', quality=92, subsampling=0)
print('->', SAIDA / 'bebidas-capa-drink.jpg', foto.size)

verso = neutralizar(endireitar(PASTA / VERSO[0], VERSO[1]), ganho)
verso = ImageEnhance.Contrast(verso).enhance(1.06)
verso = verso.crop((38, 46, LARG - 52, ALT - 40)).filter(ImageFilter.UnsharpMask(1.6, 90, 3))
verso.save(SAIDA / 'bebidas-contracapa.jpg', quality=92, subsampling=0)
print('->', SAIDA / 'bebidas-contracapa.jpg', verso.size)


# ═══ as 13 fotos dos drinks da Casa Pro ═══════════════════════════════════
# Cada uma é uma miniatura em arco no impresso. Aqui o retângulo é recortado
# e o arco vira border-radius no CSS — assim o corte é vetorial e não fica
# serrilhado como ficaria mascarando um bitmap de 110 px.
DRINKS = Path('assets/img/drinks')
DRINKS.mkdir(parents=True, exist_ok=True)

# (arquivo da pagina, [(nome, esquerda, topo, direita, base), ...])
MINIATURAS = [
    ('07_11.20.45.jpg', [
        ('banana-sour',       200, 338, 312, 500),
        ('black-velvet',      204, 552, 312, 706),
        ('carajillo',         184, 778, 302, 962),
        ('espresso-martini',  168, 1002, 296, 1182),
        ('jungle-bird',       164, 1232, 302, 1408),
    ]),
    ('08_11.21.01.jpg', [
        ('midori',            236, 138, 356, 288),
        ('moscow-mule',       214, 328, 342, 488),
        ('negroni',           199, 518, 331, 692),
        ('pacoka',            194, 723, 322, 902),
        ('porn-star-martini', 164, 948, 306, 1138),
        ('valentina',         134, 1193, 292, 1388),
    ]),
    ('09_11.21.08.jpg', [
        ('whiskey-business',  299, 193, 413, 327),
        ('whiskey-sour',      296, 358, 411, 517),
    ]),
]


def branco_da_pagina(im, percentil=0.96):
    """O papel é a maior área clara da foto: o topo do histograma é ele.

    Melhor que escolher um retângulo de papel à mão — as páginas têm sombra
    de dobra e a mancha de texto muda de uma para a outra.
    """
    ganho = []
    for canal in im.split():
        h = canal.histogram()
        total = sum(h)
        acum, valor = 0, 255
        for v, n in enumerate(h):
            acum += n
            if acum >= total * percentil:
                valor = v
                break
        ganho.append(max(valor, 1))
    alvo = max(ganho)
    return [alvo / g for g in ganho]


def apara(rec, limite=0.55):
    """Corta a sobra de papel em volta do arco.

    O recorte a olho sobra papel de um lado e falta do outro; aqui a linha ou
    coluna em que a MAIORIA dos pixels é papel (claro e sem cor) cai fora. É
    isso que faz o arco encostar na borda — senão o border-radius do CSS corta
    papel em vez de foto, e sobra uma cunha branca no canto de cima.
    """
    px = rec.convert('RGB').load()
    L, A = rec.size

    def papel(x, y):
        r, g, bl = px[x, y]
        return min(r, g, bl) > 150 and max(r, g, bl) - min(r, g, bl) < 42

    col = [sum(papel(x, y) for y in range(A)) / A for x in range(L)]
    lin = [sum(papel(x, y) for x in range(L)) / L for y in range(A)]

    def borda(v):
        i, f = 0, len(v)
        while i < f and v[i] > limite: i += 1
        while f > i and v[f - 1] > limite: f -= 1
        return i, f

    x0, x1 = borda(col)
    y0, y1 = borda(lin)
    # se a heuristica comeu demais (drink claro, tipo o Paçoka), fica o original
    if x1 - x0 < L * 0.55 or y1 - y0 < A * 0.55:
        return rec
    return rec.crop((x0, y0, x1, y1))


for arquivo, miniaturas in MINIATURAS:
    pagina = Image.open(PASTA / arquivo).convert('RGB')
    pagina = neutralizar(pagina, branco_da_pagina(pagina))
    pagina = ImageEnhance.Contrast(pagina).enhance(1.08)
    for nome, e, t, d, b in miniaturas:
        rec = apara(pagina.crop((e, t, d, b)))
        rec = rec.resize((rec.width * 3, rec.height * 3), Image.LANCZOS)
        rec = rec.filter(ImageFilter.UnsharpMask(2.0, 110, 3))
        rec.save(DRINKS / f'{nome}.jpg', quality=93, subsampling=0)
    print(f'{arquivo}: {len(miniaturas)} miniaturas')
