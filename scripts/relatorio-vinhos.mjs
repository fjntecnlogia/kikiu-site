#!/usr/bin/env node
/**
 * relatorio-vinhos.mjs — o que mudou na carta de vinhos (vinhos.html) em
 * relação ao que está na main (git HEAD). Entra no corpo do PR do robô.
 * Carta sem mudança → arquivo vazio.
 *
 *   node scripts/relatorio-vinhos.mjs /tmp/relatorio-vinhos.md
 */
import { execSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';

const mudou = (() => { try { execSync('git diff --quiet -- vinhos.html'); return false; } catch { return true; } })();
let md = '';
if (mudou) {
  const itens = html => {
    const m = new Map();
    for (const li of html.matchAll(/<li class="i[^"]*"[^>]*>([\s\S]*?)<\/li>/g)) {
      const nome = li[1].match(/i__nome">([^<]*)/)?.[1];
      const preco = li[1].match(/i__preco">([^<]*)/)?.[1];
      const desc = li[1].match(/i__desc">([\s\S]*?)<\/p>/)?.[1] ?? '';
      if (nome) m.set(nome, { preco, desc });
    }
    return m;
  };
  const antes = itens(execSync('git show HEAD:vinhos.html', { maxBuffer: 1 << 26 }).toString('utf8'));
  const depois = itens(readFileSync('vinhos.html', 'utf8'));
  const novos = [], saiu = [], preco = [], desc = [];
  for (const [n, d] of depois) { const a = antes.get(n); if (!a) novos.push(`${n} — ${d.preco}`); else { if (a.preco !== d.preco) preco.push(`${n}: ${a.preco} → ${d.preco}`); if (a.desc !== d.desc) desc.push(n); } }
  for (const [n, a] of antes) if (!depois.has(n)) saiu.push(`${n} (${a.preco})`);
  const lista = (t, a) => a.length ? `### ${t} (${a.length})\n${a.map(x => `- ${x}`).join('\n')}\n\n` : '';
  const algo = novos.length || saiu.length || preco.length || desc.length;
  md = '## Carta de vinhos (Tacto)\n\n' + (algo ? '' : 'Nenhum rótulo, preço ou descrição mudou; só ajuste de organização da página.\n\n') +
    lista('Rótulos novos no Tacto', novos) + lista('Preços atualizados', preco) +
    lista('Saíram do Tacto ou ficaram em falta (somem da carta)', saiu) + lista('Descrição alterada no Tacto', desc);
}
if (process.argv[2]) writeFileSync(process.argv[2], md);
console.log(md || 'Carta de vinhos sem mudança.');
