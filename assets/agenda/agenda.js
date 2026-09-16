/* ═══════════════════════════════════════════════════════════════════
   AGENDA DA CASA — o mesmo script nas três

   Uso, dentro da página da casa:

     <section class="agd-secao" id="agenda" hidden>
       ...
       <div class="agd" data-agenda="kikiu"></div>
     </section>
     <script src="/assets/agenda/agenda.js" defer></script>

   A SEÇÃO NASCE `hidden` E SÓ APARECE SE HOUVER ATRAÇÃO PUBLICADA.

   Isso não é detalhe de carregamento, é a regra do produto. Uma agenda
   vazia na página diz ao cliente "não acontece nada aqui" — pior do que
   não ter agenda. E se o sistema estiver fora do ar, o site da casa
   continua inteiro, só sem esse bloco.

   O QUE ESTE ARQUIVO NÃO FAZ: não decide o que mostrar. Quem filtra o
   que está publicado, o que já passou e até onde vai a janela é o
   sistema — no relógio DA CASA, que é o único que importa. Entre 20h e
   meia-noite em Cuiabá o servidor já virou o dia em UTC; se essa conta
   estivesse aqui, o show desta noite sumiria do site justamente na hora
   em que as pessoas decidem sair.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var API = "/agenda-api";

  var SIGLA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
  var MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

  /**
   * "2026-09-17" -> { sigla: "qui", dia: "17 set" }.
   *
   * Sem `new Date("2026-09-17")`: aquilo é lido como meia-noite UTC e, em
   * qualquer fuso a oeste, volta um dia — a quinta vira quarta na tela de
   * quem está em Cuiabá. A data já é o dia da casa; aqui só se formata.
   */
  function pedaços(iso) {
    var p = iso.split("-");
    var semana = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay();
    return { sigla: SIGLA[semana], dia: (+p[2]) + " " + MESES[+p[1] - 1] };
  }

  function el(tag, classe, texto) {
    var n = document.createElement(tag);
    if (classe) n.className = classe;
    if (texto != null && texto !== "") n.textContent = texto;
    return n;
  }

  function montar(raiz) {
    var slug = raiz.getAttribute("data-agenda");
    if (!slug) return;
    var secao = raiz.closest(".agd-secao") || raiz;

    fetch(API + "/" + encodeURIComponent(slug), { headers: { accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (d) {
        var eventos = (d && d.eventos) || [];
        if (!eventos.length) return;            // a seção continua escondida
        desenhar(raiz, eventos);
        secao.hidden = false;
      })
      .catch(function () {
        /* Sistema fora do ar: a seção fica escondida e o resto do site da
           casa funciona igual. */
      });
  }

  function desenhar(raiz, eventos) {
    var grade = el("ul", "agd__grade");

    eventos.forEach(function (e) {
      var p = pedaços(e.data);
      var cartao = el("li", "agd__dia" + (e.destaque ? " agd__dia--destaque" : ""));

      cartao.appendChild(el("span", "agd__sigla", p.sigla));
      cartao.appendChild(el("span", "agd__data", p.dia));
      // <p>, e não <h3>: a página do Kikiu deixa TODO título em minúscula
      // (`h1,h2,h3 { text-transform: lowercase }`), o que é a voz da casa
      // no texto dela — mas isto aqui é o que o gerente digitou, e
      // "MPB ao vivo" virava "mpb ao vivo". Texto de quem usa o sistema
      // sai como foi escrito.
      cartao.appendChild(el("p", "agd__o", e.titulo));
      if (e.artista)   cartao.appendChild(el("span", "agd__quem", e.artista));
      if (e.descricao) cartao.appendChild(el("span", "agd__quem", e.descricao));
      // Sem hora quer dizer o dia todo — promoção, happy hour. Dizer isso
      // é melhor do que deixar o cartão mudo e a grade desalinhada.
      cartao.appendChild(el("span", "agd__h", e.hora || "o dia todo"));
      if (e.entrada)   cartao.appendChild(el("span", "agd__h", e.entrada));

      grade.appendChild(cartao);
    });

    raiz.appendChild(grade);
  }

  function iniciar() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-agenda]"), montar);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
