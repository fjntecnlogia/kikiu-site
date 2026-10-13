#!/usr/bin/env node
/**
 * build-vinhos.mjs — a carta de vinhos, igual nas tres casas.
 *
 *   node scripts/build-vinhos.mjs
 *
 * Os vinhos moram num lugar so: o painel do Forneatto. As tres casas leem de
 * la, cada uma com o seu visual — trocou o preco ou tirou um rotulo no painel
 * e muda nas tres. A pagina nasce pronta (HTML, boa no Google) e o
 * cardapio-vivo.js a deixa em dia com o painel a cada abertura.
 *
 * Painel fora do ar ou resposta magra demais: NAO escreve nada. A carta que ja
 * esta no ar e melhor que uma carta vazia.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { paginaCardapio, idDe } from './pagina-cardapio.mjs';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
// Build-time, nunca no navegador: o visitante so ve /cardapio-api (rewrite).
const FONTE = 'https://api-painel.fjntecnologia.com.br/public/menu/forneatto';
const MINIMO = 10;   // piso de sanidade: menos que isso e resposta pela metade

const CASA = {
  nome: 'Kikiu Gastrobar', dominio: 'kikiu.com.br', imagens: 'bar',
  endereco: 'Shopping Três Américas · Cuiabá — MT',
  logo: { src: '/assets/img/logos/web/kikiu-escuro.png', alt: 'Kikiu Gastrobar', largura: 180, altura: 58 },
  icone: { aba: '/assets/img/icone/kikiu-32.png', inicio: '/assets/img/icone/kikiu-180.png' },
  fontes: 'https://fonts.googleapis.com/css2?family=Abril+Fatface&family=Poppins:wght@400;600;700&display=swap',
  extras: [{ texto: 'Cardápio', href: '/cardapio' }],
  tema: {
    papel: '#14100e', cartao: '#201a17', tinta: '#f7f1ea', suave: '#b3a89e',
    marca: '#e0402c', realce: '#f2a882', fio: '#322a25',
    barra: '#14100e', sobreBarra: '#f7f1ea',
    display: '"Abril Fatface", Georgia, serif',
    texto: '"Poppins", -apple-system, sans-serif',
    pesoDisplay: 400, arco: '50% 50% 4px 4px / 34% 34% 4px 4px', logoAltura: 58,
  },
};

/** Como a carta se chama na tela, e em que ordem a casa a le. */
const SECOES = [
  { chave: /espumante/i, titulo: 'Espumantes' },
  { chave: /champagne/i, titulo: 'Champagne' },
  { chave: /branco/i,    titulo: 'Brancos' },
  { chave: /tinto/i,     titulo: 'Tintos' },
  { chave: /meia/i,      titulo: 'Meias garrafas' },
];
const ehVinho = c => /vinho|espumante|champagne/i.test(c);

const r = await fetch(FONTE, { headers: { Accept: 'application/json' } });
if (!r.ok) throw new Error(`o painel respondeu ${r.status} — carta mantida como esta`);
const painel = await r.json();

const cats = (painel.categories ?? []).filter(c => ehVinho(c.category));
const total = cats.reduce((n, c) => n + c.items.length, 0);
if (total < MINIMO) {
  throw new Error(`o painel devolveu so ${total} rotulos (piso ${MINIMO}) — NAO escrevi nada`);
}

const rank = c => { const i = SECOES.findIndex(s => s.chave.test(c)); return i < 0 ? 99 : i; };
const secoes = cats
  .sort((a, b) => rank(a.category) - rank(b.category))
  .map(c => {
    const titulo = SECOES.find(s => s.chave.test(c.category))?.titulo ?? c.category;
    return {
      id: idDe(titulo), titulo, categoria: c.category,
      // do mais em conta ao mais caro: e assim que se escolhe vinho na mesa
      itens: [...c.items].sort((x, y) => x.price_cents - y.price_cents).map(i => ({
        nome: i.name,
        // "Uva: ... | Teor Alc.: 13%" vira uma linha so, sem a barra do PDV
        desc: (i.description ?? '').split('|').map(t => t.trim()).filter(Boolean).join(' · ') || null,
        preco: i.price_cents / 100,
        foto: i.image_url ?? null,
      })),
    };
  });

// casa.json pode segurar a carta (vinhosPublicos: false): ela existe, mas nao
// aparece no Google nem no sitemap. Ver o `_vinhosPublicos` do casa.json.
const publica = JSON.parse(await readFile(join(RAIZ, 'casa.json'), 'utf8')).casa.vinhosPublicos !== false;

const BASE = `https://${CASA.dominio}`;
await writeFile(join(RAIZ, 'vinhos.html'), paginaCardapio({
  url: `${BASE}/vinhos`,
  ogImagem: `${BASE}/assets/img/${CASA.imagens}/og.jpg`,
  casa: CASA.nome, titulo: 'Carta de vinhos', endereco: CASA.endereco,
  logo: CASA.logo, icone: CASA.icone,
  descricao: `Carta de vinhos e espumantes — ${total} rótulos, de ${secoes.map(s => s.titulo.toLowerCase()).join(', ')}. ${CASA.nome}, Cuiabá.`,
  gerador: 'scripts/build-vinhos.mjs',
  fontes: CASA.fontes,
  rodape: 'Preços sujeitos a alteração. Venda de bebida alcoólica proibida para menores de 18 anos.',
  tema: CASA.tema,
  naoIndexar: !publica,
  apiSlug: 'forneatto',
  extras: CASA.extras,
  secoes,
  jsonld: {
    '@context': 'https://schema.org', '@type': 'Menu', name: `Carta de vinhos — ${CASA.nome}`,
    hasMenuSection: secoes.map(s => ({
      '@type': 'MenuSection', name: s.titulo,
      hasMenuItem: s.itens.map(it => ({
        '@type': 'MenuItem', name: it.nome,
        ...(it.desc ? { description: it.desc } : {}),
        offers: { '@type': 'Offer', price: it.preco.toFixed(2), priceCurrency: 'BRL' },
      })),
    })),
  },
}));
console.log(`OK ${CASA.nome} — carta de vinhos: ${secoes.length} secoes, ${total} rotulos -> vinhos.html`);
