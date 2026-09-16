#!/usr/bin/env node
/**
 * sync-cardapio.mjs — o cardapio dos sites sai do Saipos.
 *
 *   node scripts/sync-cardapio.mjs
 *
 * A regra do projeto: NINGUEM cadastra prato no site. A casa cadastra no PDV,
 * que e onde ela ja cadastra de qualquer jeito para vender, e o site se
 * atualiza sozinho. Se algum dia alguem precisar abrir um HTML para mudar um
 * preco, esta integracao falhou.
 *
 * Hoje o Saipos tem uma loja so ("Forneato/ Saiko/ Kikiu") com o catalogo do
 * bar. Quando o japones e o italiano abrirem e ganharem categorias la, elas
 * caem sozinhas no site certo pelo ROTEAMENTO abaixo — sem tocar em HTML.
 *
 * Casa sem categoria nenhuma e PULADA: o site dela mantem intacto o cardapio
 * escrito a mao. Nada e apagado por engano.
 *
 * Sem dependencias — Node 18+ (fetch nativo).
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://delivery-api.saipos.com/v1';
const DOMINIO_SAIPOS = 'forneatosaikokikiu.saipos.com';
const CDN = 'https://static.saipos.com';

// ===========================================================================
// ROTEAMENTO — a unica coisa que se mexe quando o cardapio do PDV cresce.
//
// Cada casa tem regioes; cada regiao corresponde a um par de marcadores
// <!-- SAIPOS:<marca>:INICIO --> no HTML. A primeira casa cujo padrao bate
// leva a categoria. O que nao bate em ninguem vai para a casa padrao, e o
// script avisa no fim para alguem classificar.
// ===========================================================================
/** A carta de vinhos e do Forneatto, nao do bar.
 *
 * Ate 15/09 o vinho caia no Kikiu por ACIDENTE: o Kikiu e a casa padrao
 * ('pega: null'), entao tudo que nenhum padrao reconhece termina nele — e
 * nenhum padrao reconhecia 'Vinho Tinto'. Resultado: 40 rotulos, ate um
 * Barolo de R$ 1.090, listados na pagina do gastrobar, enquanto a secao
 * 'La cantina' do italiano, feita para eles, ficava sem um rotulo sequer.
 * O dono confirmou em 15/09: o vinho e do Forneatto.
 */
const VINHOS_FORNEATTO = [
  'Vinho Tinto', 'Vinho Branco', 'Vinhos Meias garrafas',
  'ESPUMANTES', 'CHAMPAGNE',
];

/** Categorias do Kikiu que sao comida; o resto do catalogo dele e bebida. */
const COZINHA_KIKIU = [
  'PETISCOS & BOTECARIA — PASTÉIS',
  'PETISCOS & BOTECARIA — CROQUETES',
  'PETISCOS',
  'ESPECIAIS',
  'STEAKS & CHAPAS',
];

