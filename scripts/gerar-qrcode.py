#!/usr/bin/env python3
"""
gerar-qrcode.py — o QR code da mesa e o cartão que vai junto.

    pip install segno
    python3 scripts/gerar-qrcode.py
    # depois, para o PDF do cartão:
    chromium --headless --no-pdf-header-footer \
      --print-to-pdf=cardapios/QRCode-Mesa.pdf cardapios/qrcode-mesa.html

A URL sai do `casa.json` (`dominio` + `cardapio`) — a MESMA fonte que o
canonical e o sitemap usam. Trocar o domínio ali troca nos três; nunca digitar
a URL à mão aqui, porque um QR impresso errado só se conserta reimprimindo
tudo.

**Um QR por mesa** (`?mesa=N`, N até `mesas` no casa.json): a página mostra
"Mesa N" no topo e, quando o atendimento entrar, é esse número que diz de onde
veio o pedido sem ninguém perguntar. Sai também um QR sem mesa por casa, para
Instagram, bio e material solto.

**São DOIS QR por mesa, e não um.** O primeiro abre o cardápio; o segundo abre
"como foi?" (`/opiniao?mesa=N`), que e a opiniao do cliente caindo no painel.
Um QR só, levando a uma página com dois botões, custaria um toque a mais
justamente no momento em que a pessoa já está com a conta na mão — e é aí que
ela desiste. Cartões separados: o do cardápio fica de pé o tempo todo, o de
opinião entra com a conta.

A opinião NÃO depende da chave `cardapio` do casa.json: a casa pode ainda
não ter cardápio digital e já querer ouvir o cliente (é o caso do Forneatto).

Correção de erro **H** (recupera ~30% do código danificado): o cartão vive na
mesa de um bar — respingo, gordura e dobra são certos.

Saem três coisas por casa:
  assets/img/qrcode/<id>.svg   vetor, para banner, cardápio, adesivo
  assets/img/qrcode/<id>.png   bitmap grande, para quem só aceita imagem
  cardapios/qrcode-mesa.html   4 cartões A6 por folha A4, prontos para cortar
"""
import io as _io
import json
from pathlib import Path
import segno

try:                      # opcional: sem ele o script roda, mas sem conferir
    import cv2
    import numpy as np
    from PIL import Image
    _LEITOR = cv2.QRCodeDetector()
except ImportError:
    _LEITOR = None


def _decodifica(qr):
    """Lê o QR de volta com um decodificador independente do segno."""
    b = _io.BytesIO()
    qr.save(b, kind='png', scale=12, border=4, dark='#000000', light='#ffffff')
    a = np.array(Image.open(_io.BytesIO(b.getvalue())).convert('RGB'))[:, :, ::-1]
    return _LEITOR.detectAndDecode(a)[0]


# A máscara é escolhida pelo segno por um critério de "aparência" do padrão, e
# uma delas pode sair ilegível para leitores reais: `?mesa=1` do Saikō caiu na
# máscara 2 e NENHUM decodificador leu — nem em 600 dpi, nem aumentando a borda.
# As outras 23 mesas liam. Um cartão morto no salão não dá erro: o cliente só
# desiste. Então aqui cada QR é lido de volta antes de ser gravado, e a máscara
# só é aceita se o texto voltar idêntico.
MASCARAS = (None, 0, 1, 3, 4, 5, 6, 7, 2)


def fazer_qr(endereco):
    if _LEITOR is None:
        return segno.make(endereco, error='h')
    for mascara in MASCARAS:
        qr = segno.make(endereco, error='h', mask=mascara)
        if _decodifica(qr) == endereco:
            return qr
    raise SystemExit(f'nenhuma máscara legível para {endereco}')

RAIZ = Path(__file__).resolve().parent.parent
# Uma casa por repositorio: o laco abaixo continua igual, com um item so.
cfg = {'casas': [json.loads((RAIZ / 'casa.json').read_text(encoding='utf-8'))['casa']]}
SAIDA = RAIZ / 'assets/img/qrcode'
SAIDA.mkdir(parents=True, exist_ok=True)

