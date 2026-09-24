#!/usr/bin/env node
/**
 * build-cardapio-bebidas.mjs — o cardapio do Kikiu: QR da mesa e gráfica.
 *
 * Nasceu so com bebida, porque so bebida havia. Desde 18/09/2026 carrega
 * tambem a cozinha (petiscos, pasteis, croquetes, especiais, steaks e os
 * LANCHES novos) e as sobremesas, que sao as mesmas das tres casas.
 *
 *   node scripts/build-cardapio-bebidas.mjs
 *
 * cardapios/kikiu-bebidas.json é a verdade deste cardápio. Dele sai
 * cardapios/kikiu-bebidas-impressao.html, que vira o PDF.
 *
 * Mudou um preço? Muda no JSON e roda. Nunca em dois lugares.
 *
 * A paginação é medida NO NAVEGADOR, não estimada em mm: o script abaixo
 * roda antes do PDF, quebra as páginas onde de fato não cabe e grava o
 * resultado em data-paginado / data-estouro. Estimar em mm já cortou preço
 * em silêncio no cardápio do Saikō.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { paginaCardapio, idDe } from './pagina-cardapio.mjs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const ler = p => readFile(join(RAIZ, p), 'utf8');
const dados = JSON.parse(await ler('cardapios/kikiu-bebidas.json'));

// `ativo: false` = existe no nosso cardapio e NAO existe no PDV. Regra do
// Fundador (18/09/2026): o que nao esta no Saipos nao fica no ar. O item nao
// e apagado — descricao, foto e preco ficam guardados; basta tirar a marca
// (ou cadastrar no PDV) para ele voltar.
//
// Filtrado AQUI, e nao na hora de montar a lista: na primeira tentativa eu
// filtrei so a lista visivel, e os quinze desativados continuaram no
// JSON-LD — a pagina nao os mostrava e o Google continuava lendo que o bar
// vende Banana Sour. Uma peneira so, antes de tudo.
for (const b of dados.blocos) for (const g of b.grupos) g.itens = g.itens.filter(it => it.ativo !== false);

// Grupo que ficou sem nenhum item vira um subtitulo solto: em 24/09 os cinco
// sucos especiais sairam do PDV de uma vez e a folha impressa ficou com o
// titulo "Sucos especiais" e nada embaixo. Cai junto com os itens.
for (const b of dados.blocos) b.grupos = b.grupos.filter(g => g.itens.length);

const brl = n => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const selo = '<div class="selo"><i></i><i></i><i></i></div>';
const regua = '<div class="regua"><b></b></div>';

function itemHTML(item, precoUnico) {
  const preco = item.preco ?? precoUnico;
  const linhas = [];
  if (item.sub) linhas.push(`<p class="item__sub">${esc(item.sub)}</p>`);
  if (item.ingredientes) linhas.push(`<p class="item__ingr">${esc(item.ingredientes)}</p>`);
  if (item.perfil) linhas.push(`<p class="item__perfil">(${esc(item.perfil)})</p>`);
  if (item.garrafa) linhas.push(`<p class="item__garrafa">${brl(item.garrafa)} a garrafa</p>`);
  // no bloco de preço único o valor não se repete item a item, como no impresso
  const celaPreco = precoUnico ? '' : `<span class="item__preco">${brl(preco)}</span>`;

  if (!item.foto) {
    return `    <div class="item">
      <p class="item__nome">${esc(item.nome)}</p>${celaPreco}
${linhas.map(l => '      ' + l).join('\n')}
    </div>`;
  }

  // Com miniatura o item vira flex, não grid: a imagem de 33 mm e o texto
  // curto precisam ficar centrados um no outro. Em grid, a imagem esticava as
  // linhas e o nome do drink descia para o pé da foto.
  // O arco é border-radius, não máscara no bitmap: em ~110 px de origem uma
  // máscara sairia serrilhada.
  return `    <div class="item item--foto">
      <img class="item__foto" src="../assets/img/drinks/${esc(item.foto)}" alt="${esc(item.nome)}">
      <div class="item__texto">
        <div class="item__cabeca"><p class="item__nome">${esc(item.nome)}</p>${celaPreco}</div>
${linhas.map(l => '        ' + l).join('\n')}
      </div>
    </div>`;
}

/** Cada grupo vira um bloco paginável. O primeiro leva o título da seção. */
function gruposHTML(bloco) {
  return bloco.grupos.map((g, i) => {
    const cabeca = [];
    if (i === 0) {
      cabeca.push(regua);
      cabeca.push(`    <h2 class="secao">${esc(bloco.titulo)}</h2>`);
      cabeca.push(regua);
      if (bloco.texto) cabeca.push(`    <p class="abertura">${esc(bloco.texto)}</p>`);
      if (bloco.notaPreco) cabeca.push(`    <p class="nota-preco">${esc(bloco.notaPreco)}</p>`);
      cabeca.push('    <div style="height:6mm"></div>');
    }
    if (g.titulo) cabeca.push(`    <p class="grupo-titulo">${esc(g.titulo)}</p>`);
    const lista = g.itens.some(it => it.ingredientes) ? '' : ' grupo--lista';
    const arejado = g.arejado ? ' grupo--arejado' : '';
    // data-quebra reproduz uma virada de pagina do impresso original
    const quebra = g.quebraAntes ? ' data-quebra="1"' : '';
    return `  <div class="grupo${lista}${arejado}"${quebra}>
${cabeca.join('\n')}
${g.itens.map(it => itemHTML(it, bloco.precoUnico)).join('\n')}
  </div>`;
  }).join('\n\n');
}