const CASAS = [
  {
    id: 'saiko',
    nome: 'Saiko',
    arquivo: 'japones/index.html',
    json: 'assets/data/cardapio-saiko.json',
    // o site do japones usa outras classes; sem isto o bloco injetado sai sem estilo
    markup: { grupo: 'course', cabeca: 'course__head', vazioCabeca: '<span class="course__jp"></span>',
              item: 'dish', vazioItem: '<span class="dish__jp"></span>', nome: 'dish__name',
              preco: 'dish__price', desc: 'dish__desc', etiqueta: 'chip',
              foto: 'dish__foto', comFoto: 'dish--foto' },
    pega: [/sushi/i, /sashimi/i, /nig[u]?iri/i, /temaki/i, /uramaki/i, /hossomaki/i,
           /combinado/i, /yakisoba/i, /ramen/i, /teppan/i, /oriental/i, /japon/i],
    regioes: [{ marca: 'MENU', leva: () => true }],
    // O Saiko NAO recebe o bloco de HTML — so o retrato em JSON.
    //
    // O cardapio dele e tambem o PDF da grafica, e carrega o que o PDV nao
    // tem: 11 secoes, o kanji de cada uma, as descricoes escritas a mao e as
    // 35 fotos dos pratos. No PDV e UMA categoria ("Saiko cozinha oriental")
    // com 47 itens: injetar isso aqui achata 11 secoes em 1 — testado em
    // 15/09, acontece, e a Action roda sozinha a cada 6 horas.
    //
    // Quem atualiza o preco do Saiko e o sync-precos.mjs saiko, que casa item
    // a item e mexe SO no preco. A fonte continua sendo o saiko.json.
    soPreco: true,
  },
  {
    id: 'forneatto',
    nome: 'Forneatto Cucina',
    arquivo: 'italiano/index.html',
    json: 'assets/data/cardapio-forneatto.json',
    markup: { grupo: 'portata', cabeca: 'portata__head', vazioCabeca: '', item: 'piatto',
              vazioItem: '', nome: 'piatto__nome', preco: 'piatto__prezzo', desc: 'piatto__desc',
              etiqueta: 'bollo', foto: 'piatto__foto', comFoto: 'piatto--foto' },
    pega: [/pizza/i, /massa/i, /pasta/i, /lasanha/i, /nhoque/i, /risoto/i,
           /antipast/i, /dolci/i, /italian/i, /forno/i,
           /^vinho/i, /^espumante/i, /^champagne/i],
    regioes: [
      { marca: 'VINHOS', leva: cat => VINHOS_FORNEATTO.includes(cat), porPreco: true },
      { marca: 'MENU', leva: () => true },
    ],
    // a carta comeca no tinto e termina no champagne, nao em ordem alfabetica
    ordem: ['Vinho Tinto', 'Vinho Branco', 'Vinhos Meias garrafas',
            'ESPUMANTES', 'CHAMPAGNE'],
  },
  {
    id: 'kikiu',
    nome: 'Kikiu Gastro Bar',
    arquivo: 'bar/index.html',
    json: 'assets/data/cardapio-kikiu.json',
    markup: { grupo: 'familia', cabeca: 'familia__head', vazioCabeca: '', item: 'item',
              vazioItem: '', nome: 'item__nome', preco: 'item__preco', desc: 'item__desc',
              etiqueta: 'base', foto: 'item__foto', comFoto: 'item--foto' },
    pega: null,                     // null = casa padrao, fica com o resto
    regioes: [
      { marca: 'COZINHA', leva: cat => COZINHA_KIKIU.includes(cat) },
      { marca: 'BAR', leva: () => true },
    ],
    // ordem em que as bebidas aparecem; o que nao estiver aqui entra no fim
    ordem: [
      'Drinks Casa Pro', 'Caipirinhas', 'Caipiroska', 'Vodkas/Gin',
      'Digestivos/Doses', 'Tequila', 'Combos/Bar', 'Cerveja 600ml', 'Long Neck',
      'Vinho Tinto', 'Vinho Branco', 'ESPUMANTES', 'CHAMPAGNE',
      'Vinhos Meias garrafas', 'Sucos Especiais', 'Sucos', 'Bebidas',
    ],
  },
];

// === utilidades ============================================================

/** O catalogo e digitado no balcao e vem sujo: quebra de linha presa no nome
 *  da categoria, espaco sobrando no fim. Sem limpar, cada variacao vira uma
 *  categoria diferente. \s+ ja cobre \r, \n e tabulacao. */
const limpar = s => String(s ?? '').replace(/\s+/g, ' ').trim();

/** "caipirinha de Maracuja" -> "Caipirinha de Maracuja". */
const arrumarCaixa = s => {
  const t = limpar(s);
  if (!t) return t;
  const base = t === t.toUpperCase() && /[A-ZÀ-Ý]{3}/.test(t) ? t.toLowerCase() : t;
  return base.charAt(0).toUpperCase() + base.slice(1);
};

const brl = n => Number.isInteger(n)
  ? `R$ ${n.toLocaleString('pt-BR')}`
  : `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

const escapar = s => String(s ?? '')
  .replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

async function buscar(url) {
  const r = await fetch(url, { headers: { Accept: 'application/json', Origin: `https://${DOMINIO_SAIPOS}` } });
  if (!r.ok) throw new Error(`${r.status} ${r.statusText} em ${url}`);
  return r.json();
}