# a identidade de cada casa, para o cartão não parecer de fornecedor
TEMAS = {
    'saiko':     dict(papel='#f6f2e9', marca='#c8102e', chamada='Cardápio digital'),
    'kikiu':     dict(papel='#fbf7f2', marca='#e0402c', chamada='Menu de bebidas'),
    'forneatto': dict(papel='#f7f4ee', marca='#c4161c', chamada='Cardápio digital'),
}

# O cartão de opinião fala com quem já comeu, então a chamada é um convite e
# não um rótulo: "Opinião do cliente" é linguagem de empresa.
CHAMADA_OPINIAO = 'Como foi?'
INSTRUCAO_OPINIAO = 'Conte pra gente em 1 minuto'

def gravar(endereco, nome):
    """Grava o par SVG+PNG e devolve o SVG pronto para embutir no cartão."""
    qr = fazer_qr(endereco)
    svg = SAIDA / f'{nome}.svg'
    # omitsize: sai com viewBox e SEM width/height. Sem viewBox o SVG nao
    # escala dentro da caixa do cartao — ele e RECORTADO, e o QR impresso
    # vira um codigo pela metade que nenhum celular le. (Confirmado
    # decodificando o PDF: com width/height fixos, nao lia.)
    qr.save(svg, scale=10, border=2, dark='#000000', light=None, omitsize=True)
    qr.save(SAIDA / f'{nome}.png', scale=24, border=2, dark='#000000', light='#ffffff')
    corpo = svg.read_text(encoding='utf-8')
    return corpo[corpo.index('<svg'):]


# Cada item: (casa, tema, endereco, svg, mesa, chamada, instrucao)
cartoes = []
for casa in cfg['casas']:
    t = TEMAS.get(casa['id'], TEMAS['saiko'])
    mesas = int(casa.get('mesas', 0))

    # ---- cardápio -----------------------------------------------------
    rota = casa.get('cardapio')
    if rota:
        base = f"https://{casa['dominio']}/{rota}"
        gravar(base, casa['id'])          # sem mesa: Instagram, bio, cartaz
        for n in range(1, mesas + 1):
            corpo = gravar(f'{base}?mesa={n}', f"{casa['id']}-mesa-{n:02d}")
            cartoes.append((casa, t, base, corpo, n, t['chamada'], 'Aponte a câmera do celular'))
        print(f"{casa['nome']}: cardápio   {base}  ·  {mesas} mesas  ·  {mesas + 1} QR")
    else:
        print(f"{casa['nome']}: cardápio   (sem página ainda — pulando)")

    # ---- opinião ------------------------------------------------------
    # Independe do cardápio: a casa pode ainda não ter cardápio digital e já
    # querer ouvir o cliente.
    op = f"https://{casa['dominio']}/opiniao"
    gravar(op, f"{casa['id']}-opiniao")
    for n in range(1, mesas + 1):
        corpo = gravar(f'{op}?mesa={n}', f"{casa['id']}-opiniao-mesa-{n:02d}")
        cartoes.append((casa, t, op, corpo, n, CHAMADA_OPINIAO, INSTRUCAO_OPINIAO))
    if mesas:
        print(f"{casa['nome']}: opinião    {op}  ·  {mesas} mesas  ·  {mesas + 1} QR")
    else:
        # Sem o número de mesas não dá para imprimir cartão por mesa, e
        # inventar um número que vai para a gráfica é pior do que avisar.
        print(f"{casa['nome']}: opinião    {op}  ·  1 QR (sem mesa)")
        print(f"{' ' * len(casa['nome'])}  ^ preencha \"mesas\" no casa.json para sair um por mesa")

if _LEITOR is None:
    print('\n⚠️  opencv-python-headless nao instalado: os QR NAO foram conferidos.')
    print('   pip install opencv-python-headless pillow  e rodar de novo.')

