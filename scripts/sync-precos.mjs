#!/usr/bin/env node
/**
 * sync-precos.mjs — puxa do Saipos SÓ o preço, nos dois cardápios nossos.
 *
 *   node scripts/sync-precos.mjs                    # os dois, só mostra
 *   node scripts/sync-precos.mjs saiko --aplicar
 *   node scripts/sync-precos.mjs bebidas --aplicar
 *
 * Os dois cardápios escritos à mão (o do japonês e o de bebidas do Kikiu) são
 * também PDF de gráfica: carregam seção, kanji, descrição, foto e ordem, que o
 * PDV não tem. Então o PDV manda em uma coisa só — preço — e o resto fica.
 *
 * (O cardápio de cozinha do Kikiu é outro caso: lá o PDV é a fonte inteira e
 * quem cuida é o sync-cardapio.mjs.)
 *
 * ── Por que existe um MAPA DE CATEGORIA e não um casamento por nome ────────
 *
 * Casar só pelo nome dá errado de um jeito caro. No PDV do Kikiu:
 *
 *   [Digestivos/Doses] Chivas Regal (12 anos) dose ......  R$  30   <- a dose
 *   [Combos/Bar]       Chivas Regal 12 anos ............  R$ 360   <- a garrafa
 *   [Caipiroska]       caipiroska de Abacaxi com Hotelã .  R$  34
 *   [Sucos]            Abacaxi com Hortelã ..............  R$  16   <- o suco
 *
 * Um casamento ingênuo põe R$ 360 na dose de whisky e R$ 16 na caipiroska.
 * Por isso cada grupo nosso só procura dentro das categorias do PDV que
 * correspondem a ele, e as garrafas vêm de uma lista à parte.
 *
 * ── E por que o casamento é por TOKEN ──────────────────────────────────────
 *
 * A casa digita o nome de um jeito a cada item, com erro de digitação junto:
 *
 *   "Jhonnie Walker Red Label ( Dose )"   <- nosso: Johnnie Walker Red Label
 *   "caipiroska de Abacaxi com Hotelã"    <- Hortelã sem o R
 *   "Glenliddich 12 anos Dose"            <- Glenfiddich
 *   "Cachaça Branca Dose/Sagatiba"        <- nosso: Cachaça branca
 *
 * Comparação exata não resolve nada disso. Então o nome vira conjunto de
 * palavras e ganha quem tem mais palavras em comum — com margem sobre o
 * segundo colocado, senão é sorteio.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://delivery-api.saipos.com/v1';
const DOMINIO = 'forneatosaikokikiu.saipos.com';
const APLICAR = process.argv.includes('--aplicar');
const PEDIDOS = process.argv.slice(2).filter(a => !a.startsWith('--'));

// ── normalização ──────────────────────────────────────────────────────────
/** Palavras que só dizem formato/embalagem e atrapalham o casamento. */
const RUIDO = new Set([
  'dose', 'doses', 'long', 'neck', 'longneck', 'lata', 'copo', 'garrafa',
  'ml', 'l', 'litro', 'un', 'unidade', 'unidades', 'pecas', 'peca', 'anos',
  'ano', 'de', 'do', 'da', 'com', 'e', 'a', 'o', 'the',
]);

const semAcento = s => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
/** k vira c: a casa escreve Usuzucuri onde o cardápio tem Usuzukuri. */
const chave = s => semAcento(s).replace(/k/g, 'c').replace(/[^a-z0-9]+/g, '');

function tokens(s) {
  return new Set(
    semAcento(s)
      .replace(/k/g, 'c')
      .replace(/[^a-z0-9]+/g, ' ')
      .split(' ')
      .filter(t => t.length >= 2 && !RUIDO.has(t) && !/^\d+$/.test(t))
  );
}

/** Assinatura do nome: as palavras que importam, em ordem. "Pepsi Lata" e
 *  "Pepsi" têm a mesma — é o que faz sufixo de embalagem parar de atrapalhar. */
