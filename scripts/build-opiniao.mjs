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
 * O convite para avaliar no Google, se a casa tiver um.
 *
 * Mora no `casa.json` porque é dado DESTA casa, como o domínio. Vazio
 * (que é como nasce) simplesmente não desenha o botão — melhor não ter
 * convite do que ter um que leva a lugar nenhum.
 */
const casaJson = JSON.parse(await readFile(join(RAIZ, 'casa.json'), 'utf8')).casa;
const GOOGLE = String(casaJson.googleAvaliar ?? '').trim();

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
  // As três casas, para a pergunta "em qual você está?" e para o convite do fim.
  const CASAS_JSON = JSON.stringify(CASAS.map(x => ({
    slug: x.slug, curto: x.curto, frase: x.frase, dominio: x.dominio,
    img: `assets/img/casas/${x.slug}.png`,
  }))).replace(/</g, '\\u003c');
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
[hidden]{display:none!important}

.capa{background:var(--barra);color:var(--sobre-barra);text-align:center;
  padding:calc(26px + env(safe-area-inset-top)) 20px 22px${t.fioDaBarra ? `;border-bottom:4px solid ${t.fioDaBarra}` : ''}}
.capa__logo{height:${t.logoAltura}px;width:auto;max-width:76%;margin:0 auto}
.capa__mesa{display:inline-block;margin-top:15px;padding:5px 15px;border-radius:999px;
  border:1px solid currentColor;font-size:11.5px;font-weight:700;letter-spacing:.12em;
  text-transform:uppercase;opacity:.82}

/* A barra de progresso: quem está de pé com o celular na mão precisa ver que
   falta pouco. Sem ela, "mais uma pergunta" vira "quando isso acaba?". */
.progresso{height:4px;background:color-mix(in srgb,var(--tinta) 12%,transparent)}
.progresso i{display:block;height:100%;width:0;background:var(--marca);transition:width .35s ease}

main{max-width:560px;margin:0 auto;padding:26px 20px calc(40px + env(safe-area-inset-bottom))}
h1,h2{font-family:var(--display);font-weight:${t.pesoDisplay};line-height:1.18;margin:0;text-align:center}
h1{font-size:clamp(25px,6.4vw,31px)}
h2{font-size:clamp(22px,5.8vw,27px)}
.sub{margin:10px 0 0;text-align:center;font-size:14px;color:var(--suave)}
.soleitor{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0)}

