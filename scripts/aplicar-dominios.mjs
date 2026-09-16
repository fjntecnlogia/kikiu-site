#!/usr/bin/env node
/**
 * aplicar-dominios.mjs — coloca o dominio real em tudo, nesta casa.
 *
 *   node scripts/aplicar-dominios.mjs
 *
 * Le casa.json e reescreve:
 *   - <link rel="canonical">, og:url, og:image
 *   - url/image/hasMenu do JSON-LD
 *   - sitemap.xml e robots.txt
 *   - vercel.json (301 dos dominios alternativos + proxy do sistema)
 *
 * Esta casa e a RAIZ do seu proprio repositorio e do seu proprio projeto na
 * Vercel. Nao existe rewrite por host aqui: quem chega no dominio ja esta
 * na pasta certa, porque nao ha outra pasta. Era o preco de tres sites num
 * projeto so, e nao se paga mais.
 *
 * Idempotente: pode rodar quantas vezes quiser.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const { casa } = JSON.parse(await readFile(join(RAIZ, 'casa.json'), 'utf8'));
const hoje = new Date().toISOString().slice(0, 10);

if (!casa.dominio) {
  console.error('ERRO: casa.json sem dominio principal');
  process.exit(1);
}
for (const d of casa.alternativos ?? []) {
  if (d === casa.dominio) {
    console.error(`ERRO: ${d} e principal e alternativo ao mesmo tempo — isso e laco de redirecionamento`);
    process.exit(1);
  }
}

const base = `https://${casa.dominio}`;
const IMG = casa.imagens;   // a pasta desta casa dentro de assets/img

/** As tags de medicao, escritas so quando o ID existe no casa.json.
 *
 * Elas vivem aqui e nao no HTML de proposito: o Analytics e o Search Console
 * entram em varias paginas (home e cardapio do QR code), e ID copiado a mao
 * em varios arquivos e ID errado em um deles.
 */
function tagsDeMedicao() {
  const partes = [];
  if (casa.searchConsole) {
    partes.push(`<meta name="google-site-verification" content="${casa.searchConsole}">`);
  }
  if (casa.ga4) {
    // async: a medicao nunca pode segurar a pagina. No cardapio da mesa isso
    // vale dobrado — a pessoa esta com fome, de pe, no 4G.
    partes.push(`<script async src="https://www.googletagmanager.com/gtag/js?id=${casa.ga4}"></script>`);
    partes.push(`<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${casa.ga4}');</script>`);
  }
  return partes.length ? '\n' + partes.map(l => '  ' + l).join('\n') : '';
}

const MARCA_TAGS = '<!-- MEDICAO -->';

/** Escreve (ou reescreve) o bloco de tags logo antes de </head>. */
function aplicarTags(html) {
  const bloco = tagsDeMedicao();
  const limpo = html.replace(
    new RegExp(`\\n?\\s*${MARCA_TAGS}[\\s\\S]*?${MARCA_TAGS}`, 'g'), '');
  if (!bloco) return limpo;
  return limpo.replace('</head>',
    `  ${MARCA_TAGS}${bloco}\n  ${MARCA_TAGS}\n</head>`);
}