const assinatura = s => [...tokens(s)].sort().join(' ');

/** Distância de edição, cortando cedo: só interessa saber se é <= 2. */
function distancia(a, b) {
  if (Math.abs(a.length - b.length) > 2) return 99;
  let linha = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const nova = [i];
    for (let j = 1; j <= b.length; j++) {
      nova[j] = Math.min(linha[j] + 1, nova[j - 1] + 1, linha[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    linha = nova;
  }
  return linha[b.length];
}

/** Duas palavras são "a mesma" se forem iguais ou quase: o PDV tem
 *  Glenliddich por Glenfiddich, caipinha por caipirinha, Hotelã por Hortelã,
 *  Wiskey por Whiskey. Só vale de 5 letras para cima — abaixo disso duas
 *  letras de diferença já é outra palavra. */
function mesmaPalavra(a, b) {
  if (a === b) return true;
  return Math.min(a.length, b.length) >= 5 && distancia(a, b) <= 2;
}

/** Quanto dois nomes se parecem, de 0 a 1 (palavras em comum / menor conjunto). */
function parecenca(a, b) {
  const A = [...tokens(a)], B = [...tokens(b)];
  if (!A.length || !B.length) return 0;
  const sobrando = [...B];
  let comuns = 0;
  for (const t of A) {
    const i = sobrando.findIndex(u => mesmaPalavra(t, u));
    if (i >= 0) { comuns++; sobrando.splice(i, 1); }
  }
  return comuns / Math.min(A.length, B.length);
}

/**
 * Escolhe entre candidatos. Exige nota mínima E margem sobre o segundo:
 * empate é sorteio, e sorteio em preço é pior que preço velho.
 */
function melhor(nome, candidatos, { minimo = 0.6, margem = 0.15 } = {}) {
  // nome idêntico vale 2, fora da escala: senão "Pipoca de Camarão" empata
  // em 1,0 com "Camarão" (todas as palavras de um cabem no outro) e a regra
  // de margem descarta os dois — justo o caso em que não há dúvida nenhuma.
  const assinAlvo = assinatura(nome);
  const notas = candidatos
    .map(c => ({ c, nota: assinatura(c.nome) === assinAlvo ? 2 : parecenca(nome, c.nome) }))
    .sort((x, y) => y.nota - x.nota);
  if (!notas.length || notas[0].nota < minimo) return null;
  if (notas[1] && notas[0].nota - notas[1].nota < margem) {
    // Empate real: "Gin Kamai Dose" serve ao Kamai do gin e ao da vodca, que
    // se chamam igual. Desempata quem tem o nome do grupo escrito no item do
    // PDV; sem isso, fica sem casar mesmo — chute em preço não.
    const empatados = notas.filter(n => notas[0].nota - n.nota < margem);
    const T = tokens(nome);
    const comGrupo = empatados.filter(n => [...tokens(n.c.grupo ?? '')].some(g => [...T].some(t => mesmaPalavra(t, g))));
    return comGrupo.length === 1 ? comGrupo[0].c : null;
  }
  return notas[0].c;
}

const brl = n => `R$ ${Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// ── Saipos ────────────────────────────────────────────────────────────────
const buscar = async url => {
  const r = await fetch(url, { headers: { Accept: 'application/json', Origin: `https://${DOMINIO}` } });
  if (!r.ok) throw new Error(`Saipos respondeu ${r.status}`);
  return r.json();
};

async function baixarPdv() {
  const filtro = encodeURIComponent(JSON.stringify({ domain_name: DOMINIO, is_table_module: true }));
  const lojas = await buscar(`${API}/stores?filter=${filtro}`);
  if (!lojas.length) throw new Error('nenhuma loja no Saipos para este domínio');
  const dados = await buscar(`${API}/stores/${lojas[0].id_store}/sales/view-data?filter=%7B%7D`);
  const porCategoria = new Map();
  for (const item of dados.items ?? []) {
    const cat = item.category_item;
    if (!cat || cat.enabled === 'N') continue;
    const v = (item.variations ?? []).find(x => x.enabled !== 'N' && typeof x.price === 'number');
    if (!v) continue;
    const nomeCat = String(cat.desc_store_category_item).replace(/\s+/g, ' ').trim();
    if (!porCategoria.has(nomeCat)) porCategoria.set(nomeCat, []);
    porCategoria.get(nomeCat).push({ nome: String(item.desc_store_item).replace(/\s+/g, ' ').trim(), preco: v.price });
  }
  return porCategoria;
}

// ── alvo 1: o cardápio do japonês ─────────────────────────────────────────
// No PDV é UMA categoria ("Saiko cozinha oriental") e a seção vem dentro do
// nome do item: "(Uramaki) Saiko Roll 8 un.". Então aqui a categoria do PDV
// não ajuda — quem separa é o prefixo.
function alvoSaiko(pdv) {
  const itens = [];
  for (const [cat, lista] of pdv) {
    if (!/oriental/i.test(cat)) continue;
    for (const it of lista) {
      const m = it.nome.match(/^\(\s*([^)]+?)\s*\)\s*(.+)$/);
      itens.push({ secao: m ? m[1] : null, nome: (m ? m[2] : it.nome).replace(/[\s(]*\d+\s*(?:un\.?|unidades?|pe[çc]as?)\)?\s*$/i, '').trim(), preco: it.preco, bruto: it.nome });
    }
  }
  return {
    caminho: 'cardapios/saiko.json',
    itens,
    /** devolve [{ grupo, item, preco, candidatos }] do nosso lado */
    nossos(d) {
      return d.secoes.flatMap(s => s.itens.map(it => ({ grupo: s.titulo, nome: it.nome, item: it, campo: 'preco' })));
    },
    /** para cada item do PDV, quais dos nossos podem ser ele */
    candidatos(p, nossos) {
      if (!p.secao) return nossos;
      const dentro = nossos.filter(n => chave(n.grupo) === chave(p.secao));
      return dentro.length ? dentro : nossos;
    },
  };
}

