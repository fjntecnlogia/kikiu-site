#!/usr/bin/env node
/**
 * sync-tacto.mjs — o robô que mantém o cardápio em dia com o Tacto.
 *
 *   node scripts/sync-tacto.mjs --casa=kikiu|saiko [--simular] [--relatorio=caminho.md]
 *
 * A fonte da verdade é o cardápio público do Tacto (o mesmo do QR code do
 * Webgula). O robô LÊ o Tacto como um visitante e ajusta o JSON do cardápio
 * desta casa. Quem publica é o fluxo do GitHub (sync-tacto.yml), que abre um
 * PR — nunca escreve direto na main.
 *
 * O que faz:
 *   PREÇO    preço diferente do Tacto → atualiza (dose e garrafa separados).
 *   NOVO     produto do Tacto que a página não tem → entra com o nome EXATO do
 *            Tacto, no grupo onde ficam os produtos do mesmo grupo do Tacto.
 *            Sem grupo conhecido → só vai para o relatório ("sem lugar").
 *   EM FALTA produto marcado em falta/indisponível no Tacto → ativo:false (com
 *            tactoFalta:true) e volta sozinho quando o Tacto liberar.
 *   SAIU     item que não existe mais no Tacto → ativo:false. NUNCA apaga.
 *   VOLTOU   item desativado que o Tacto tem de novo → reativa.
 *
 * O que NUNCA faz: trocar o nome de um item que já existe (o nome do site pode
 * ser mais limpo que o do Tacto), apagar item, mexer em descrição/foto, ou
 * escrever quando o Tacto responde pela metade.
 *
 * Os vinhos (/vinhos) não passam por aqui: vêm do painel.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const arg = n => (process.argv.find(a => a.startsWith(`--${n}=`)) || '').split('=').slice(1).join('=');
const SIMULAR = process.argv.includes('--simular');
const CASA = arg('casa');

// ── configuração por casa ────────────────────────────────────────────────
const CASAS = {
  kikiu: {
    json: 'cardapios/kikiu-bebidas.json', fonteChave: 'fonte',
    categorias: ['KIKIU', 'BEBIDA', 'SOBREMESA'],
    gruposExtras: [189],            // "Almoço": existe nos produtos, mas não na lista pública de grupos
    ignorarGrupos: [164, 165, 166], // champagne, espumantes, vinhos → carta de vinhos (painel)
  },
  saiko: {
    json: 'cardapios/saiko.json', fonteChave: 'origem',
    categorias: ['SAIKO', 'SOBREMESA'],
    gruposExtras: [],
    ignorarGrupos: [],
  },
};
const cfg = CASAS[CASA];
if (!cfg) { console.error('Use --casa=kikiu ou --casa=saiko'); process.exit(2); }

const MAX_SAIDAS = 8;        // mais que isso é suspeito: não desativa nada, só relata
const PISO_PRODUTOS = 0.6;   // Tacto com menos que 60% do que a página tem = resposta pela metade

// ── Tacto (leitura, como visitante) ──────────────────────────────────────
const UA = 'FJN-Tecnologia-sync-cardapio/1.0 (+https://fjntecnologia.com.br)';
async function http(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { 'User-Agent': UA, ...(opts.headers || {}) }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`${r.status} em ${url.split('?')[0]}`);
  return r.json();
}
async function lerTacto() {
  const tk = await http('https://accounts.tactonuvem.com.br/connect/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: 'webgula', client_secret: 'secret',
      audience: 'tacto-webgula-api', scope: 'tacto-webgula-api IdentityServerApi' }),
  });
  const auth = { Authorization: `Bearer ${tk.access_token}` };
  const cfgEmp = await http('https://webgula2.tactonuvem.com.br/v1/api/empresa-wg-config/cba-forneatto/perma-link', { headers: auth });
  const h = { ...auth, 'tacto-grupo-empresarial': cfgEmp.chave, 'tacto-empresa-base-id': String(cfgEmp.empresaId),
    empresaId: String(cfgEmp.empresaBaseId), grupoEmpresaId: String(cfgEmp.empresaBaseId) };
  const base = 'https://webgula2.tactonuvem.com.br/v3/cardapio';
  const pdv = cfgEmp.pdvPadraoId ?? 1;
  const completo = await http(`${base}/completo-new?pdvId=${pdv}`, { headers: h });
  const grupos = await http(`${base}/grupos?pdvId=${pdv}`, { headers: h });
  return { produtos: completo.produtos || [], grupos: Array.isArray(grupos) ? grupos : grupos.grupos || [] };
}

// ── nomes ────────────────────────────────────────────────────────────────
const sa = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const norm = s => sa(s).replace(/[^a-z0-9]+/g, '');
const STOP = new Set(['de', 'da', 'do', 'com', 'e', 'a', 'o', 'ml', 'l', 'un', 'uni', 'uns', 'cerv', 'long', 'neck', 'copo', 'dose', 'garrafa', 'taca', 'lata', 'c', 's', 'em', 'na', 'no']);
const toks = s => new Set((sa(s).match(/[a-z0-9]+/g) || []).filter(t => !STOP.has(t) && t.length > 1));
function jaccard(a, b) { const A = toks(a), B = toks(b); if (!A.size || !B.size) return 0; let i = 0; for (const t of A) if (B.has(t)) i++; return i / (A.size + B.size - i); }
const RE_KIND = /\s*[-–(]?\s*\b(dose|garrafa)\b\s*\)?\s*$/i;
function partir(nome) {
  const t = String(nome).trim();
  const m = t.match(RE_KIND);
  return { base: m ? t.replace(RE_KIND, '').trim() : t, kind: m ? m[1].toLowerCase() : null };
}

let apelidos = {};
try { apelidos = JSON.parse(await readFile(join(RAIZ, 'cardapios/tacto-apelidos.json'), 'utf8')).apelidos || {}; } catch { /* sem apelidos */ }
// chave "Nome" vale para todo item com esse nome; "Nome|42" só para o de R$ 42 (nomes repetidos)
const apelidosN = Object.fromEntries(Object.entries(apelidos).map(([k, v]) => { const [n, p] = k.split('|'); return [norm(n) + (p ? `|${p}` : ''), v]; }));