// === 1. descobrir a loja ===================================================
// is_table_module:true e OBRIGATORIO — sem ele a API devolve [] com status 200
async function acharLoja() {
  const filtro = encodeURIComponent(JSON.stringify({ domain_name: DOMINIO_SAIPOS, is_table_module: true }));
  const lojas = await buscar(`${API}/stores?filter=${filtro}`);
  if (!Array.isArray(lojas) || !lojas.length) throw new Error(`nenhuma loja em ${DOMINIO_SAIPOS} — o dominio mudou?`);
  return lojas[0];
}

// === 2. baixar e normalizar ================================================
async function baixarCategorias(idStore) {
  const dados = await buscar(`${API}/stores/${idStore}/sales/view-data?filter=%7B%7D`);
  const porCategoria = new Map();

  for (const item of dados.items ?? []) {
    const cat = item.category_item;
    if (!cat || cat.enabled === 'N') continue;

    const variacoes = (item.variations ?? [])
      .filter(v => v.enabled !== 'N' && typeof v.price === 'number')
      .map(v => ({ nome: limpar(v.variation?.desc_store_variation), preco: v.price }));
    if (!variacoes.length) continue;

    const chave = limpar(cat.desc_store_category_item);
    if (!porCategoria.has(chave)) porCategoria.set(chave, { nome: chave, ordem: cat.order ?? 99, itens: [] });
    porCategoria.get(chave).itens.push({
      id: item.id_store_item,
      nome: arrumarCaixa(item.desc_store_item),
      descricao: limpar(item.detail),
      ordem: item.order ?? 0,
      // o PDV guarda a foto do prato; ?d=x250 e o redimensionamento do proprio Saipos
      foto: item.img_path ? `${CDN}/${item.img_path}?d=x250` : null,
      variacoes,
    });
  }

  for (const c of porCategoria.values()) {
    c.itens.sort((a, b) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'));
  }
  return [...porCategoria.values()];
}

// === 3. rotear categoria -> casa -> regiao =================================
function rotear(categorias) {
  const padrao = CASAS.find(c => c.pega === null) ?? CASAS[CASAS.length - 1];
  const mapa = new Map(CASAS.map(c => [c.id, { casa: c, regioes: new Map(c.regioes.map(r => [r.marca, []])) }]));
  const semDono = [];

  for (const cat of categorias) {
    let casa = CASAS.find(c => c.pega?.some(re => re.test(cat.nome)));
    if (!casa) { casa = padrao; semDono.push(cat.nome); }
    const destino = mapa.get(casa.id);
    const regiao = casa.regioes.find(r => r.leva(cat.nome)) ?? casa.regioes[casa.regioes.length - 1];
    destino.regioes.get(regiao.marca).push(cat);
  }

  // A loja no Saipos e UMA so para as tres casas do grupo, e a tabela CASAS
// acima e a regra que separa as categorias entre elas. Este repositorio e de
// uma casa: classifica tudo (senao a regra muda) e escreve so a sua.
const SO_ESTA_CASA = 'kikiu';

for (const { casa, regioes } of mapa.values()) {
  if (casa.id !== SO_ESTA_CASA) continue;
    for (const [marca, lista] of regioes) {
      const pos = nome => { const i = (casa.ordem ?? []).indexOf(nome); return i === -1 ? 1e6 : i; };
      lista.sort((a, b) =>
        pos(a.nome) - pos(b.nome) || a.ordem - b.ordem || a.nome.localeCompare(b.nome, 'pt-BR'));

      // Carta de vinhos se le do mais barato para o mais caro: e assim que a
      // pessoa procura. O PDV entrega na ordem em que foram cadastrados, que
      // num tinto ia 135 -> 360 -> 200 -> 170 -> 1.090 -> 149.
      if (casa.regioes.find(r => r.marca === marca)?.porPreco) {
        const menor = it => Math.min(...it.variacoes.map(v => v.preco));
        for (const cat of lista) cat.itens.sort((a, b) => menor(a) - menor(b));
      }
    }
  }
  return { mapa, semDono };
}

// === 4. render =============================================================
function renderCategoria(cat, m) {
  const linhas = cat.itens.map(item => {
    const unica = item.variacoes.length === 1;
    const precos = item.variacoes.map(v => v.preco);
    const preco = unica ? brl(precos[0]) : `a partir de ${brl(Math.min(...precos))}`;

    // "Unico" e ruido do PDV; variacao de verdade vira etiqueta
    const etiquetas = unica && /^(único|unico|padrão|padrao)$/i.test(item.variacoes[0].nome)
      ? ''
      : item.variacoes.map(v => ` <span class="${m.etiqueta}">${escapar(arrumarCaixa(v.nome))}</span>`).join('');

    const desc = item.descricao ? `\n            <p class="${m.desc}">${escapar(item.descricao)}</p>` : '';
    const primeira = item.foto
      ? `<img class="${m.foto}" src="${escapar(item.foto)}" alt="${escapar(item.nome)}" loading="lazy">`
      : m.vazioItem;
    const classe = item.foto ? `${m.item} ${m.comFoto}` : m.item;
    return `          <div class="${classe}">${primeira ? `\n            ${primeira}` : ''}
            <p class="${m.nome}">${escapar(item.nome)}${etiquetas}</p>
            <span class="${m.preco}">${preco}</span>${desc}
          </div>`;
  });

  const n = cat.itens.length;
  return `        <div class="${m.grupo}">
          <div class="${m.cabeca}">${m.vazioCabeca}<h3>${escapar(arrumarCaixa(cat.nome))}</h3><span>${n} ${n === 1 ? 'opção' : 'opções'}</span></div>
${linhas.join('\n')}
        </div>`;
}

/** Duas colunas equilibradas pelo numero de itens, nao pelo de categorias. */
function emDuasColunas(categorias, m) {
  const cols = [[], []];
  const peso = [0, 0];
  for (const c of categorias) {
    const i = peso[0] <= peso[1] ? 0 : 1;
    cols[i].push(c); peso[i] += c.itens.length + 2;
  }
  return cols.map(col => `      <div>\n${col.map(c => renderCategoria(c, m)).join('\n')}\n      </div>`).join('\n');
}

/** schema.org/Menu — a pagina do Saipos e noindex, entao e AQUI que o Google
 *  consegue ler o cardapio e os precos da casa. */
function renderJsonLd(nomeCasa, categorias) {
  const menu = {
    '@context': 'https://schema.org',
    '@type': 'Menu',
    name: `Cardapio do ${nomeCasa}`,
    inLanguage: 'pt-BR',
    hasMenuSection: categorias.map(cat => ({
      '@type': 'MenuSection',
      name: arrumarCaixa(cat.nome),
      hasMenuItem: cat.itens.map(item => ({
        '@type': 'MenuItem',
        name: item.nome,
        ...(item.descricao ? { description: item.descricao } : {}),
        offers: item.variacoes.map(v => ({ '@type': 'Offer', price: v.preco.toFixed(2), priceCurrency: 'BRL' })),
      })),
    })),
  };
  return `<script type="application/ld+json">\n${JSON.stringify(menu, null, 2)}\n<\/script>`;
}

function injetar(html, marca, conteudo) {
  const ini = `<!-- SAIPOS:${marca}:INICIO -->`;
  const fim = `<!-- SAIPOS:${marca}:FIM -->`;
  const re = new RegExp(`${ini}[\\s\\S]*?${fim}`);
  if (!re.test(html)) throw new Error(`marcadores SAIPOS:${marca} nao encontrados`);
  return html.replace(re, `${ini}\n${conteudo}\n      ${fim}`);
}

// === principal =============================================================
const loja = await acharLoja();
const categorias = await baixarCategorias(loja.id_store);
const { mapa, semDono } = rotear(categorias);
const falhas = [];

const cidade = loja.district?.city;
const carimbo = new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });

