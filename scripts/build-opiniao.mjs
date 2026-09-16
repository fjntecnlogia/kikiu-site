/**
 * build-opiniao.mjs — a página que o SEGUNDO QR code da mesa abre.
 *
 * O primeiro QR leva ao cardápio. Este leva a "como foi?". Mesmo gesto,
 * mesma mesa, mesmo celular — e por isso as mesmas prioridades da página
 * de cardápio, nesta ordem:
 *
 *   1. abrir rápido no 4G do salão: CSS embutido, zero biblioteca, zero
 *      fonte bloqueante além da do tema;
 *   2. terminar em menos de um minuto. Quem está com a conta na mão não
 *      preenche formulário — por isso UMA nota obrigatória e todo o
 *      resto opcional, inclusive quem é a pessoa;
 *   3. ser a casa e não "um formulário". O logo abre a página.
 *
 * NOTA É A ÚNICA COISA OBRIGATÓRIA. Se a pessoa tocar a carinha e sair,
 * a casa já ganhou o dado que importa. Tudo o que vem depois é bônus.
 *
 * Roda: node scripts/build-opiniao.mjs
 */
import { writeFile, readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), '..');
const esc = s => String(s ?? '').replace(/[&<>"]/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/**
 * As cinco notas. Palavra e não estrela: "Ótimo" e "Ruim" são o que a
 * pessoa diria; cinco estrelas exigem traduzir sentimento em número
 * enquanto o garçom espera a maquininha.
 */
const NOTAS = [
  { n: 5, rotulo: 'Ótimo',   cara: 'M8 14s1.5 2 4 2 4-2 4-2' },
  { n: 4, rotulo: 'Bom',     cara: 'M8.5 14.5s1.3 1.3 3.5 1.3 3.5-1.3 3.5-1.3' },
  { n: 3, rotulo: 'Normal',  cara: 'M8 15h8' },
  { n: 2, rotulo: 'Ruim',    cara: 'M8.5 16s1.3-1.3 3.5-1.3 3.5 1.3 3.5 1.3' },
  { n: 1, rotulo: 'Péssimo', cara: 'M8 16.5s1.5-2 4-2 4 2 4 2' },
];

/** Os mesmos seis que a API aceita. Cada casa mostra os que fazem sentido nela. */
const ASPECTOS = {
  atendimento: 'Atendimento', comida: 'Comida', drinks: 'Drinks',
  ambiente: 'Ambiente', musica: 'Música', espera: 'Tempo de espera',
};

function pagina(c) {
  const t = c.tema;
  return `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<!-- Fora do Google: é uma tela de uso na mesa, não conteúdo para buscar. -->
<meta name="robots" content="noindex, nofollow">
<link rel="icon" href="${esc(c.icone.aba)}" sizes="32x32">
<link rel="apple-touch-icon" href="${esc(c.icone.inicio)}">
<meta name="theme-color" content="${t.barra}">
<title>Como foi? — ${esc(c.casa)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="${esc(c.fontes)}" rel="stylesheet">
<style>
:root{--papel:${t.papel};--tinta:${t.tinta};--suave:${t.suave};--marca:${t.marca};
  --fio:${t.fio};--barra:${t.barra};--sobre-barra:${t.sobreBarra};
  --display:${t.display};--texto:${t.texto}}
*,*::before,*::after{box-sizing:border-box}
html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--papel);color:var(--tinta);font-family:var(--texto);
  font-size:16px;line-height:1.55;-webkit-font-smoothing:antialiased}
img{display:block;max-width:100%}

.capa{background:var(--barra);color:var(--sobre-barra);text-align:center;
  padding:calc(26px + env(safe-area-inset-top)) 20px 22px${t.fioDaBarra ? `;border-bottom:4px solid ${t.fioDaBarra}` : ''}}
.capa__logo{height:${t.logoAltura}px;width:auto;max-width:76%;margin:0 auto}
.capa__mesa{display:inline-block;margin-top:15px;padding:5px 15px;border-radius:999px;
  border:1px solid currentColor;font-size:11.5px;font-weight:700;letter-spacing:.12em;
  text-transform:uppercase;opacity:.82}
/* [hidden] e a regra da folha do navegador: qualquer display do autor ganha
   dela, então sem esta linha a pílula fica vazia na tela quando não há mesa. */
.capa__mesa[hidden]{display:none}

main{max-width:560px;margin:0 auto;padding:30px 20px calc(40px + env(safe-area-inset-bottom))}
h1{font-family:var(--display);font-weight:${t.pesoDisplay};font-size:clamp(25px,6.4vw,31px);
  line-height:1.15;margin:0;text-align:center}
.sub{margin:9px 0 0;text-align:center;font-size:13.5px;color:var(--suave)}
.rotulo{display:block;font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;
  color:var(--suave);margin:30px 0 11px}

/* As cinco notas. Uma linha no celular, sem rolagem lateral: quem está de
   pé com o celular na mão não descobre que existe conteúdo fora da tela. */
.notas{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}
.nota{appearance:none;-webkit-appearance:none;background:transparent;cursor:pointer;
  border:1px solid var(--fio);border-radius:12px;padding:13px 2px 10px;
  display:flex;flex-direction:column;align-items:center;gap:6px;
  color:var(--tinta);font:inherit;font-size:11.5px;transition:border-color .15s,background .15s}
.nota svg{width:27px;height:27px;stroke:currentColor;fill:none;stroke-width:1.6;
  stroke-linecap:round}
.nota[aria-pressed="true"]{background:var(--marca);border-color:var(--marca);color:#fff}
.nota:focus-visible{outline:2px solid var(--marca);outline-offset:2px}

.fichas{display:flex;flex-wrap:wrap;gap:8px}
.ficha{appearance:none;-webkit-appearance:none;cursor:pointer;font:inherit;font-size:14px;
  background:transparent;color:var(--tinta);border:1px solid var(--fio);
  border-radius:999px;padding:8px 15px;transition:border-color .15s,background .15s}
.ficha[aria-pressed="true"]{background:var(--marca);border-color:var(--marca);color:#fff}
.ficha:focus-visible{outline:2px solid var(--marca);outline-offset:2px}

textarea,input{font:inherit;font-size:16px;/* 16px trava o zoom do iOS ao focar */
  width:100%;color:var(--tinta);background:transparent;border:1px solid var(--fio);
  border-radius:11px;padding:12px 13px}
textarea{min-height:92px;resize:vertical}
::placeholder{color:var(--suave);opacity:1}
textarea:focus-visible,input:focus-visible{outline:none;border-color:var(--marca);
  box-shadow:0 0 0 3px color-mix(in srgb,var(--marca) 26%,transparent)}
.dupla{display:grid;gap:10px}
@media(min-width:420px){.dupla{grid-template-columns:1fr 1fr}}

/* A armadilha: fora da tela, sem foco, fora da tabulação. Nem display:none
   nem hidden — robô bom pula os dois. */
.armadilha{position:absolute!important;left:-9999px!important;width:1px;height:1px;overflow:hidden}

.enviar{width:100%;margin-top:26px;cursor:pointer;font-family:var(--display);
  font-weight:${t.pesoDisplay};font-size:16px;letter-spacing:.04em;
  color:#fff;background:var(--marca);border:0;border-radius:12px;padding:16px}
.enviar:disabled{opacity:.45;cursor:not-allowed}
.ajuda{margin:12px 0 0;font-size:12.5px;color:var(--suave);text-align:center;line-height:1.5}

.recado{margin-top:22px;padding:16px 17px;border-radius:12px;border:1px solid var(--fio);
  font-size:15px;line-height:1.55}
.recado[hidden]{display:none}
.recado--erro{border-color:#c0392b;background:color-mix(in srgb,#c0392b 10%,transparent)}
.fim{text-align:center;padding:26px 0 0}
.fim[hidden]{display:none}
.fim h2{font-family:var(--display);font-weight:${t.pesoDisplay};font-size:23px;margin:0 0 8px}
.formulario[hidden]{display:none}
.soleitor{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}
@media(prefers-reduced-motion:reduce){*{transition:none!important}}
</style>
</head>
<body>

<header class="capa">
  <img class="capa__logo" src="${esc(c.logo.src)}" alt="${esc(c.logo.alt)}"
       width="${c.logo.largura}" height="${c.logo.altura}" fetchpriority="high">
  <span class="capa__mesa" id="mesa" hidden></span>
</header>

<main>
  <h1 class="soleitor">${esc(c.casa)} — como foi sua visita</h1>

  <form class="formulario" id="form" novalidate>
    <h1 aria-hidden="true">${esc(c.pergunta)}</h1>
    <p class="sub">Leva menos de um minuto e chega direto para a gente.</p>

    <span class="rotulo" id="rot-nota">Como foi?</span>
    <div class="notas" role="group" aria-labelledby="rot-nota">
      ${NOTAS.map(n => `<button type="button" class="nota" data-nota="${n.n}" aria-pressed="false">
        <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2"/><path d="M9 10h.01M15 10h.01"/><path d="${n.cara}"/></svg>
        ${n.rotulo}
      </button>`).join('\n      ')}
    </div>

    <span class="rotulo" id="rot-asp">O que pesou? <span style="text-transform:none;letter-spacing:0">(opcional)</span></span>
    <div class="fichas" role="group" aria-labelledby="rot-asp">
      ${c.aspectos.map(a => `<button type="button" class="ficha" data-aspecto="${a}" aria-pressed="false">${esc(ASPECTOS[a])}</button>`).join('\n      ')}
    </div>

    <span class="rotulo"><label for="comentario">Quer contar mais? <span style="text-transform:none;letter-spacing:0">(opcional)</span></label></span>
    <textarea id="comentario" maxlength="1000" placeholder="${esc(c.exemplo)}"></textarea>

    <span class="rotulo">Quem é você? <span style="text-transform:none;letter-spacing:0">(opcional — pode ficar anônimo)</span></span>
    <div class="dupla">
      <input id="nome" type="text" maxlength="120" autocomplete="name" placeholder="Seu nome">
      <input id="telefone" type="tel" maxlength="30" inputmode="tel" autocomplete="tel" placeholder="WhatsApp">
    </div>

    <div class="armadilha" aria-hidden="true">
      <input type="text" id="sobrenome" tabindex="-1" autocomplete="off">
    </div>

    <button class="enviar" type="submit" id="enviar" disabled>Enviar</button>
    <p class="ajuda">Só a carinha é obrigatória. Sem nome, a resposta é anônima.</p>
    <p class="recado" id="recado" role="status" aria-live="polite" hidden></p>
  </form>

  <div class="fim" id="fim" hidden>
    <h2 id="fim-titulo"></h2>
    <p class="sub" id="fim-texto"></p>
  </div>
</main>

<script>
(function(){
  "use strict";
  var API = "/opiniao-api/${c.slug}";
  var nota = null, aspectos = [];
  var form = document.getElementById("form");
  var enviar = document.getElementById("enviar");
  var recado = document.getElementById("recado");

  // O número da mesa vem do QR: cada adesivo tem o seu. É o que deixa a
  // casa resolver com a pessoa ainda sentada.
  var mesa = new URLSearchParams(location.search).get("mesa");
  if (mesa && /^[A-Za-z0-9 -]{1,20}$/.test(mesa)) {
    var el = document.getElementById("mesa");
    el.textContent = "Mesa " + mesa;
    el.hidden = false;
  } else { mesa = null; }

  document.querySelectorAll("[data-nota]").forEach(function(b){
    b.addEventListener("click", function(){
      nota = Number(b.dataset.nota);
      document.querySelectorAll("[data-nota]").forEach(function(o){
        o.setAttribute("aria-pressed", String(o === b));
      });
      enviar.disabled = false;
    });
  });

  document.querySelectorAll("[data-aspecto]").forEach(function(b){
    b.addEventListener("click", function(){
      var a = b.dataset.aspecto, i = aspectos.indexOf(a);
      if (i >= 0) aspectos.splice(i, 1); else aspectos.push(a);
      b.setAttribute("aria-pressed", i < 0 ? "true" : "false");
    });
  });

  function erro(texto){
    recado.textContent = texto;
    recado.className = "recado recado--erro";
    recado.hidden = false;
  }

  form.addEventListener("submit", function(ev){
    ev.preventDefault();
    if (!nota) { erro("Toque em uma carinha para dizer como foi."); return; }
    enviar.disabled = true;
    var antes = enviar.textContent;
    enviar.textContent = "Enviando…";
    recado.hidden = true;

    fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        nota: nota,
        aspectos: aspectos,
        comentario: document.getElementById("comentario").value.trim() || undefined,
        mesa: mesa || undefined,
        nome: document.getElementById("nome").value.trim() || undefined,
        telefone: document.getElementById("telefone").value.trim() || undefined,
        sobrenome: document.getElementById("sobrenome").value || undefined
      })
    })
    .then(function(r){
      return r.json().catch(function(){ return {}; })
        .then(function(c){ return { ok: r.ok, corpo: c }; });
    })
    .then(function(res){
      if (res.ok) {
        form.hidden = true;
        var fim = document.getElementById("fim");
        document.getElementById("fim-titulo").textContent =
          nota >= 4 ? "Obrigado!" : "Obrigado por contar.";
        document.getElementById("fim-texto").textContent =
          nota >= 4
            ? "Fico feliz que tenha sido bom. Volte sempre."
            : "A casa vai olhar isso hoje mesmo.";
        fim.hidden = false;
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      // \`erro\` é o formato da rota; \`error\` só aparece quando o limite
      // de envios corta o pedido antes de ele chegar lá.
      erro(res.corpo.erro || res.corpo.error || "Não consegui enviar agora.");
      enviar.disabled = false;
      enviar.textContent = antes;
    })
    .catch(function(){
      erro("Sem conexão agora. Tente de novo em instantes.");
      enviar.disabled = false;
      enviar.textContent = antes;
    });
  });
})();
</script>
</body>
</html>
`;
}

const CASAS = [
  {
    pasta: 'bar', slug: 'kikiu', casa: 'Kikiu Gastrobar',
    pergunta: 'Como foi sua noite?',
    exemplo: 'O drink da casa, o som, o atendimento… o que quiser contar.',
    aspectos: ['atendimento', 'drinks', 'comida', 'ambiente', 'musica', 'espera'],
    logo: { src: 'assets/img/logos/web/kikiu-escuro.png', alt: 'Kikiu Gastrobar', largura: 180, altura: 58 },
    icone: { aba: 'assets/img/icone/kikiu-32.png', inicio: 'assets/img/icone/kikiu-180.png' },
    fontes: 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;800&family=Karla:wght@400;500;700&display=swap',
    tema: {
      papel: '#1e3a45', tinta: '#f7efe7', suave: 'rgba(247,239,231,.64)', marca: '#f2a882',
      fio: 'rgba(247,239,231,.20)', barra: '#142831', sobreBarra: '#f7efe7',
      display: '"Outfit", sans-serif', texto: '"Karla", sans-serif',
      pesoDisplay: 800, logoAltura: 52,
    },
  },
  {
    pasta: 'japones', slug: 'saiko', casa: 'Saikō Gastronomia Oriental',
    pergunta: 'Como foi seu jantar?',
    exemplo: 'O sushi, o saquê, o balcão… o que quiser contar.',
    // Sem "música": o Saikō não tem show. Oferecer um assunto que a casa
    // não tem é convidar a pessoa a reclamar de algo que não existe.
    aspectos: ['atendimento', 'comida', 'drinks', 'ambiente', 'espera'],
    logo: { src: 'assets/img/logos/web/saiko-escuro.png', alt: 'Saikō — Gastronomia Oriental', largura: 78, altura: 88 },
    icone: { aba: 'assets/img/icone/saiko-32.png', inicio: 'assets/img/icone/saiko-180.png' },
    fontes: 'https://fonts.googleapis.com/css2?family=Shippori+Mincho+B1:wght@400;600;800&family=Zen+Kaku+Gothic+New:wght@400;500;700&display=swap',
    tema: {
      papel: '#f6f2e9', tinta: '#17140f', suave: '#6a6156', marca: '#d21f27',
      fio: '#d8cfbc', barra: '#100e0b', sobreBarra: '#f6f2e9',
      display: '"Shippori Mincho B1", serif', texto: '"Zen Kaku Gothic New", sans-serif',
      pesoDisplay: 600, logoAltura: 66,
    },
  },
  {
    pasta: 'italiano', slug: 'forneatto', casa: 'Forneatto Cucina',
    pergunta: 'Como foi sua refeição?',
    exemplo: 'A pizza, a massa, o vinho… o que quiser contar.',
    aspectos: ['atendimento', 'comida', 'drinks', 'ambiente', 'espera'],
    // O logo do Forneatto só existe na versão para FUNDO CLARO — a
    // palavra "FORNEATTO" é verde-escura. Sobre a barra verde da casa
    // ela some, e sobrava a rodela vermelha da pizza flutuando sozinha
    // (visto na tela, não no código). Por isso a barra aqui é creme, com
    // um fio vermelho embaixo para não virar "papel em cima de papel".
    logo: { src: 'assets/img/logos/web/forneatto-claro.png', alt: 'Forneatto Cucina', largura: 76, altura: 64 },
    icone: { aba: 'assets/img/icone/forneatto-32.png', inicio: 'assets/img/icone/forneatto-180.png' },
    fontes: 'https://fonts.googleapis.com/css2?family=Bodoni+Moda:opsz,wght@6..96,400;6..96,700&family=Archivo:wght@400;500;700&display=swap',
    tema: {
      papel: '#fbf8f1', tinta: '#17140f', suave: '#6d6659', marca: '#c4161c',
      fio: '#ddd4c2', barra: '#f2ebdc', sobreBarra: '#17140f', fioDaBarra: '#c4161c',
      display: '"Bodoni Moda", Georgia, serif', texto: '"Archivo", sans-serif',
      pesoDisplay: 700, logoAltura: 64,
    },
  },
];

// Um repositorio por casa. A tabela CASAS fica inteira de proposito: o tema,
// os aspectos e a pergunta de cada casa foram decididos olhando as tres lado
// a lado, e separa-las esconderia a comparacao. So a desta casa e escrita.
const SO_ESTA_CASA = 'kikiu';

const c = CASAS.find(x => x.slug === SO_ESTA_CASA);
if (!c) throw new Error(`casa "${SO_ESTA_CASA}" nao esta na tabela CASAS`);

await writeFile(join(RAIZ, 'opiniao.html'), pagina(c));
console.log(`   -> opiniao.html  (o QR de "como foi?" da mesa do ${c.casa})`);