// ── dados ────────────────────────────────────────────────────────────────
const brl = n => `R$ ${Number(n).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const caminho = join(RAIZ, cfg.json);
const textoOriginal = await readFile(caminho, 'utf8');
const dados = JSON.parse(textoOriginal);

const { produtos, grupos } = await lerTacto();
const catDoGrupo = new Map(grupos.map(g => [g.id, g.categoriaNome]));
const nomeDoGrupo = new Map(grupos.map(g => [g.id, g.nome]));
// preço de lojista (restaurantes do shopping) é outro produto no Tacto e não vai ao cardápio do cliente
const RE_IGNORAR = /\blojista\b/i;
const noEscopo = p => !cfg.ignorarGrupos.includes(p.grupoId) && !RE_IGNORAR.test(p.nomeCompleto)
  && (cfg.categorias.includes(catDoGrupo.get(p.grupoId)) || cfg.gruposExtras.includes(p.grupoId));

const entradas = produtos.filter(noEscopo).map((p, i) => {
  const { base, kind } = partir(p.nomeCompleto);
  return { i, id: p.id, nome: String(p.nomeCompleto).trim(), preco: Number(p.preco), grupoId: p.grupoId, base, baseN: norm(base), kind,
    falta: p.flgEmFalta === true || p.flgDisponivel === false, usado: false };
});

// percorre todos os arrays de itens do JSON, guardando onde estão
function achar(x, path = '', out = [], bloco = null) {
  if (Array.isArray(x)) {
    if (x.length && x.every(i => i && typeof i === 'object' && 'nome' in i)) out.push({ path, itens: x, bloco });
    else x.forEach((v, n) => achar(v, `${path}/${n}`, out, /^\/blocos\/\d+$/.test(`${path}/${n}`) ? v : bloco));
  } else if (x && typeof x === 'object') {
    for (const [k, v] of Object.entries(x)) achar(v, `${path}/${k}`, out, /^\/blocos\/\d+$/.test(`${path}/${k}`) ? v : bloco);
  }
  return out;
}
const arrays = achar(dados);
const itensSite = arrays.flatMap(a => a.itens.map(it => ({ it, a })));

// piso de sanidade: Tacto pela metade não mexe em nada
const ativosNaPagina = itensSite.filter(s => s.it.ativo !== false).length;
if (entradas.length < 20 || entradas.length < ativosNaPagina * PISO_PRODUTOS) {
  console.log(`ABORTADO: o Tacto trouxe só ${entradas.length} produtos para ${ativosNaPagina} itens na página. Nada foi escrito.`);
  process.exit(0);
}

// ── casamento item do site × produto do Tacto (um para um) ───────────────
const precoDoSite = s => s.it.preco || s.a.bloco?.precoUnico || null;
const pares = [];
for (const s of itensSite) {
  const ap = apelidosN[`${norm(s.it.nome)}|${s.it.preco}`] ?? apelidosN[norm(s.it.nome)];
  const { base, kind } = partir(ap ?? s.it.nome);
  s.base = base; s.baseN = norm(base); s.kind = kind;
  const preco = precoDoSite(s);
  for (const e of entradas) {
    if ((e.kind === 'garrafa') !== (kind === 'garrafa')) continue;
    const exato = e.baseN === s.baseN;
    const j = exato ? 1 : jaccard(base, e.base);
    const igual = preco != null && e.preco === preco;
    if (exato || j >= 0.6 || (igual && j >= 0.34)) pares.push({ s, e, rank: j + (igual ? 0.5 : 0) + (exato ? 1 : 0) });
  }
}
pares.sort((x, y) => y.rank - x.rank);
const casados = new Map();
for (const { s, e } of pares) {
  if (casados.has(s) || e.usado) continue;
  casados.set(s, e); e.usado = true;
}

// ── aplica ───────────────────────────────────────────────────────────────
const rel = { preco: [], garrafa: [], novo: [], semLugar: [], falta: [], voltou: [], saiu: [], saiuSuspeito: [], precoUnico: [] };
const mapa = new Map(); // grupo do Tacto → { pathDoSite: contagem }

for (const [s, e] of casados) {
  const m = mapa.get(e.grupoId) || {}; m[s.a.path] = (m[s.a.path] || 0) + 1; mapa.set(e.grupoId, m);

  // em falta / volta
  if (e.falta) {
    if (s.it.ativo !== false) { s.it.ativo = false; s.it.tactoFalta = true; rel.falta.push(`${s.it.nome} (${e.nome})`); }
    continue;
  }
  if (s.it.ativo === false) {
    delete s.it.ativo; delete s.it.tactoFalta; rel.voltou.push(`${s.it.nome} ← ${e.nome}, ${brl(e.preco)}`);
  }
  // preço
  const atual = precoDoSite(s);
  if (atual !== e.preco) {
    if (!s.it.preco) rel.precoUnico.push(`${s.it.nome}: preço único do bloco é ${brl(atual)}, Tacto ${brl(e.preco)}`);
    else { rel.preco.push(`${s.it.nome}: ${brl(s.it.preco)} → ${brl(e.preco)}`); s.it.preco = e.preco; }
  }
  // garrafa
  if (s.it.garrafa != null || e.kind === 'dose') {
    const g = entradas.find(x => x.kind === 'garrafa' && !x.usado && x.baseN === e.baseN);
    if (g) {
      g.usado = true;
      if (g.falta) continue;
      if (s.it.garrafa !== g.preco) { rel.garrafa.push(`${s.it.nome}: garrafa ${s.it.garrafa != null ? brl(s.it.garrafa) : '(nova)'} → ${brl(g.preco)}`); s.it.garrafa = g.preco; }
    }
  }
}

// itens da página sem par no Tacto
const semPar = itensSite.filter(s => !casados.has(s) && s.it.ativo !== false);
if (semPar.length > MAX_SAIDAS) {
  for (const s of semPar) rel.saiuSuspeito.push(`${s.it.nome} (${precoDoSite(s) != null ? brl(precoDoSite(s)) : 'preço do bloco'})`);
} else {
  for (const s of semPar) { s.it.ativo = false; rel.saiu.push(`${s.it.nome} (${precoDoSite(s) != null ? brl(precoDoSite(s)) : 'preço do bloco'})`); }
}

// produtos do Tacto que a página não tem
for (const e of entradas.filter(x => !x.usado && !x.falta)) {
  const m = mapa.get(e.grupoId);
  const destino = m && Object.entries(m).sort((a, b) => b[1] - a[1])[0][0];
  const alvo = destino && arrays.find(a => a.path === destino);
  const rotulo = `${e.nome} — ${brl(e.preco)} (grupo ${nomeDoGrupo.get(e.grupoId) || e.grupoId} do Tacto)`;
  if (alvo) { alvo.itens.push({ nome: e.nome, preco: e.preco }); rel.novo.push(`${e.nome} — ${brl(e.preco)}`); }
  else rel.semLugar.push(rotulo);
}

// ── escreve ──────────────────────────────────────────────────────────────
const mudou = ['preco', 'garrafa', 'novo', 'falta', 'voltou', 'saiu'].some(k => rel[k].length);
if (mudou) {
  const hoje = new Date().toLocaleDateString('pt-BR', { timeZone: 'America/Cuiaba' });
  if (typeof dados[cfg.fonteChave] === 'string') dados[cfg.fonteChave] = dados[cfg.fonteChave].replace(/ em \d{2}\/\d{2}\/\d{4}/, ` em ${hoje}`);
}
const lista = (t, a) => a.length ? `### ${t} (${a.length})\n${a.map(x => `- ${x}`).join('\n')}\n\n` : '';
const md = `## Conferência com o Tacto — ${CASA}\n\n` +
  (mudou ? '' : 'Nada a mudar: o cardápio já bate com o Tacto.\n\n') +
  lista('Preços atualizados', rel.preco) + lista('Preços de garrafa', rel.garrafa) + lista('Novos no Tacto (entram com o nome exato do Tacto)', rel.novo) +
  lista('Em falta no Tacto (ficam escondidos até voltar)', rel.falta) + lista('Voltaram ao ar', rel.voltou) +
  lista('Saíram do Tacto (ficam guardados com `ativo: false`)', rel.saiu) +
  lista('⚠ Saídas demais para ser normal — NADA foi desativado, confira', rel.saiuSuspeito) +
  lista('⚠ Novos no Tacto sem lugar no cardápio (decidir onde entram)', rel.semLugar) +
  lista('⚠ Preço único do bloco difere do Tacto', rel.precoUnico) +
  (rel.preco.length || rel.garrafa.length || rel.novo.length || rel.saiu.length ? '> Os PDFs de gráfica em `cardapios/` não são regerados pelo robô: refaça se for imprimir.\n\n' : '') +
  `\n_Gerado pelo robô sync-tacto a partir do cardápio público do Tacto. Nomes de itens existentes não são alterados; nada é apagado._\n`;
console.log(md);
const saida = arg('relatorio');
if (saida) await writeFile(saida, md);
if (mudou && !SIMULAR) await writeFile(caminho, JSON.stringify(dados, null, 2) + '\n');
console.log(`MUDOU=${mudou ? 1 : 0}`);