const miolo = `<div id="origem">
${dados.blocos.map(gruposHTML).join('\n\n')}
</div>
<div id="paginas"></div>`;

const capa = `<section class="pagina capa">
  <div class="capa__topo">
    ${selo}
    <p class="capa__titulo"><span>Menu de</span><b>Bebidas</b></p>
  </div>
  <div class="capa__foto"></div>
  <div class="capa__rodape">
    <img class="capa__logo" src="../assets/img/logos/kikiu-fundo-claro.png"
         alt="Kikiu Gastrobar">
    <p class="capa__casa">Casa<small>pro coquetéis</small></p>
  </div>
</section>`;

// Contracapa: a foto sozinha, sangrando, como no impresso da casa.
const contracapa = `<section class="pagina verso"></section>`;

const scriptPaginador = `<script>
// Mede depois que a fonte carrega: com o fallback do sistema o texto e mais
// curto e, quando a Abril Fatface entra, tudo cresce — a conta dava "cabe"
// e o rodape saia cortado.
Promise.all([
  document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()
].concat([].slice.call(document.images).map(function (img) {
  return img.complete ? null : new Promise(function (ok) { img.onload = img.onerror = ok; });
}))).then(function () {
  var origem = document.getElementById('origem');
  var destino = document.getElementById('paginas');
  var SELO = '<div class="selo"><i></i><i></i><i></i></div>';

  function novaPagina() {
    var p = document.createElement('section');
    p.className = 'pagina';
    p.innerHTML = SELO + '<div class="corpo"></div><div class="esticar"></div>' + SELO;
    destino.appendChild(p);
    return p;
  }
  // scrollHeight nao conta o padding de baixo, entao dava "cabe" com ate
  // 17 mm de sobra invisivel. Medir a geometria do ultimo filho e exato.
  function cabe(p) {
    var caixa = p.getBoundingClientRect();
    var limite = caixa.bottom - parseFloat(getComputedStyle(p).paddingBottom);
    var ultimo = p.lastElementChild;
    return !ultimo || ultimo.getBoundingClientRect().bottom <= limite + 0.5;
  }
  // cabeca do grupo = tudo que vem antes do primeiro item
  function clonarCabeca(bloco) {
    var novo = bloco.cloneNode(false);
    for (var i = 0; i < bloco.children.length; i++) {
      var filho = bloco.children[i];
      if (filho.classList.contains('item')) break;
      novo.appendChild(filho.cloneNode(true));
    }
    // a abertura da secao e a nota de preco sao boas-vindas: aparecem uma
    // vez so. Repetir o texto inteiro na continuacao enche meia pagina.
    [].slice.call(novo.querySelectorAll('.abertura, .nota-preco'))
      .forEach(function (el) { el.remove(); });
    // o aviso vai em linha propria: emendado no titulo da secao ele quebra
    // a display de 30pt em duas linhas e come um quarto da pagina
    var marca = document.createElement('p');
    marca.className = 'continua';
    marca.textContent = 'continuação';
    var t = novo.querySelector('.grupo-titulo');
    if (t) t.parentNode.insertBefore(marca, t.nextSibling);
    else {
      var sec = novo.querySelector('.secao');
      if (sec) sec.parentNode.insertBefore(marca, sec.nextSibling);
      else novo.appendChild(marca);
    }
    return novo;
  }

  var fila = [].slice.call(origem.children);
  var pag = novaPagina(), corpo = pag.querySelector('.corpo');
  var MINIMO = 2;   // um titulo nunca fica com menos de dois itens embaixo

  while (fila.length) {
    var bloco = fila.shift();
    // quebra pedida pelo JSON: reproduz a virada de pagina do impresso
    // original. So vale se a pagina ja tem algo — senao abre pagina em branco.
    if (bloco.dataset.quebra && corpo.children.length) {
      pag = novaPagina(); corpo = pag.querySelector('.corpo');
    }
    corpo.appendChild(bloco);
    if (cabe(pag)) continue;

    var itens = [].slice.call(bloco.querySelectorAll(':scope > .item'));
    var movidos = [];
    while (!cabe(pag) && itens.length > MINIMO) {
      var ultimo = itens.pop();
      bloco.removeChild(ultimo);
      movidos.unshift(ultimo);
    }

    if (!cabe(pag)) {
      movidos.forEach(function (el) { bloco.appendChild(el); });
      if (corpo.children.length > 1) {
        corpo.removeChild(bloco);
        fila.unshift(bloco);
      }
      pag = novaPagina(); corpo = pag.querySelector('.corpo');
      continue;
    }

    if (movidos.length) {
      var sobra = clonarCabeca(bloco);
      movidos.forEach(function (el) { sobra.appendChild(el); });
      fila.unshift(sobra);
    }
    pag = novaPagina(); corpo = pag.querySelector('.corpo');
  }

  var ultima = destino.lastElementChild;
  if (ultima && !ultima.querySelector('.corpo').children.length) destino.removeChild(ultima);
  origem.remove();
  document.documentElement.dataset.paginado = destino.children.length;
  var estourou = [].slice.call(destino.children)
    .map(function (pg, i) { return cabe(pg) ? 0 : i + 1; })
    .filter(Boolean);
  document.documentElement.dataset.estouro = estourou.join(',');
});
<\/script>`;