console.log(`OK ${loja.trade_name} (loja ${loja.id_store}) — ${cidade?.desc_city}/${cidade?.state?.short_desc_state}`);
console.log(`   ${categorias.length} categorias no Saipos\n`);

for (const { casa, regioes } of mapa.values()) {
  const todas = [...regioes.values()].flat();
  if (!todas.length) {
    console.log(`  - ${casa.nome}: sem categoria no Saipos — site intocado (cardapio escrito a mao)`);
    continue;
  }

  await mkdir(join(RAIZ, 'assets/data'), { recursive: true });
  await writeFile(join(RAIZ, casa.json), JSON.stringify({
    gerado_em: new Date().toISOString(),
    fonte: `${API}/stores/${loja.id_store}/sales/view-data`,
    loja: {
      id_store: loja.id_store,
      nome: loja.trade_name,
      endereco: [loja.address, loja.address_number, loja.address_complement].filter(Boolean).join(', '),
      bairro: loja.district?.desc_district ?? null,
      cidade: cidade?.desc_city ?? null,
      uf: cidade?.state?.short_desc_state ?? null,
      pedido_online_ativo: loja.table_data?.online_order_enabled ?? false,
    },
    cardapio: Object.fromEntries([...regioes].map(([m, c]) => [m.toLowerCase(), c])),
  }, null, 2) + '\n');

  if (casa.soPreco) {
    console.log(`  - ${casa.nome}: ${todas.length} categorias -> so o retrato em ${casa.json}`);
    console.log(`    site e impresso saem do cardapios/saiko.json; para o preco:`);
    console.log(`    node scripts/sync-precos.mjs saiko`);
    continue;
  }

  // marcador faltando numa casa nao pode derrubar a sincronizacao das outras
  try {
    let html = await readFile(join(RAIZ, casa.arquivo), 'utf8');
    for (const [marca, lista] of regioes) html = injetar(html, marca, emDuasColunas(lista, casa.markup));
    html = injetar(html, 'JSONLD', renderJsonLd(casa.nome, todas));
    html = html.replace(/(<span id="carimbo-cardapio">)[\s\S]*?(<\/span>)/, `$1${carimbo}$2`);
    await writeFile(join(RAIZ, casa.arquivo), html);
  } catch (erro) {
    falhas.push(`${casa.nome}: ${erro.message}`);
    console.log(`  ! ${casa.nome}: HTML nao atualizado (${erro.message}) — JSON gravado assim mesmo`);
    continue;
  }

  const detalhe = [...regioes].map(([m, c]) => `${m.toLowerCase()} ${c.reduce((n, x) => n + x.itens.length, 0)}`).join(' + ');
  const comFoto = todas.reduce((n, c) => n + c.itens.filter(i => i.foto).length, 0);
  const itens = todas.reduce((n, c) => n + c.itens.length, 0);
  console.log(`  - ${casa.nome}: ${todas.length} categorias (${detalhe}) -> ${casa.arquivo}`);
  console.log(`    fotos no PDV: ${comFoto} de ${itens} pratos`);
}

