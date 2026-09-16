#!/usr/bin/env node
/**
 * gerar-fontes.mjs — refaz cardapios/_fontes.css com os glifos em uso.
 *
 *   node scripts/build-cardapio-saiko.mjs   # gera o HTML
 *   node scripts/gerar-fontes.mjs           # subconjunto para os glifos dele
 *   node scripts/build-cardapio-saiko.mjs   # embute o subconjunto novo
 *
 * Por que existe: um PDF de grafica nao pode depender de internet, entao as
 * fontes vao embutidas no arquivo. As japonesas tem milhares de glifos e o
 * Google as serve em 700+ subconjuntos — inviavel embutir inteiras. Este
 * script pede ao Google exatamente os caracteres que o cardapio imprime,
 * o que da um arquivo de dezenas de KB em vez de dezenas de MB.
 *
 * Rodar sempre que entrar texto com caractere novo (um kanji de secao, um
 * prato com acento incomum). Sem isso o glifo some no PDF.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
// Dois cardapios, dois conjuntos de fontes. Sem argumento faz o do Saiko.
//   node scripts/gerar-fontes.mjs             -> Saiko
//   node scripts/gerar-fontes.mjs --bebidas   -> menu de bebidas do Kikiu
//   node scripts/gerar-fontes.mjs --qrcode    -> cartao de mesa com QR code
const ALVOS = {
  saiko: {
    familias: 'family=Shippori+Mincho+B1:wght@600;700;800&family=Zen+Kaku+Gothic+New:wght@400;500;700',
    html: 'cardapios/saiko-impressao.html',
    saida: 'cardapios/_fontes.css',
  },
  qrcode: {
    familias: 'family=Poppins:wght@400;600;700',
    html: 'cardapios/qrcode-mesa.html',
    saida: 'cardapios/_fontes-qrcode.css',
  },
  bebidas: {
    familias: 'family=Abril+Fatface&family=Poppins:wght@400;600;700',
    html: 'cardapios/kikiu-bebidas-impressao.html',
    saida: 'cardapios/_fontes-bebidas.css',
  },
};
const alvo = ALVOS[process.argv.find(a => a.startsWith('--'))?.slice(2) ?? 'saiko'];
if (!alvo) throw new Error(`alvo desconhecido (use: ${Object.keys(ALVOS).join(', ')})`);
const FAMILIAS = alvo.familias;
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

const html = await readFile(join(RAIZ, alvo.html), 'utf8');

// o texto que a pagina imprime, sem CSS nem script
const visivel = html
  .replace(/<(script|style)[\s\S]*?<\/\1>/g, ' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&nbsp;/g, ' ')
  .replace(/&amp;/g, '&');

const glifos = [...new Set(visivel)].filter(c => c.charCodeAt(0) > 31).sort().join('');
console.log(`${glifos.length} glifos distintos no cardapio`);

const url = `https://fonts.googleapis.com/css2?${FAMILIAS}&text=${encodeURIComponent(glifos)}`;
const css = await (await fetch(url, { headers: { 'User-Agent': UA } })).text();

const faces = css.match(/@font-face\s*\{[^}]+\}/g) ?? [];
if (!faces.length) throw new Error('o Google nao devolveu nenhum @font-face');

let bytes = 0;
const blocos = [];
for (const face of faces) {
  const url2 = face.match(/url\((https:\/\/fonts\.gstatic\.com\/[^)]+)\)/)?.[1];
  if (!url2) continue;
  const buf = Buffer.from(await (await fetch(url2, { headers: { 'User-Agent': UA } })).arrayBuffer());
  bytes += buf.length;
  blocos.push(face.replace(/url\(https:\/\/fonts\.gstatic\.com\/[^)]+\)/,
    `url(data:font/woff2;base64,${buf.toString('base64')})`));
}

await writeFile(join(RAIZ, alvo.saida),
  `/* GERADO por scripts/gerar-fontes.mjs — nao editar a mao.\n` +
  `   Subconjunto com os ${glifos.length} glifos que o cardapio imprime. */\n` +
  blocos.join('\n') + '\n');

console.log(`${faces.length} @font-face · ${(bytes / 1024).toFixed(1)} KB embutidos`);
console.log(`   -> ${alvo.saida}  (rodar o build de novo para embutir)`);