let fontes = '';
try { fontes = await ler('cardapios/_fontes-bebidas.css'); }
catch { fontes = '/* rode scripts/gerar-fontes.mjs --bebidas e gere de novo */'; }
const layout = await ler('cardapios/_bebidas.css');

await writeFile(join(RAIZ, 'cardapios/kikiu-bebidas-impressao.html'),
`<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<title>Cardápio — Kikiu Gastrobar — impressão</title>
<!-- GERADO por scripts/build-cardapio-bebidas.mjs a partir de
     cardapios/kikiu-bebidas.json. Não editar à mão: a próxima execução
     sobrescreve. Layout em cardapios/_bebidas.css; conteúdo no JSON. -->
<style>
/* Fontes embutidas: o PDF precisa carregar sozinho na gráfica, sem internet. */
${fontes}</style>
<style>
${layout}</style>
</head>
<body>

${capa}

${miolo}

${contracapa}

${scriptPaginador}
</body>
</html>
`);

// ═══ 2. a pagina do QR code da mesa ════════════════════════════════════
const secoesQR = dados.blocos.map(b => {
  const itens = [];
  for (const g of b.grupos) {
    if (!g.itens.length) continue;        // grupo vazio nao vira subtitulo solto
    if (g.titulo) itens.push({ divisor: g.titulo });
    for (const it of g.itens) {
      itens.push({
        nome: it.nome, sub: it.sub,
        desc: it.ingredientes,
        nota: it.garrafa ? `${brl(it.garrafa)} a garrafa` : it.perfil ? `(${it.perfil})` : null,
        preco: it.preco ?? b.precoUnico,
        foto: it.foto ? `/assets/img/drinks/${it.foto}` : null,
      });
    }
  }
  return { id: idDe(b.titulo), titulo: b.titulo, nota: b.notaPreco, itens };
});