// ── alvo 2: o menu de bebidas do Kikiu ────────────────────────────────────
// Aqui a categoria do PDV é tudo: é ela que separa a DOSE da GARRAFA e a
// caipiroska do suco de mesmo nome.
const MAPA_BEBIDAS = [
  { grupo: 'Chopp',           cats: ['Chopp'] },
  { grupo: 'Cerveja 600ml',   cats: ['Cerveja 600ml'] },
  { grupo: 'Long Neck',       cats: ['Long Neck'] },
  { bloco: 'Não-Alcoólicos',  cats: ['Bebidas'] },
  { grupo: 'Caipirinhas',     cats: ['Caipirinhas'] },
  { grupo: 'Caipiroskas',     cats: ['Caipiroska'] },
  { grupo: 'Cachaças',        cats: ['Digestivos/Doses'] },
  { grupo: 'Whisky',          cats: ['Digestivos/Doses'] },
  { grupo: 'Vodka',           cats: ['Vodkas/Gin'] },
  { grupo: 'Gin',             cats: ['Vodkas/Gin'] },
  { grupo: 'Tequila',         cats: ['Tequila'] },
  { grupo: 'Digestivo',       cats: ['Digestivos/Doses'] },
  { grupo: 'Copo 300ml',      cats: ['Sucos'] },
  { grupo: 'Sucos especiais', cats: ['Sucos Especiais'] },
  { bloco: 'Drinks Casa Pro', cats: ['Drinks Casa Pro'] },
];
/** Onde ficam os preços de GARRAFA — nunca confundir com dose. */
const CATS_GARRAFA = ['Combos/Bar'];

function alvoBebidas(pdv) {
  return {
    caminho: 'cardapios/kikiu-bebidas.json',
    mapa: MAPA_BEBIDAS,
    pdv,
  };
}