# O nome da casa entra como LOGO, não como tipo: a fonte de display de cada
# casa é outra, e uma marca redesenhada em fonte parecida é marca errada.
CARTAO = """  <div class="cartao" style="--papel:{papel};--marca:{marca}">
    <img class="logo" src="../assets/img/logos/{logo}-fundo-claro.png" alt="{nome}">
    <p class="chamada">{chamada}</p>
    <div class="qr">{qr}</div>
    <p class="instrucao">{instrucao}</p>
    <p class="mesa">Mesa {mesa}</p>
    <p class="url">{url_visivel}</p>
  </div>"""

# quatro por folha: a copiadora cobra por folha, e A6 é o tamanho que fica de
# pé num porta-cartão de mesa sem tapar o prato. Cada mesa sai UMA vez — o QR
# de cada uma é diferente, não dá para repetir cartão.
blocos = [CARTAO.format(
    nome=casa['nome'], logo=casa['id'], chamada=chamada, qr=corpo,
    mesa=n, url_visivel=endereco.replace('https://', ''), instrucao=instrucao,
    papel=t['papel'], marca=t['marca'])
    for casa, t, endereco, corpo, n, chamada, instrucao in cartoes]

html = """<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Cartão de mesa com QR code</title>
<!-- GERADO por scripts/gerar-qrcode.py. Não editar à mão. -->
<style>
/* Fontes embutidas: o cartão vai para a copiadora, que não tem internet.
   Gerado por scripts/gerar-fontes.mjs --qrcode. */
{fontes}
</style>
<style>
@page { size: A4; margin: 0; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: "Poppins", -apple-system, sans-serif; color: #171412;
  -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.folha { width: 210mm; height: 297mm; display: grid;
  grid-template-columns: 1fr 1fr; grid-template-rows: 1fr 1fr;
  page-break-after: always; }
.folha:last-child { page-break-after: auto; }
.cartao { background: var(--papel);
  border: .3pt dashed #bbb;           /* onde a guilhotina corta */
  padding: 11mm 10mm; text-align: center;
  display: flex; flex-direction: column; align-items: center;
  justify-content: space-between; }
.logo { max-width: 48mm; max-height: 24mm; width: auto; height: auto;
  object-fit: contain; }
.chamada { font-size: 8pt; letter-spacing: .26em; text-transform: uppercase;
  color: var(--marca); font-weight: 600; margin-top: 3mm; }
.qr { width: 55mm; height: 55mm; }
.qr svg { width: 100%; height: 100%; display: block; }
.instrucao { font-size: 10pt; font-weight: 600; }
/* o número da mesa é o que o garçom lê de pé, a um metro de distância */
.mesa { font-size: 17pt; font-weight: 700; color: var(--marca);
  letter-spacing: .04em; margin-top: 1mm; }
.url { font-size: 8pt; color: #777; letter-spacing: .02em; }
</style>
</head>
<body>
{folhas}
</body>
</html>
"""
try:
    fontes = (RAIZ / 'cardapios/_fontes-qrcode.css').read_text(encoding='utf-8')
except FileNotFoundError:
    fontes = '/* rode: node scripts/gerar-fontes.mjs --qrcode e gere de novo */'
html = html.replace('{fontes}', fontes).replace('{folhas}', '\n'.join(
    f'<div class="folha">\n' + '\n'.join(blocos[i:i + 4]) + '\n</div>'
    for i in range(0, len(blocos), 4)))

# A casa pode ainda nao ter producao grafica nenhuma — o QR da mesa
# nao depende disso e nao pode morrer por falta de pasta.
(RAIZ / 'cardapios').mkdir(exist_ok=True)
destino = RAIZ / 'cardapios/qrcode-mesa.html'
destino.write_text(html, encoding='utf-8')
folhas = -(-len(blocos) // 4)
print(f'-> {destino.relative_to(RAIZ)}  ({len(blocos)} cartões, {folhas} folhas A4)')