await writeFile(join(RAIZ, 'bebidas.html'), paginaCardapio({
  casa: 'Kikiu Gastrobar', titulo: 'Cardápio', endereco: dados.endereco,
  // Chopp em dobro e SEGUNDA E TERCA, e so. O Double Chopp existe no PDV mas
  // nao entra como linha fixa do cardapio: item fixo diz "sempre", e nos
  // outros cinco dias o cliente cobraria na mesa. Aqui a promocao aparece
  // na capa, nos dois dias em que vale, pelo relogio DA CASA — 1 e segunda,
  // 2 e terca.
  promo: {
    dias: [1, 2],
    fuso: 'America/Cuiaba',
    texto: 'Hoje é chopp em dobro — pediu um, vêm dois. A noite inteira.',
  },
  // a marca abre e fecha a pagina: a mesma taca da fachada e do impresso
  logo: {
    src: '/assets/img/logos/web/kikiu-escuro.png',
    alt: 'Kikiu Gastrobar', largura: 180, altura: 58,
  },
  icone: { aba: '/assets/img/icone/kikiu-32.png', inicio: '/assets/img/icone/kikiu-180.png' },
  descricao: 'Cardápio do Kikiu Gastrobar — cozinha, lanches, coquetelaria autoral da Casa Pro, cervejas, destilados, sucos e sobremesas, no Shopping Três Américas, Cuiabá.',
  gerador: 'scripts/build-cardapio-bebidas.mjs',
  fontes: 'https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Poppins:wght@400;600;700&display=swap',
  rodape: 'Preços sujeitos a alteração. Venda de bebida alcoólica proibida para menores de 18 anos.',
  tema: {
    papel: '#fbf7f2', tinta: '#171412', suave: '#6d6560', marca: '#e0402c',
    fio: '#e6ded5', barra: '#161311', sobreBarra: '#fbf7f2',
    display: '"Abril Fatface", Georgia, serif',
    texto: '"Poppins", -apple-system, sans-serif',
    pesoDisplay: 400,
    arco: '50% 50% 4px 4px / 34% 34% 4px 4px',
    logoAltura: 58,
  },
  secoes: secoesQR,
  jsonld: {
    '@context': 'https://schema.org', '@type': 'Menu', name: 'Cardápio Kikiu Gastrobar',
    hasMenuSection: dados.blocos.map(b => ({
      '@type': 'MenuSection', name: b.titulo,
      hasMenuItem: b.grupos.flatMap(g => g.itens.map(it => ({
        '@type': 'MenuItem', name: it.nome,
        ...(it.ingredientes ? { description: it.ingredientes } : {}),
        offers: { '@type': 'Offer', price: (it.preco ?? b.precoUnico).toFixed(2), priceCurrency: 'BRL' },
      }))),
    })),
  },
}));
console.log('   -> bebidas.html (pagina do QR code)');

const total = dados.blocos.reduce((n, b) => n + b.grupos.reduce((m, g) => m + g.itens.length, 0), 0);
const conferir = dados.blocos.flatMap(b => b.grupos.flatMap(g =>
  g.itens.filter(i => i.conferir).map(i => `${b.titulo}${g.titulo ? ' / ' + g.titulo : ''}: ${i.nome} — ${i.conferir}`)));

console.log(`OK Bebidas — ${dados.blocos.length} secoes, ${total} itens`);
console.log(`   -> cardapios/kikiu-bebidas-impressao.html (paginado no navegador)`);
if (conferir.length) {
  console.log(`\n   ${conferir.length} itens marcados para conferencia antes de imprimir:`);
  for (const c of conferir) console.log(`     - ${c}`);
}