// ── comparar e relatar ────────────────────────────────────────────────────
function comparar(nossoPreco, doPdv) {
  return Math.abs(Number(nossoPreco) - Number(doPdv)) > 0.001;
}

function imprimir(titulo, mudancas, semDono, soNosso) {
  console.log(`\n${'='.repeat(64)}\n${titulo}\n${'='.repeat(64)}`);
  console.log(`preço diferente: ${mudancas.length}  ·  no PDV e não no nosso: ${semDono.length}  ·  no nosso e não no PDV: ${soNosso.length}\n`);
  if (mudancas.length) {
    console.log('PRECOS QUE MUDARAM NO PDV:');
    for (const m of mudancas) console.log(`   ${m.grupo} / ${m.nome}${m.campo === 'garrafa' ? ' (garrafa)' : ''}: ${brl(m.de)} -> ${brl(m.para)}`);
  }
  if (semDono.length) {
    console.log('\nNO PDV E NAO NO NOSSO CARDAPIO — cadastrar se for para vender:');
    for (const p of semDono) console.log(`   [${p.cat}] ${p.nome}  ${brl(p.preco)}`);
  }
  if (soNosso.length) {
    console.log('\nNO NOSSO CARDAPIO E NAO NO PDV — conferir se saiu de linha:');
    for (const n of soNosso) console.log(`   ${n}`);
  }
}

// ── execução: japonês ─────────────────────────────────────────────────────
async function rodarSaiko(pdv) {
  const alvo = alvoSaiko(pdv);
  const caminho = join(RAIZ, alvo.caminho);
  const d = JSON.parse(await readFile(caminho, 'utf8'));
  const nossos = alvo.nossos(d);
  const usados = new Set(), mudancas = [], semDono = [];

  for (const p of alvo.itens) {
    const escolhido = melhor(p.nome, alvo.candidatos(p, nossos));
    if (!escolhido) { semDono.push({ cat: p.secao ?? 'sem seção', nome: p.bruto, preco: p.preco }); continue; }
    usados.add(escolhido.item);
    if (comparar(escolhido.item.preco, p.preco)) {
      mudancas.push({ grupo: escolhido.grupo, nome: escolhido.nome, de: escolhido.item.preco, para: p.preco, item: escolhido.item, campo: 'preco' });
    }
  }
  const soNosso = nossos.filter(n => !usados.has(n.item)).map(n => `${n.grupo} / ${n.nome}`);
  imprimir('SAIKO — cozinha oriental', mudancas, semDono, soNosso);
  return { caminho, d, mudancas };
}