// ─── a home ────────────────────────────────────────────────────────────
{
  const arquivo = join(RAIZ, 'index.html');
  let html = await readFile(arquivo, 'utf8');

  html = html.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${base}/$2`);
  html = html.replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${base}/$2`);
  html = html.replace(/(<meta property="og:image" content=")[^"]*(")/,
    `$1${base}/assets/img/${IMG}/og.jpg$2`);
  if (!/og:url/.test(html)) {
    html = html.replace(/(<meta property="og:title")/,
      `<meta property="og:url" content="${base}/">\n$1`);
  }

  html = html.replace(/("url":\s*")https?:\/\/[^"]*(")/g, `$1${base}$2`);
  html = html.replace(/("image":\s*")https?:\/\/[^"]*(")/g,
    `$1${base}/assets/img/${IMG}/og.jpg$2`);
  html = html.replace(/("hasMenu":\s*")https?:\/\/[^"#]*(#[^"]*)?(")/g,
    (m, a, hash, z) => `${a}${base}/${hash ?? ''}${z}`);

  await writeFile(arquivo, aplicarTags(html));
}

// ─── a pagina do QR code, quando a casa tem uma ────────────────────────
// A rota vem do casa.json: mesma fonte que o QR code impresso usa.
const rota = casa.cardapio;
if (rota) {
  const dest = join(RAIZ, `${rota}.html`);
  let pg = await readFile(dest, 'utf8');
  pg = pg.replace(/(<link rel="canonical" href=")[^"]*(")/, `$1${base}/${rota}$2`);
  pg = pg.replace(/(<meta property="og:url" content=")[^"]*(")/, `$1${base}/${rota}$2`);
  pg = pg.replace(/(<meta property="og:image" content=")[^"]*(")/,
    `$1${base}/assets/img/${IMG}/og.jpg$2`);
  await writeFile(dest, aplicarTags(pg));
}

// ─── sitemap e robots ──────────────────────────────────────────────────
const paginas = [{ rota: '/', prio: '1.0' }]
  .concat(rota ? [{ rota: `/${rota}`, prio: '0.9' }] : []);

await writeFile(join(RAIZ, 'sitemap.xml'),
`<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${paginas.map(p => `  <url>
    <loc>${base}${p.rota}</loc>
    <lastmod>${hoje}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${p.prio}</priority>
  </url>`).join('\n')}
</urlset>
`);

await writeFile(join(RAIZ, 'robots.txt'),
`User-agent: *
Allow: /

Sitemap: ${base}/sitemap.xml
`);

// ─── vercel.json ───────────────────────────────────────────────────────
// Gerado inteiro daqui. Editar o arquivo a mao e perder a edicao na proxima
// vez que alguem rodar este script — ja aconteceu em 15/09.

// O sistema que responde reserva, agenda e opiniao. Passa por aqui de
// proposito: o navegador so ve o dominio da casa, nunca o de quem hospeda.
const SISTEMA = 'https://api-painel.fjntecnologia.com.br/public';

const vercel = {
  $schema: 'https://openapi.vercel.sh/vercel.json',
  cleanUrls: true,

  // Os alternativos existem para o boca a boca e o erro de digitacao.
  // 301 para o principal: servir conteudo nos dois seria conteudo
  // duplicado, e as variantes competiriam entre si no Google.
  //
  // DUAS regras por dominio, e nao uma: `/:caminho*` casa com `/opiniao`
  // e nao casa com `/` — a raiz precisa da sua propria linha. Com so a
  // primeira, a HOME do alternativo servia a pagina inteira em vez de
  // redirecionar (visto ao vivo em 16/09: www.saikooriental.com.br
  // respondia 200 com o site do Saiko dentro).
  redirects: (casa.alternativos ?? []).flatMap(d => {
    const has = [{ type: 'host', value: `(www\\.)?${d.replaceAll('.', '\\.')}` }];
    return [
      { source: '/',           has, destination: `${base}/`,           permanent: true },
      { source: '/:caminho*',  has, destination: `${base}/:caminho*`,  permanent: true },
    ];
  }),

  rewrites: [
    { source: '/reservas-api/:caminho*', destination: `${SISTEMA}/reservas/:caminho*` },
    { source: '/agenda-api/:caminho*',   destination: `${SISTEMA}/eventos/:caminho*` },
    { source: '/opiniao-api/:caminho*',  destination: `${SISTEMA}/opiniao/:caminho*` },
  ],

  headers: [
    { source: '/assets/(.*)',
      headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
  ],
};

await writeFile(join(RAIZ, 'vercel.json'), JSON.stringify(vercel, null, 2) + '\n');

console.log(`${casa.nome} -> ${base}`);
console.log(`  ${(casa.alternativos ?? []).length} dominio(s) alternativo(s) redirecionando 301`);
console.log('  sitemap.xml, robots.txt e vercel.json gerados');
