/**
 * pagina-cardapio.mjs — a página que o QR code da mesa abre.
 *
 * Uma só função para as duas casas: muda o tema e os dados, não o esqueleto.
 * O que ela precisa entregar, nesta ordem de importância:
 *
 *   1. abrir rápido no 4G do shopping — CSS embutido, imagem preguiçosa,
 *      zero JavaScript de terceiros;
 *   2. deixar achar o prato sem rolar o cardápio inteiro — as fichas de seção
 *      grudam no topo e levam direto;
 *   3. ser legível de pé, com o celular na mão e a luz baixa do salão;
 *   4. ser reconhecível como a casa e não como "um cardápio" — o logo abre a
 *      página, o ícone da casa vai para a aba e para a tela de início, e cada
 *      seção carrega a marca da casa (o kanji, no japonês). O cliente chega
 *      aqui pelo QR da mesa, sem passar pelo site: esta página é o primeiro
 *      contato dele com a marca, muitas vezes o único.
 *
 * Provisória por fora, não por dentro: quando o Saipos assumir, só troca a
 * origem dos dados — o `sync-cardapio.mjs` escreve no mesmo formato.
 */

const esc = s => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const brl = n => `R$ ${n.toLocaleString('pt-BR',
  { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** id de âncora estável, sem acento — vai na URL quando o cliente toca a ficha */
export const idDe = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export function paginaCardapio(d) {
  const t = d.tema;

  const item = it => {
    // divisor: o subtítulo de grupo (Chopp, Long Neck, Whisky...). Vive dentro
    // da lista para não virar ficha própria — 16 fichas no topo não ajudam
    // ninguém a achar nada.
    if (it.divisor) return `<li class="div">${esc(it.divisor)}</li>`;
    const foto = it.foto
      ? `<img class="i__foto" src="${esc(it.foto)}" alt="${esc(it.nome)}" loading="lazy" decoding="async" width="72" height="86">`
      : '';
    const linhas = [
      it.sub  ? `<p class="i__sub">${esc(it.sub)}</p>` : '',
      it.desc ? `<p class="i__desc">${esc(it.desc)}</p>` : '',
      it.nota ? `<p class="i__nota">${esc(it.nota)}</p>` : '',
    ].filter(Boolean).join('');
    const preco = it.preco != null ? `<span class="i__preco">${brl(it.preco)}</span>` : '';
    return `<li class="i${it.foto ? ' i--foto' : ''}">${foto}<div class="i__txt">
      <div class="i__topo"><h3 class="i__nome">${esc(it.nome)}</h3>${preco}</div>${linhas}
    </div></li>`;
  };

  const secao = s => {
    // Numa lista onde alguns itens têm foto e outros não, o item sem foto
    // encostava na margem enquanto os outros começavam depois da miniatura —
    // a lista "pulava" no celular. Marcando a lista, o item sem foto recebe o
    // mesmo recuo e a coluna de texto fica reta de cima a baixo.
    const comFoto = s.itens.some(it => it.foto) ? ' lista--comfoto' : '';
    // marca: o sinal da casa ao lado do título (no Saikō, o kanji da seção).
    // Decorativo — aria-hidden para o leitor de tela não soletrar.
    const marca = s.marca
      ? `<span class="sec__marca" aria-hidden="true">${esc(s.marca)}</span>` : '';
    return `<section class="sec" id="${esc(s.id)}">
    <h2 class="sec__tit">${marca}${esc(s.titulo)}</h2>
    ${s.nota ? `<p class="sec__nota">${esc(s.nota)}</p>` : ''}
    <ul class="lista${comFoto}">${s.itens.map(item).join('')}</ul>
  </section>`;
  };

  const fichas = d.secoes.map(s =>
    `<a href="#${esc(s.id)}">${esc(s.titulo)}</a>`).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(d.titulo)} — ${esc(d.casa)}</title>
<meta name="description" content="${esc(d.descricao)}">
<meta name="theme-color" content="${t.barra}">
<link rel="icon" href="${esc(d.icone.aba)}" sizes="32x32">
<link rel="apple-touch-icon" href="${esc(d.icone.inicio)}">
<meta name="apple-mobile-web-app-title" content="${esc(d.casa)}">
<link rel="canonical" href="">
<meta property="og:type" content="restaurant.menu">
<meta property="og:title" content="${esc(d.titulo)} — ${esc(d.casa)}">
<meta property="og:description" content="${esc(d.descricao)}">
<meta property="og:url" content="">
<meta property="og:image" content="">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${d.fontes}">
<!-- GERADO por ${d.gerador}. Não editar à mão. -->
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --papel:${t.papel}; --tinta:${t.tinta}; --suave:${t.suave};
  --marca:${t.marca}; --fio:${t.fio}; --barra:${t.barra}; --sobre-barra:${t.sobreBarra};
  --display:${t.display}; --texto:${t.texto};
}
html{-webkit-text-size-adjust:100%}
body{
  background:var(--papel); color:var(--tinta); font-family:var(--texto);
  font-size:16px; line-height:1.5;
  padding-bottom:calc(28px + env(safe-area-inset-bottom));
}
img{max-width:100%;display:block}

/* ── cabeçalho ─────────────────────────────────────────────────────── */
.capa{background:var(--barra);color:var(--sobre-barra);text-align:center;
  padding:calc(26px + env(safe-area-inset-top)) 20px 24px}
/* A barra do topo tem a cor de fundo do logo de cada casa, então o PNG entra
   sem moldura e sem halo. max-width segura o logo largo (o do Kikiu é 3x mais
   largo que alto) em celular estreito. */
.capa__logo{height:${t.logoAltura}px;width:auto;max-width:76%;margin:0 auto}
.capa__casa{font-family:var(--display);font-size:30px;line-height:1.1;font-weight:${t.pesoDisplay}}
.capa__tit{font-family:var(--texto);font-size:11px;letter-spacing:.26em;
  text-transform:uppercase;opacity:.72;margin-top:12px}
/* o nome da casa existe como <h1> para leitor de tela e para o Google:
   o logo é imagem, e página de cardápio sem título nenhum é página órfã */
.soleitor{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;
  clip-path:inset(50%);white-space:nowrap;border:0}
/* [hidden] e regra da folha do navegador: qualquer display do autor ganha
   dela. Sem esta linha a pílula da mesa aparecia vazia enquanto o script
   não rodava — e continuava vazia em quem abre a página sem ?mesa. */
.capa__mesa[hidden]{display:none}
.capa__mesa{display:inline-block;margin-top:14px;font-weight:700;font-size:13px;
  letter-spacing:.1em;text-transform:uppercase;
  border:1px solid rgba(255,255,255,.28);border-radius:999px;padding:6px 16px}
.capa__end{font-size:12.5px;opacity:.66;margin-top:14px}
/* Promoção do dia. Nasce escondida pela mesma razão da pílula da mesa: só o
   script sabe que dia é hoje NA CASA, e prometer no dia errado é pior que
   não prometer. */
.capa__promo[hidden]{display:none}
.capa__promo{display:block;margin:16px auto 0;max-width:30ch;font-weight:700;
  font-size:13.5px;line-height:1.5;border-radius:12px;padding:10px 16px;
  background:rgba(242,168,130,.16);border:1px solid rgba(242,168,130,.45)}

/* ── fichas de seção: grudam no topo e levam direto ────────────────── */
.fichas{position:sticky;top:0;z-index:9;background:var(--papel);
  border-bottom:1px solid var(--fio);
  display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;
  padding:11px 16px;scroll-padding-left:16px}
.fichas::-webkit-scrollbar{display:none}
.fichas a{flex:0 0 auto;text-decoration:none;color:var(--suave);
  font-size:13px;font-weight:600;white-space:nowrap;
  border:1px solid var(--fio);border-radius:999px;padding:7px 14px}
.fichas a:active{background:var(--marca);border-color:var(--marca);color:#fff}

/* ── seções ────────────────────────────────────────────────────────── */
main{padding:0 16px;max-width:640px;margin:0 auto}
.sec{padding-top:30px;scroll-margin-top:62px}
.sec__tit{font-family:var(--display);font-weight:${t.pesoDisplay};
  font-size:25px;line-height:1.15;color:var(--marca);
  display:flex;align-items:baseline;gap:10px}
.sec__marca{font-family:var(--texto);font-weight:500;font-size:15px;
  color:var(--suave);opacity:.75;flex:0 0 auto;letter-spacing:.06em}
.sec__nota{font-size:12.5px;color:var(--suave);margin-top:5px}
.lista{list-style:none;margin-top:14px}

.div{font-family:var(--display);font-weight:${t.pesoDisplay};font-size:16px;
  padding:22px 0 2px;color:var(--tinta);letter-spacing:.01em}
.div:first-child{padding-top:4px}
.i{padding:15px 0;border-bottom:1px solid var(--fio)}
.i:last-child{border-bottom:0}
.i--foto{display:grid;grid-template-columns:72px 1fr;gap:14px;align-items:start}
/* 86px = a miniatura (72) + o vão (14): o item sem foto entra na mesma
   coluna de texto dos que têm, em vez de encostar na margem */
.lista--comfoto .i:not(.i--foto){padding-left:86px}
.lista--comfoto .div{padding-left:86px}
.i__foto{width:72px;height:86px;object-fit:cover;border-radius:${t.arco}}
.i__topo{display:flex;justify-content:space-between;align-items:baseline;gap:12px}
.i__nome{font-family:var(--display);font-weight:${t.pesoDisplay};
  font-size:17px;line-height:1.25}
.i__preco{font-weight:700;font-size:15px;white-space:nowrap;color:var(--marca)}
.i__sub{font-size:12.5px;color:var(--suave);margin-top:2px}
.i__desc{font-size:13.5px;color:var(--suave);margin-top:5px;line-height:1.45}
.i__nota{font-size:12px;color:var(--suave);margin-top:4px;font-style:italic}

/* ── rodapé ────────────────────────────────────────────────────────── */
.pe{margin-top:38px;padding:26px 16px 8px;border-top:1px solid var(--fio);
  text-align:center;color:var(--suave);font-size:12.5px;line-height:1.7}
.pe a{color:var(--marca);font-weight:600}
/* o ícone já vem com o fundo escuro da casa: arredondado vira um selo */
.pe__selo{width:38px;height:38px;border-radius:50%;margin:0 auto 14px}
.topo{display:inline-block;margin-top:18px;text-decoration:none;
  border:1px solid var(--fio);border-radius:999px;padding:9px 20px;
  color:var(--suave);font-size:13px;font-weight:600}
@media (prefers-reduced-motion:no-preference){html{scroll-behavior:smooth}}
</style>
</head>
<body>

<header class="capa">
  ${d.logo ? `<img class="capa__logo" src="${esc(d.logo.src)}" alt="${esc(d.logo.alt)}"
       width="${d.logo.largura}" height="${d.logo.altura}" fetchpriority="high">`
           : `<p class="capa__casa">${esc(d.casa)}</p>`}
  <h1 class="soleitor">${esc(d.casa)} — ${esc(d.titulo)}</h1>
  <p class="capa__tit">${esc(d.titulo)}</p>
  <p class="capa__mesa" hidden></p>
  <p class="capa__promo" hidden></p>
  <p class="capa__end">${esc(d.endereco)}</p>
</header>
<script>
// ?mesa=7 vira "Mesa 7" no topo. O numero vem do QR colado na propria mesa,
// entao e ele que identifica de onde veio o cliente quando o atendimento
// entrar. Tratado como numero, nunca como texto: e parametro de URL, qualquer
// um digita o que quiser ali.
(function () {
  var n = parseInt(new URLSearchParams(location.search).get('mesa'), 10);
  if (!(n >= 1 && n <= 99)) return;
  var el = document.querySelector('.capa__mesa');
  el.textContent = 'Mesa ' + n;
  el.hidden = false;
})();
<\/script>
${d.promo ? `
<script>
// A promocao do dia. O dia tem que ser o DA CASA, nao o do aparelho: quem
// abre o cardapio de outro fuso — ou com o relogio errado — veria a
// promocao na noite errada, e promessa no dia errado e pior que promessa
// nenhuma. Por isso o dia da semana sai do Intl com o fuso da casa.
(function () {
  var DIAS = ${JSON.stringify(d.promo.dias)};
  var hoje;
  try {
    hoje = new Intl.DateTimeFormat('en-US', { timeZone: ${JSON.stringify(d.promo.fuso)}, weekday: 'short' })
      .format(new Date());
  } catch (e) { return; }   // fuso desconhecido no aparelho: nao promete nada
  var n = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }[hoje];
  if (DIAS.indexOf(n) === -1) return;
  var el = document.querySelector('.capa__promo');
  el.textContent = ${JSON.stringify(d.promo.texto)};
  el.hidden = false;
})();
<\/script>` : ''}

<nav class="fichas" aria-label="Seções do cardápio">${fichas}</nav>

<main>
${d.secoes.map(secao).join('\n')}

  <footer class="pe">
    <img class="pe__selo" src="${esc(d.icone.inicio)}" alt="" width="38" height="38" loading="lazy">
    ${esc(d.rodape)}<br>
    <a href="/">Conheça o ${esc(d.casa)}</a>
    <br><a class="topo" href="#">Voltar ao topo</a>
  </footer>
</main>

<script type="application/ld+json">${JSON.stringify(d.jsonld)}</script>
</body>
</html>
`;
}