// ── execução: bebidas ─────────────────────────────────────────────────────
async function rodarBebidas(pdv) {
  const caminho = join(RAIZ, 'cardapios/kikiu-bebidas.json');
  const d = JSON.parse(await readFile(caminho, 'utf8'));

  // indexa o nosso lado por grupo e por bloco
  const nossos = [];
  for (const bloco of d.blocos) {
    for (const g of bloco.grupos) {
      for (const it of g.itens) nossos.push({ bloco: bloco.titulo, grupo: g.titulo ?? bloco.titulo, nome: it.nome, item: it, blocoRef: bloco });
    }
  }

  const usados = new Set(), mudancas = [], semDono = [];

  // Uma categoria do PDV alimenta MAIS DE UM grupo nosso: "Digestivos/Doses"
  // tem cachaça, whisky e digestivo juntos. Varrer a categoria uma vez por
  // grupo fazia o mesmo item ser julgado três vezes — casava no primeiro
  // grupo e era relatado como "não achado" nos outros dois. Por isso agora
  // cada categoria junta os candidatos de todos os grupos que apontam para
  // ela, e cada item do PDV é visto UMA vez.
  const candidatosPorCat = new Map();
  for (const regra of MAPA_BEBIDAS) {
    const meus = nossos.filter(n => regra.grupo ? n.grupo === regra.grupo : n.bloco === regra.bloco);
    for (const cat of regra.cats) {
      if (!candidatosPorCat.has(cat)) candidatosPorCat.set(cat, []);
      candidatosPorCat.get(cat).push(...meus);
    }
  }

  for (const [cat, meus] of candidatosPorCat) {
    for (const p of pdv.get(cat) ?? []) {
      const escolhido = melhor(p.nome, meus.filter(m => !usados.has(m.item)));
      if (!escolhido) { semDono.push({ cat, nome: p.nome, preco: p.preco }); continue; }
      usados.add(escolhido.item);
      const nosso = escolhido.item.preco ?? escolhido.blocoRef.precoUnico;
      if (comparar(nosso, p.preco)) {
        mudancas.push({ grupo: escolhido.grupo, nome: escolhido.nome, de: nosso, para: p.preco, item: escolhido.item, campo: 'preco' });
      }
    }
  }

  // garrafas: categoria própria, e só para quem tem o campo no nosso cardápio
  const comGarrafa = nossos.filter(n => n.item.garrafa != null);
  const usadosGarrafa = new Set();
  for (const cat of CATS_GARRAFA) {
    for (const p of pdv.get(cat) ?? []) {
      const escolhido = melhor(p.nome, comGarrafa.filter(m => !usadosGarrafa.has(m.item)));
      if (!escolhido) { semDono.push({ cat, nome: p.nome, preco: p.preco }); continue; }
      usadosGarrafa.add(escolhido.item);
      if (comparar(escolhido.item.garrafa, p.preco)) {
        mudancas.push({ grupo: escolhido.grupo, nome: escolhido.nome, de: escolhido.item.garrafa, para: p.preco, item: escolhido.item, campo: 'garrafa' });
      }
    }
  }

  const catsUsadas = new Set([...candidatosPorCat.keys(), ...CATS_GARRAFA]);

  const soNosso = nossos.filter(n => !usados.has(n.item)).map(n => `${n.grupo} / ${n.nome}`);
  imprimir('KIKIU — menu de bebidas', mudancas, semDono, soNosso);

  const fora = [...pdv.keys()].filter(c => !catsUsadas.has(c));
  if (fora.length) console.log(`\nCategorias do PDV fora deste cardapio (${fora.length}): ${fora.join(', ')}`);
  return { caminho, d, mudancas };
}

// ── principal ─────────────────────────────────────────────────────────────
const pdv = await baixarPdv();
const quais = PEDIDOS.length ? PEDIDOS : ['saiko', 'bebidas'];
const resultados = [];
for (const q of quais) {
  if (q === 'saiko') resultados.push(await rodarSaiko(pdv));
  else if (q === 'bebidas') resultados.push(await rodarBebidas(pdv));
  else { console.error(`alvo desconhecido: ${q} (use saiko ou bebidas)`); process.exit(1); }
}

const total = resultados.reduce((n, r) => n + r.mudancas.length, 0);
console.log(`\n${'='.repeat(64)}`);
if (!APLICAR) {
  console.log(total
    ? `${total} preços para atualizar. Para gravar:  node scripts/sync-precos.mjs ${quais.join(' ')} --aplicar`
    : 'Nenhum preço para atualizar.');
} else if (total) {
  for (const r of resultados) {
    if (!r.mudancas.length) continue;
    for (const m of r.mudancas) m.item[m.campo] = m.para;
    await writeFile(r.caminho, JSON.stringify(r.d, null, 2) + '\n', 'utf8');
    console.log(`gravado: ${r.caminho.replace(RAIZ + '/', '')}`);
  }
  console.log('\nAgora rode os builds:');
  console.log('  node scripts/build-cardapio-saiko.mjs');
  console.log('  node scripts/build-cardapio-bebidas.mjs');
} else {
  console.log('Nenhum preço para atualizar.');
}
