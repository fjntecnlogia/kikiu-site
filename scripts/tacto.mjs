/**
 * tacto.mjs — lê o cardápio público do Tacto (o mesmo do QR do Webgula).
 *
 * Só leitura, como um visitante: um token, três GETs, timeout. Devolve os
 * produtos no formato que o painel usava ({ categories: [{ category, items }] }),
 * para o build do cardápio não mudar de forma.
 *
 * Fica de fora: as fotos do Tacto (não são da casa), item em falta/indisponível e o preço de lojista
 * ("(lojista)" é outro produto, para os restaurantes do shopping).
 */
const UA = 'FJN-Tecnologia-sync-cardapio/1.0 (+https://fjntecnologia.com.br)';
async function http(url, opts = {}) {
  const r = await fetch(url, { ...opts, headers: { 'User-Agent': UA, ...(opts.headers || {}) }, signal: AbortSignal.timeout(30000) });
  if (!r.ok) throw new Error(`Tacto respondeu ${r.status} em ${url.split('?')[0]}`);
  return r.json();
}

export async function lerTacto() {
  const tk = await http('https://accounts.tactonuvem.com.br/connect/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'client_credentials', client_id: 'webgula', client_secret: 'secret',
      audience: 'tacto-webgula-api', scope: 'tacto-webgula-api IdentityServerApi' }),
  });
  const auth = { Authorization: `Bearer ${tk.access_token}` };
  const emp = await http('https://webgula2.tactonuvem.com.br/v1/api/empresa-wg-config/cba-forneatto/perma-link', { headers: auth });
  const h = { ...auth, 'tacto-grupo-empresarial': emp.chave, 'tacto-empresa-base-id': String(emp.empresaId),
    empresaId: String(emp.empresaBaseId), grupoEmpresaId: String(emp.empresaBaseId) };
  const base = 'https://webgula2.tactonuvem.com.br/v3/cardapio';
  const pdv = emp.pdvPadraoId ?? 1;
  const completo = await http(`${base}/completo-new?pdvId=${pdv}`, { headers: h });
  const g = await http(`${base}/grupos?pdvId=${pdv}`, { headers: h });
  const grupos = Array.isArray(g) ? g : g.grupos || [];
  const nomeGrupo = new Map(grupos.map(x => [x.id, String(x.nome).replace(/^\s*\d+\.\s*/, '').trim()]));

  const categories = [];
  const porGrupo = new Map();
  for (const p of completo.produtos || []) {
    const nome = nomeGrupo.get(p.grupoId);
    if (!nome) continue;                                   // grupo que a página pública do Tacto não lista
    if (p.flgEmFalta === true || p.flgDisponivel === false) continue;
    if (/\blojista\b/i.test(p.nomeCompleto)) continue;
    let lista = porGrupo.get(nome);
    if (!lista) { lista = []; porGrupo.set(nome, lista); categories.push({ category: nome, items: lista }); }
    lista.push({
      id: p.id,
      name: String(p.nomeCompleto).replace(/\s+/g, ' ').trim(),  // espaço duplicado do cadastro não aparece no HTML mesmo
      description: /^\s*combo\s*$/i.test(p.textoInformativo ?? '') ? '' : (p.textoInformativo ?? ''),   // "COMBO" não é descrição
      price_cents: Math.round(Number(p.preco) * 100),
      image_url: null,  // foto do Tacto não é foto da casa (regra do Fundador, 25/09): só entra foto DA CASA
    });
  }
  // ordem: a do cadastro (por id) — a mesma que o painel mostrava; o Tacto devolve em ordem alfabética
  for (const c of categories) c.items.sort((a, b) => a.id - b.id);
  return { categories, total: (completo.produtos || []).length };
}
