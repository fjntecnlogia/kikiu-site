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

/**
 * O canonical e as tags og NASCEM preenchidas, e isso nao e detalhe.
 *
 * Elas ficavam vazias no molde e o `aplicar-dominios.mjs` as preenchia
 * DEPOIS. So que o robo de preco regenera esta pagina de 6 em 6 horas, com
 * --aplicar, e NAO roda o aplicar-dominios — entao cada sincronizacao de
 * preco devolvia o canonical e a imagem que o WhatsApp mostra para "".
 *
 * A prova esta no historico: o commit 28e908f do saiko-site, feito pelo
 * robo, mexeu em exatamente tres linhas — as tres.
 *
 * Nascendo certo, nao ha o que apagar, e o aplicar-dominios vira no-op
 * nestes campos em vez de ser um segundo passo que alguem esquece.
 */
export function paginaCardapio(d) {
  const t = d.tema;

  const item = it => {
    // divisor: o subtítulo de grupo (Chopp, Long Neck, Whisky...). Vive dentro
    // da lista para não virar ficha própria — 16 fichas no topo não ajudam
    // ninguém a achar nada.
    if (it.divisor) return `<li class="div">${esc(it.divisor)}</li>`;
    const foto = it.foto
      ? `<img class="i__foto" src="${esc(it.foto)}" alt="${esc(it.nome)}" loading="lazy" decoding="async" width="640" height="480">`
      : '';
    const linhas = [
      it.sub  ? `<p class="i__sub">${esc(it.sub)}</p>` : '',
      it.desc ? `<p class="i__desc">${esc(it.desc)}</p>` : '',
      it.nota ? `<p class="i__nota">${esc(it.nota)}</p>` : '',
    ].filter(Boolean).join('');
    const preco = it.preco != null ? `<span class="i__preco">${brl(it.preco)}</span>` : '';
    return `<li class="i${it.foto ? ' i--foto' : ''}" data-nome="${esc(it.nome)}">${foto}<div class="i__txt">
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
    return `<section class="sec" id="${esc(s.id)}" data-titulo="${esc(s.categoria ?? s.titulo)}">
    <div class="sec__cab"><h2 class="sec__tit">${esc(s.titulo)}</h2>${marca}</div>
    ${s.nota ? `<p class="sec__nota">${esc(s.nota)}</p>` : ''}
    <ul class="lista${comFoto}">${s.itens.map(item).join('')}</ul>
  </section>`;
  };

  // Atalhos para outras páginas da casa (a carta de vinhos): ficam à frente das
  // seções, com a borda acesa, para não se confundirem com uma seção.
  const extras = (d.extras ?? []).map(e =>
    `<a class="extra" href="${esc(e.href)}">${esc(e.texto)}</a>`).join('');
  const fichas = extras + d.secoes.map(s =>
    `<a href="#${esc(s.id)}">${esc(s.titulo)}</a>`).join('');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(d.titulo)} — ${esc(d.casa)}</title>
<meta name="description" content="${esc(d.descricao)}">
${d.naoIndexar ? '<meta name="robots" content="noindex, nofollow">' : ''}
<meta name="theme-color" content="${t.barra}">
<link rel="icon" href="${esc(d.icone.aba)}" sizes="32x32">
<link rel="apple-touch-icon" href="${esc(d.icone.inicio)}">
<meta name="apple-mobile-web-app-title" content="${esc(d.casa)}">
<link rel="canonical" href="${esc(d.url)}">
<meta property="og:type" content="restaurant.menu">
<meta property="og:title" content="${esc(d.titulo)} — ${esc(d.casa)}">
<meta property="og:description" content="${esc(d.descricao)}">
<meta property="og:url" content="${esc(d.url)}">
<meta property="og:image" content="${esc(d.ogImagem)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="${d.fontes}">
<!-- GERADO por ${d.gerador}. Não editar à mão. -->
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --papel:${t.papel}; --cartao:${t.cartao}; --tinta:${t.tinta}; --suave:${t.suave};
  --marca:${t.marca}; --realce:${t.realce}; --fio:${t.fio}; --barra:${t.barra}; --sobre-barra:${t.sobreBarra};
  --display:${t.display}; --texto:${t.texto};
}
html{-webkit-text-size-adjust:100%;background:var(--papel)}
body{
  background:var(--papel); color:var(--tinta); font-family:var(--texto);
  font-size:16px; line-height:1.5;
  padding-bottom:calc(28px + env(safe-area-inset-bottom));
}
img{max-width:100%;display:block}

/* ── abertura: a foto da casa, o logo e nada mais ───────────────────── */
.capa{position:relative;isolation:isolate;overflow:hidden;color:var(--sobre-barra);
  min-height:${t.heroImg ? 'min(74svh,560px)' : 'auto'};display:flex;flex-direction:column;
  justify-content:flex-end;align-items:center;text-align:center;
  padding:calc(40px + env(safe-area-inset-top)) 22px 34px;background:var(--barra)}
.capa__foto{position:absolute;inset:0;z-index:-2;width:100%;height:100%;
  object-fit:cover;object-position:${t.heroPos || 'center'}}
/* o degradê é o que faz o logo e o texto lerem em cima de qualquer foto, e
   o que funde a foto com o fundo do cardápio sem uma linha de corte */
/* sem foto (tema claro) não há o que escurecer: o degradê só existe com foto */
${t.heroImg ? `.capa::after{content:"";position:absolute;inset:0;z-index:-1;
  background:linear-gradient(180deg,rgba(0,0,0,.34) 0%,rgba(0,0,0,.08) 28%,
    rgba(0,0,0,.55) 66%,var(--papel) 100%)}` : ''}
.capa__logo{height:${t.logoAltura}px;width:auto;max-width:72%;margin:0 auto;
  filter:drop-shadow(0 4px 18px rgba(0,0,0,.55))}
.capa__casa{font-family:var(--display);font-size:38px;line-height:1.1;font-weight:${t.pesoDisplay}}
.capa__tit{font-family:var(--texto);font-size:12px;letter-spacing:.34em;
  text-transform:uppercase;color:var(--realce);margin-top:18px;font-weight:700}
.soleitor{position:absolute;width:1px;height:1px;padding:0;overflow:hidden;
  clip-path:inset(50%);white-space:nowrap;border:0}
/* [hidden] e regra da folha do navegador: qualquer display do autor ganha
   dela. Sem esta linha a pílula da mesa aparecia vazia enquanto o script
   não rodava — e continuava vazia em quem abre a página sem ?mesa. */
.capa__mesa[hidden]{display:none}
.capa__mesa{display:inline-block;margin-top:16px;font-weight:700;font-size:13px;
  letter-spacing:.12em;text-transform:uppercase;color:var(--sobre-barra);
  background:color-mix(in srgb,var(--barra) 55%,transparent);border:1px solid var(--realce);
  border-radius:999px;padding:7px 18px;backdrop-filter:blur(6px)}
.capa__end{font-size:12.5px;opacity:.78;margin-top:16px}
/* Promoção do dia. Nasce escondida pela mesma razão da pílula da mesa: só o
   script sabe que dia é hoje NA CASA, e prometer no dia errado é pior que
   não prometer. */
.capa__promo[hidden]{display:none}
.capa__promo{display:block;margin:16px auto 0;max-width:30ch;font-weight:700;
  font-size:13.5px;line-height:1.5;border-radius:12px;padding:10px 16px;
  color:var(--sobre-barra);backdrop-filter:blur(6px);
  background:color-mix(in srgb,var(--barra) 60%,transparent);border:1px solid var(--realce)}


/* ── fichas de seção: grudam no topo, a da seção atual acende ────────── */
.fichas{position:sticky;top:0;z-index:9;
  background:color-mix(in srgb,var(--papel) 90%,transparent);
  backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px);
  border-bottom:1px solid var(--fio);
  display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;
  padding:12px 16px;scroll-padding-left:16px}
.fichas::-webkit-scrollbar{display:none}
.fichas a{flex:0 0 auto;text-decoration:none;color:var(--suave);
  font-size:13.5px;font-weight:700;white-space:nowrap;
  background:var(--cartao);border:1px solid var(--fio);border-radius:999px;
  padding:9px 16px;transition:background .2s,color .2s,border-color .2s}
.fichas a.on,.fichas a:active{background:var(--marca);border-color:var(--marca);color:#fff}
.fichas a.extra{border-color:var(--realce);color:var(--realce)}
.i[hidden],.div[hidden],.sec[hidden],.fichas a[hidden]{display:none}

/* ── seções ────────────────────────────────────────────────────────── */
main{padding:0 16px;max-width:640px;margin:0 auto}
.sec{padding-top:44px;scroll-margin-top:64px}
.sec__cab{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}
.sec__tit{font-family:var(--display);font-weight:${t.pesoDisplay};
  font-size:32px;line-height:1.08;color:var(--tinta);letter-spacing:.005em}
.sec__tit::after{content:"";display:block;width:44px;height:3px;border-radius:3px;
  background:var(--marca);margin-top:12px}
/* o sinal da casa, grande e apagado: ocupa o canto como carimbo, não como texto */
.sec__marca{font-family:var(--display);font-weight:${t.pesoDisplay};font-size:58px;
  line-height:.9;color:var(--marca);opacity:.22;flex:0 0 auto;letter-spacing:.02em;
  user-select:none}
.sec__nota{font-size:13px;color:var(--suave);margin-top:12px}
.lista{list-style:none;margin-top:20px;display:grid;gap:12px}

.div{font-family:var(--texto);font-weight:700;font-size:12px;letter-spacing:.24em;
  text-transform:uppercase;color:var(--realce);padding:14px 2px 0}
.div:first-child{padding-top:0}
.i{background:var(--cartao);border:1px solid var(--fio);border-radius:16px;
  padding:18px 18px 17px;overflow:hidden}
.i__topo{display:flex;justify-content:space-between;align-items:flex-start;gap:14px}
.i__nome{font-family:var(--display);font-weight:${t.pesoDisplay};
  font-size:19px;line-height:1.22}
.i__preco{flex:0 0 auto;font-weight:700;font-size:16px;white-space:nowrap;
  color:var(--realce);letter-spacing:.01em;padding-top:1px}
.i__sub{font-size:13px;color:var(--suave);margin-top:3px}
.i__desc{font-size:14px;color:var(--suave);margin-top:8px;line-height:1.5}
.i__nota{font-size:12.5px;color:var(--suave);margin-top:6px;font-style:italic}
/* prato com foto: a foto manda, de ponta a ponta do cartão. É este o layout que
   sobe sozinho quando o JSON ganhar o campo foto (as fotos da casa chegando). */
.i--foto{padding:0}
.i--foto .i__txt{padding:16px 18px 18px}
.i__foto{width:100%;aspect-ratio:4/3;object-fit:cover;display:block}

@media (prefers-reduced-motion:no-preference){
  html{scroll-behavior:smooth}
  .i{opacity:0;transform:translateY(10px);transition:opacity .45s ease,transform .45s ease}
  .i.vis{opacity:1;transform:none}
}
@media (min-width:560px){
  .sec__tit{font-size:36px}
}

/* ── rodapé ────────────────────────────────────────────────────────── */
.pe{margin-top:48px;padding:28px 16px 8px;border-top:1px solid var(--fio);
  text-align:center;color:var(--suave);font-size:12.5px;line-height:1.7}
.pe a{color:var(--realce);font-weight:700}
.pe__selo{width:42px;height:42px;border-radius:50%;margin:0 auto 14px}
.topo{display:inline-block;margin-top:18px;text-decoration:none;
  border:1px solid var(--fio);border-radius:999px;padding:10px 22px;
  color:var(--suave);font-size:13px;font-weight:700}
</style>
</head>
<body>

<header class="capa">
  ${t.heroImg ? `<img class="capa__foto" src="${esc(t.heroImg)}" alt="" fetchpriority="high" decoding="async">` : ''}
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

<script>
// A ficha da seção que está na tela acende, e os cartões entram ao rolar. Sem
// IntersectionObserver (navegador velho) nada disso é necessário: a página
// inteira já é legível, e os cartões nascem visíveis pelo noscript abaixo.
(function () {
  if (!('IntersectionObserver' in window)) {
    document.documentElement.classList.add('sem-io');
    [].forEach.call(document.querySelectorAll('.i'), function (c) { c.classList.add('vis'); });
    return;
  }
  var fichas = document.querySelector('.fichas');
  var cartoes = new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('vis'); cartoes.unobserve(e.target); } });
  }, { rootMargin: '0px 0px -6% 0px' });
  [].forEach.call(document.querySelectorAll('.i'), function (c) { cartoes.observe(c); });

  var secoes = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (!e.isIntersecting) return;
      [].forEach.call(fichas.querySelectorAll('a'), function (a) {
        var on = a.getAttribute('href') === '#' + e.target.id;
        a.classList.toggle('on', on);
        if (on) fichas.scrollTo({ left: a.offsetLeft - 16, behavior: 'smooth' });
      });
    });
  }, { rootMargin: '-30% 0px -65% 0px' });
  [].forEach.call(document.querySelectorAll('.sec'), function (s) { secoes.observe(s); });
})();
<\/script>
<noscript><style>.i{opacity:1!important;transform:none!important}</style></noscript>

<script type="application/ld+json">${JSON.stringify(d.jsonld)}</script>
${d.apiSlug ? `<script type="module" src="/assets/cardapio-vivo.js" data-api="/cardapio-api/${esc(d.apiSlug)}"></script>` : ''}
<script type="module" src="/assets/analytics.js"></script>
</body>
</html>
`;
}