console.log(`\n   atualizado em ${carimbo}`);
// A casa padrao e catch-all por design, entao "sem dono" so interessa quando a
// categoria tambem e desconhecida — sinal de que alguem criou algo novo no PDV
// e ninguem disse a qual das tres casas pertence.
const padraoKikiu = CASAS.find(c => c.pega === null);
const conhecidas = new Set([...COZINHA_KIKIU, ...(padraoKikiu?.ordem ?? [])]);
const novas = [...new Set(semDono)].filter(n => !conhecidas.has(n));
if (novas.length) {
  console.log(`\n   CATEGORIA NOVA no PDV, caiu no ${padraoKikiu?.nome} por falta de regra:`);
  for (const n of novas) console.log(`     - ${n}`);
  console.log(`     Se for do Saiko ou do Forneatto, acrescente um padrao em CASAS[].pega.`);
  console.log(`     Se for bebida do Kikiu, acrescente o nome em CASAS[kikiu].ordem para posicionar.`);
}
if (!(loja.table_data?.online_order_enabled)) {
  console.log('\n   AVISO: pedido online DESLIGADO no Saipos — o cardapio e vitrine, nao aceita pedido.');
}

if (falhas.length) {
  console.error(`\nERRO: ${falhas.length} casa(s) nao atualizada(s):`);
  for (const f of falhas) console.error(`  - ${f}`);
  process.exitCode = 1;
}