.passo{animation:entra .28s ease both}
@keyframes entra{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.topo-passo{display:flex;align-items:center;justify-content:space-between;min-height:30px;margin-bottom:14px}
.voltar{appearance:none;background:none;border:0;color:var(--suave);font:inherit;font-size:14px;
  cursor:pointer;padding:6px 2px}
.voltar:focus-visible{outline:2px solid var(--marca);outline-offset:2px}
.conta{font-size:12.5px;color:var(--suave)}

/* Escolha da casa */
.casas{display:grid;gap:10px;margin-top:22px}
.casa{display:flex;align-items:center;gap:14px;text-align:left;width:100%;cursor:pointer;
  text-decoration:none;color:var(--tinta);font:inherit;background:transparent;
  border:1px solid var(--fio);border-radius:14px;padding:12px 14px;transition:border-color .15s,background .15s}
.casa img{width:52px;height:52px;border-radius:12px;flex:none}
.casa b{display:block;font-family:var(--display);font-weight:${t.pesoDisplay};font-size:18px;line-height:1.2}
.casa span{display:block;font-size:13px;color:var(--suave)}
.casa em{margin-left:auto;font-style:normal;font-size:11.5px;letter-spacing:.1em;text-transform:uppercase;
  color:var(--marca);font-weight:700;white-space:nowrap}
.casa:hover,.casa:focus-visible{border-color:var(--marca);outline:none}

/* As cinco notas. Uma linha no celular, sem rolagem lateral: quem está de
   pé com o celular na mão não descobre que existe conteúdo fora da tela. */
.notas{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;margin-top:24px}
.nota{appearance:none;-webkit-appearance:none;background:transparent;cursor:pointer;
  border:1px solid var(--fio);border-radius:12px;padding:13px 2px 10px;
  display:flex;flex-direction:column;align-items:center;gap:6px;
  color:var(--tinta);font:inherit;font-size:11.5px;transition:border-color .15s,background .15s}
.nota svg{width:27px;height:27px;stroke:currentColor;fill:none;stroke-width:1.6;stroke-linecap:round}
.nota[aria-pressed="true"]{background:var(--marca);border-color:var(--marca);color:#fff}
.nota:focus-visible{outline:2px solid var(--marca);outline-offset:2px}

.fichas{display:flex;flex-wrap:wrap;justify-content:center;gap:10px;margin-top:24px}
.ficha{appearance:none;-webkit-appearance:none;cursor:pointer;font:inherit;font-size:15px;
  background:transparent;color:var(--tinta);border:1px solid var(--fio);
  border-radius:999px;padding:11px 18px;transition:border-color .15s,background .15s}
.ficha[aria-pressed="true"]{background:var(--marca);border-color:var(--marca);color:#fff}
.ficha:focus-visible{outline:2px solid var(--marca);outline-offset:2px}
.ficha--quieta{border-style:dashed;color:var(--suave)}

/* NPS: 0 a 10, do vermelho ao verde. A cor ajuda, mas o número é que vale. */
.nps{display:grid;grid-template-columns:repeat(6,1fr);gap:8px;margin-top:24px}
.nps button{appearance:none;-webkit-appearance:none;cursor:pointer;font:inherit;font-size:18px;
  font-weight:700;padding:14px 0;border-radius:12px;color:var(--tinta);background:transparent;
  border:2px solid hsl(var(--h) 70% 50% / .55);transition:background .15s,color .15s}
.nps button:hover,.nps button:focus-visible{background:hsl(var(--h) 70% 50% / .22);outline:none}
.nps button[aria-pressed="true"]{background:hsl(var(--h) 65% 42%);border-color:hsl(var(--h) 65% 42%);color:#fff}
.nps-pontas{display:flex;justify-content:space-between;margin-top:9px;font-size:12.5px;color:var(--suave)}

textarea,input[type=text],input[type=tel]{font:inherit;font-size:16px;/* 16px trava o zoom do iOS ao focar */
  width:100%;color:var(--tinta);background:transparent;border:1px solid var(--fio);
  border-radius:11px;padding:12px 13px}
textarea{min-height:104px;resize:vertical;margin-top:22px}
::placeholder{color:var(--suave);opacity:1}
textarea:focus-visible,input:focus-visible{outline:none;border-color:var(--marca);
  box-shadow:0 0 0 3px color-mix(in srgb,var(--marca) 26%,transparent)}
.dupla{display:grid;gap:10px;margin-top:10px}
@media(min-width:420px){.dupla{grid-template-columns:1fr 1fr}}
.bloco{margin-top:22px;padding:16px;border:1px solid var(--fio);border-radius:14px}
.bloco label.marca{display:flex;gap:12px;align-items:flex-start;cursor:pointer;font-size:15px;line-height:1.4}
.bloco input[type=checkbox]{width:22px;height:22px;flex:none;margin:1px 0 0;accent-color:var(--marca)}
.bloco p{margin:8px 0 0;font-size:12.5px;color:var(--suave)}
.rotulo{display:block;font-size:11.5px;letter-spacing:.14em;text-transform:uppercase;
  color:var(--suave);margin:24px 0 9px}

/* A armadilha: fora da tela, sem foco, fora da tabulação. Nem display:none
   nem hidden — robô bom pula os dois. */
.armadilha{position:absolute!important;left:-9999px!important;width:1px;height:1px;overflow:hidden}

.botao{width:100%;margin-top:24px;cursor:pointer;font-family:var(--display);
  font-weight:${t.pesoDisplay};font-size:16px;letter-spacing:.04em;
  color:#fff;background:var(--marca);border:0;border-radius:12px;padding:16px}
.botao:disabled{opacity:.45;cursor:not-allowed}
.pular{display:block;margin:14px auto 0;appearance:none;background:none;border:0;cursor:pointer;
  font:inherit;font-size:14px;color:var(--suave);text-decoration:underline;padding:6px}
.ajuda{margin:12px 0 0;font-size:12.5px;color:var(--suave);text-align:center;line-height:1.5}

.recado{margin-top:18px;padding:14px 16px;border-radius:12px;border:1px solid #c0392b;
  background:color-mix(in srgb,#c0392b 10%,transparent);font-size:15px;line-height:1.5}
.fim{text-align:center;padding:14px 0 0}
.fim h2{margin-bottom:8px}

/* O convite do Google aparece para QUEM QUER QUE TENHA respondido, e nao
   so para quem gostou. Oferecer o Google apenas a quem deu nota alta e
   "review gating": a politica de conteudo do Google proibe pedir
   avaliacao de forma seletiva, e a punicao vai de apagar as avaliacoes a
   derrubar o perfil da casa. Alem disso o volume, que e o que pesa na
   busca, vem de perguntar a todo mundo.
   O caminho de tratar a nota baixa e a tela de Feedback do painel, com o
   WhatsApp do cliente do lado — resolver antes, nao esconder o botao. */
.google{display:inline-flex;align-items:center;justify-content:center;gap:9px;
  margin-top:22px;padding:14px 22px;border-radius:12px;text-decoration:none;
  font-family:var(--display);font-weight:${t.pesoDisplay};font-size:15px;letter-spacing:.03em;
  color:var(--tinta);background:transparent;border:1px solid var(--fio)}
.google:hover{border-color:var(--marca);color:var(--marca)}
.ajuda-google{margin:10px 0 0;font-size:12.5px;color:var(--suave);line-height:1.5}
.outra{margin-top:34px;padding-top:24px;border-top:1px solid var(--fio)}
.outra .casas{margin-top:14px}
@media(prefers-reduced-motion:reduce){*{transition:none!important;animation:none!important}}
</style>
</head>
<body>

<header class="capa">
  <img class="capa__logo" src="${esc(c.logo.src)}" alt="${esc(c.logo.alt)}"
       width="${c.logo.largura}" height="${c.logo.altura}" fetchpriority="high">
  <span class="capa__mesa" id="mesa" hidden></span>
</header>
<div class="progresso" aria-hidden="true"><i id="barra"></i></div>

<main>
  <h1 class="soleitor">${esc(c.casa)} — como foi sua visita</h1>

  <form id="form" novalidate>

    <!-- 0 · em qual casa? -->
    <section class="passo" data-passo="casa" hidden>
      <h2>Em qual casa você está?</h2>
      <p class="sub">Assim a gente sabe de quem você está falando.</p>
      <div class="casas" id="escolha"></div>
    </section>

    <!-- 1 · a nota -->
    <section class="passo" data-passo="nota" hidden>
      <div class="topo-passo"><button type="button" class="voltar" data-voltar hidden>← Voltar</button><span class="conta"></span></div>
      <h2>${esc(c.pergunta)}</h2>
      <p class="sub">Leva menos de um minuto e chega direto para a gente.</p>
      <div class="notas" role="group" aria-label="Sua nota">
        ${NOTAS.map(n => `<button type="button" class="nota" data-nota="${n.n}" aria-pressed="false">
          <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.2"/><path d="M9 10h.01M15 10h.01"/><path d="${n.cara}"/></svg>
          ${n.rotulo}
        </button>`).join('\n        ')}
      </div>
      <p class="ajuda" id="trocar" hidden>Não é o ${esc(c.curto)}? <a href="#" id="trocar-casa" style="color:inherit">Escolher outra casa</a></p>
    </section>

    <!-- 2 · o que pesou -->
    <section class="passo" data-passo="aspectos" hidden>
      <div class="topo-passo"><button type="button" class="voltar" data-voltar>← Voltar</button><span class="conta"></span></div>
      <h2 id="aspectos-titulo">O que foi melhor?</h2>
      <p class="sub" id="aspectos-sub">Pode marcar mais de um.</p>
      <div class="fichas" role="group" aria-labelledby="aspectos-titulo">
        ${c.aspectos.map(a => `<button type="button" class="ficha" data-aspecto="${a}" aria-pressed="false">${esc(ASPECTOS[a])}</button>`).join('\n        ')}
      </div>
      <button type="button" class="botao" data-seguir>Continuar</button>
      <button type="button" class="pular" data-seguir>Pular</button>
    </section>

    <!-- 3 · quem atendeu (só aparece se a casa cadastrou a equipe) -->
    <section class="passo" data-passo="atendente" hidden>
      <div class="topo-passo"><button type="button" class="voltar" data-voltar>← Voltar</button><span class="conta"></span></div>
      <h2>Quem te atendeu?</h2>
      <p class="sub">Se lembrar do nome, ajuda a gente a reconhecer quem foi bem.</p>
      <div class="fichas" id="equipe" role="group" aria-label="Quem atendeu"></div>
    </section>

    <!-- 4 · NPS (só quem deu nota boa) -->
    <section class="passo" data-passo="nps" hidden>
      <div class="topo-passo"><button type="button" class="voltar" data-voltar>← Voltar</button><span class="conta"></span></div>
      <h2>De 0 a 10, quanto você indicaria o ${esc(c.curto)} para um amigo?</h2>
      <div class="nps" role="group" aria-label="De 0 a 10">
        ${Array.from({ length: 11 }, (_, i) => `<button type="button" data-nps="${i}" style="--h:${Math.round(i * 12)}" aria-pressed="false">${i}</button>`).join('\n        ')}
      </div>
      <div class="nps-pontas"><span>Nem pensar</span><span>Com certeza</span></div>
      <button type="button" class="pular" data-seguir>Pular</button>
    </section>

    <!-- 5 · o recado e, se for o caso, o contato -->
    <section class="passo" data-passo="final" hidden>
      <div class="topo-passo"><button type="button" class="voltar" data-voltar>← Voltar</button><span class="conta"></span></div>
      <h2 id="final-titulo">Quer deixar um recado?</h2>
      <p class="sub" id="final-sub">Opcional.</p>
      <textarea id="comentario" maxlength="1000" placeholder="${esc(c.exemplo)}" aria-label="Seu recado"></textarea>

      <div class="bloco" id="bloco-contato" hidden>
        <label class="marca"><input type="checkbox" id="quer"> <span><b>Quero que a gerência fale comigo.</b></span></label>
        <div id="dados-contato" hidden>
          <div class="dupla">
            <input id="nome-c" type="text" maxlength="120" autocomplete="name" placeholder="Seu nome">
            <input id="tel-c" type="tel" maxlength="30" inputmode="tel" autocomplete="tel" placeholder="WhatsApp com DDD">
          </div>
          <p>Só a gerência vê. Vamos te chamar no WhatsApp ainda hoje.</p>
        </div>
      </div>

      <div class="bloco" id="bloco-nome" hidden>
        <b style="font-size:15px">Quer se identificar? <span style="font-weight:400;color:var(--suave)">(opcional)</span></b>
        <div class="dupla">
          <input id="nome" type="text" maxlength="120" autocomplete="name" placeholder="Seu nome">
          <input id="telefone" type="tel" maxlength="30" inputmode="tel" autocomplete="tel" placeholder="WhatsApp">
        </div>
        <p>Sem nome, a resposta é anônima.</p>
      </div>

      <div class="armadilha" aria-hidden="true">
        <input type="text" id="sobrenome" tabindex="-1" autocomplete="off">
      </div>

      <button class="botao" type="submit" id="enviar">Enviar</button>
      <p class="recado" id="recado" role="status" aria-live="polite" hidden></p>
    </section>
  </form>

  <div class="fim" id="fim" hidden>
    <h2 id="fim-titulo"></h2>
    <p class="sub" id="fim-texto"></p>
${GOOGLE ? `    <a class="google" href="${esc(GOOGLE)}" target="_blank" rel="noopener">
      <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="m12 2 2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2 5.9 20.6l1.4-6.8L2.2 9.1l6.9-.8L12 2Z"/></svg>
      Avaliar no Google
    </a>
    <p class="ajuda-google">Leva menos de um minuto e ajuda muita gente a nos achar.</p>` : ''}
    <div class="outra">
      <h2 style="font-size:20px">Esteve em outra casa do grupo?</h2>
      <div class="casas" id="outras"></div>
    </div>
  </div>
</main>

<script>
(function(){
  "use strict";
  var AQUI = ${JSON.stringify(c.slug)};
  var CURTO = ${JSON.stringify(c.curto)};
  var CASAS = ${CASAS_JSON};
  var API = "/opiniao-api/" + AQUI;
  var q = new URLSearchParams(location.search);

  var estado = { nota: null, aspectos: [], atendente: null, nps: null };
  var equipe = [];
  var historico = [];
  var form = document.getElementById("form");

  // O número da mesa vem do QR: cada adesivo tem o seu. É o que deixa a
  // casa resolver com a pessoa ainda sentada.
  var mesa = q.get("mesa");
  if (mesa && /^[A-Za-z0-9 -]{1,20}$/.test(mesa)) {
    var el = document.getElementById("mesa");
    el.textContent = "Mesa " + mesa;
    el.hidden = false;
  } else { mesa = null; }

  // De onde a pessoa veio: do adesivo da mesa, do portal do wi-fi, ou de um link.
  var origem = mesa ? "qr" : (q.get("o") === "portal" ? "portal" : "site");

  // Quem chega pelo adesivo da mesa JÁ sabe onde está: a pergunta de "qual
  // casa" só atrapalharia. Quem chega por link ou pelo wi-fi escolhe — a menos
  // que já tenha escolhido (c=1), que é o caso de quem veio de outra casa.
  var jaSabe = !!mesa || q.get("c") === "1";

  // ── a lista de quem atende ─────────────────────────────────────────
  // Falhou ou veio vazia? O passo simplesmente não existe: pergunta sem
  // resposta possível é só mais um toque no caminho de quem está com pressa.
  fetch(API, { headers: { accept: "application/json" } })
    .then(function(r){ return r.ok ? r.json() : null; })
    .then(function(d){ if (d && Array.isArray(d.atendentes)) equipe = d.atendentes; })
    .catch(function(){});

  function href(casa){
    return "https://" + casa.dominio + "/opiniao?c=1" + (q.get("o") === "portal" ? "&o=portal" : "");
  }

  function cartaoDeCasa(casa, aqui){
    var inner = '<img src="' + casa.img + '" alt="" width="52" height="52"><div><b></b><span></span></div>' +
      (aqui ? '<em>Aqui</em>' : '');
    var no = document.createElement(aqui ? "button" : "a");
    no.className = "casa";
    if (aqui) { no.type = "button"; } else { no.href = href(casa); }
    no.innerHTML = inner;
    no.querySelector("b").textContent = casa.curto;
    no.querySelector("span").textContent = casa.frase;
    return no;
  }

  var escolha = document.getElementById("escolha");
  CASAS.forEach(function(casa){
    var aqui = casa.slug === AQUI;
    var no = cartaoDeCasa(casa, aqui);
    if (aqui) no.addEventListener("click", function(){ ir("nota"); });
    escolha.appendChild(no);
  });
  var outras = document.getElementById("outras");
  CASAS.forEach(function(casa){
    if (casa.slug !== AQUI) outras.appendChild(cartaoDeCasa(casa, false));
  });

  // ── os passos ──────────────────────────────────────────────────────
  // A lista depende das respostas: nota baixa não pergunta NPS, casa sem
  // equipe cadastrada não pergunta quem atendeu.
  function lista(){
    var p = ["nota"];
    if (estado.nota) {
      p.push("aspectos");
      if (equipe.length) p.push("atendente");
      if (estado.nota >= 4) p.push("nps");
      p.push("final");
    } else {
      p.push("aspectos", "final");
    }
    return p;
  }

  var passoAtual = null;
  function ir(nome, semHistorico){
    if (passoAtual && !semHistorico) historico.push(passoAtual);
    passoAtual = nome;
    if (nome === "atendente") montarEquipe();
    if (nome === "final") prepararFinal();
    [].forEach.call(form.querySelectorAll("[data-passo]"), function(s){
      s.hidden = s.dataset.passo !== nome;
    });
    var l = lista(), i = l.indexOf(nome);
    var barra = document.getElementById("barra");
    barra.style.width = nome === "casa" ? "0%" : (i < 0 ? 100 : Math.round(100 * (i + 1) / (l.length + 0))) + "%";
    var sec = form.querySelector('[data-passo="' + nome + '"]');
    var conta = sec.querySelector(".conta");
    // antes da nota o total ainda não existe (nota baixa tem menos passos que
    // nota alta): dizer "1 de 3" e depois "4 de 5" seria prometer o que não dá
    if (conta && i >= 0) conta.textContent = (nome === "nota" && !estado.nota) ? "" : (i + 1) + " de " + l.length;
    var voltar = sec.querySelector("[data-voltar]");
    if (voltar) voltar.hidden = historico.length === 0;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function proximo(){
    var l = lista(), i = l.indexOf(passoAtual);
    ir(l[i + 1]);
  }

  form.addEventListener("click", function(ev){
    var b = ev.target.closest("button");
    if (!b || b.type === "submit") return;

    if (b.hasAttribute("data-voltar")) { ir(historico.pop() || "nota", true); return; }
    if (b.hasAttribute("data-seguir")) { proximo(); return; }

    if (b.dataset.nota) {
      var nova = Number(b.dataset.nota);
      var eraBoa = estado.nota >= 4;
      estado.nota = nova;
      // trocar a nota para baixo depois de ter dado NPS não deixa a resposta velha para trás
      if (nova < 4) estado.nps = null;
      [].forEach.call(form.querySelectorAll("[data-nota]"), function(o){
        o.setAttribute("aria-pressed", String(o === b));
      });
      var boa = nova >= 4;
      document.getElementById("aspectos-titulo").textContent = boa ? "O que foi melhor?" : "O que não foi bem?";
      document.getElementById("aspectos-sub").textContent = boa
        ? "Pode marcar mais de um."
        : "Pode marcar mais de um — a gente quer acertar.";
      setTimeout(proximo, 180);   // dá tempo de ver a carinha acender
      return;
    }

    if (b.dataset.aspecto) {
      var a = b.dataset.aspecto, i = estado.aspectos.indexOf(a);
      if (i >= 0) estado.aspectos.splice(i, 1); else estado.aspectos.push(a);
      b.setAttribute("aria-pressed", i < 0 ? "true" : "false");
      return;
    }

    if (b.hasAttribute("data-atendente")) {
      var id = b.dataset.atendente;
      estado.atendente = id === "" ? null : Number(id);
      [].forEach.call(form.querySelectorAll("[data-atendente]"), function(o){
        o.setAttribute("aria-pressed", String(o === b));
      });
      setTimeout(proximo, 180);
      return;
    }

    if (b.dataset.nps !== undefined) {
      estado.nps = Number(b.dataset.nps);
      [].forEach.call(form.querySelectorAll("[data-nps]"), function(o){
        o.setAttribute("aria-pressed", String(o === b));
      });
      setTimeout(proximo, 180);
    }
  });

  // monta os nomes quando o passo é aberto (a lista chega depois da página)
  function montarEquipe(){
    var alvo = document.getElementById("equipe");
    alvo.innerHTML = "";
    equipe.forEach(function(p){
      var b = document.createElement("button");
      b.type = "button"; b.className = "ficha"; b.setAttribute("data-atendente", String(p.id));
      b.setAttribute("aria-pressed", String(estado.atendente === p.id));
      b.textContent = p.nome;
      alvo.appendChild(b);
    });
    var nao = document.createElement("button");
    nao.type = "button"; nao.className = "ficha ficha--quieta"; nao.setAttribute("data-atendente", "");
    nao.setAttribute("aria-pressed", "false");
    nao.textContent = "Não me lembro";
    alvo.appendChild(nao);
  }
  // O fim muda conforme a nota: quem foi mal recebe o convite de ser chamado;
  // quem foi bem recebe o convite de se identificar, sem pressão.
  function prepararFinal(){
    var boa = estado.nota >= 4;
    document.getElementById("final-titulo").textContent = boa ? "Quer deixar um recado?" : "Conta pra gente o que aconteceu";
    document.getElementById("final-sub").textContent = boa ? "Opcional." : "Quanto mais a gente souber, melhor consegue resolver.";
    document.getElementById("bloco-contato").hidden = boa;
    document.getElementById("bloco-nome").hidden = !boa;
  }

  document.getElementById("quer").addEventListener("change", function(){
    document.getElementById("dados-contato").hidden = !this.checked;
    if (this.checked) document.getElementById("nome-c").focus();
  });

  var trocar = document.getElementById("trocar");
  if (jaSabe && !q.get("c")) trocar.hidden = false;   // veio do adesivo: dá uma saída se for a casa errada
  document.getElementById("trocar-casa").addEventListener("click", function(ev){
    ev.preventDefault();
    ir("casa");
  });

  var recado = document.getElementById("recado");
  function erro(texto){ recado.textContent = texto; recado.hidden = false; }

  form.addEventListener("submit", function(ev){
    ev.preventDefault();
    if (!estado.nota) { ir("nota"); return; }
    recado.hidden = true;

    var boa = estado.nota >= 4;
    var quer = !boa && document.getElementById("quer").checked;
    var nome, telefone;
    if (quer) {
      nome = document.getElementById("nome-c").value.trim();
      telefone = document.getElementById("tel-c").value.trim();
      if (telefone.replace(/\\D/g, "").length < 10) {
        erro("Para a gerência falar com você, informe o WhatsApp com DDD.");
        document.getElementById("tel-c").focus();
        return;
      }
    } else if (boa) {
      nome = document.getElementById("nome").value.trim();
      telefone = document.getElementById("telefone").value.trim();
    }

    var enviar = document.getElementById("enviar");
    var antes = enviar.textContent;
    enviar.disabled = true; enviar.textContent = "Enviando…";

    fetch(API, {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json" },
      body: JSON.stringify({
        nota: estado.nota,
        aspectos: estado.aspectos,
        nps: estado.nps === null ? undefined : estado.nps,
        atendente_id: estado.atendente || undefined,
        quer_contato: quer || undefined,
        origem: origem,
        comentario: document.getElementById("comentario").value.trim() || undefined,
        mesa: mesa || undefined,
        nome: nome || undefined,
        telefone: telefone || undefined,
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
        document.getElementById("barra").style.width = "100%";
        document.getElementById("fim-titulo").textContent =
          quer ? "Obrigado por contar." : (boa ? "Obrigado!" : "Obrigado por contar.");
        document.getElementById("fim-texto").textContent =
          quer ? "A gerência vai falar com você no WhatsApp."
          : boa ? "Fico feliz que tenha sido bom. Volte sempre."
          : "A casa vai olhar isso hoje mesmo.";
        document.getElementById("fim").hidden = false;
        window.scrollTo({ top: 0, behavior: "smooth" });
        return;
      }
      // \`erro\` é o formato da rota; \`error\` só aparece quando o limite
      // de envios corta o pedido antes de ele chegar lá.
      erro(res.corpo.erro || res.corpo.error || "Não consegui enviar agora.");
      enviar.disabled = false; enviar.textContent = antes;
    })
    .catch(function(){
      erro("Sem conexão agora. Tente de novo em instantes.");
      enviar.disabled = false; enviar.textContent = antes;
    });
  });

  ir(jaSabe ? "nota" : "casa");
})();
</script>
</body>
</html>
`;
}

const CASAS = [
  {
    pasta: 'bar', slug: 'kikiu', casa: 'Kikiu Gastrobar', curto: 'Kikiu',
    dominio: 'kikiu.com.br', frase: 'Gastrobar · drinks e petiscos',
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
    pasta: 'japones', slug: 'saiko', casa: 'Saikō Gastronomia Oriental', curto: 'Saikō',
    dominio: 'saikogastronomia.com.br', frase: 'Gastronomia oriental',
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
    pasta: 'italiano', slug: 'forneatto', casa: 'Forneatto Cucina', curto: 'Forneatto',
    dominio: 'forneattocucina.com.br', frase: 'Cucina italiana · pizza e massas',
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
