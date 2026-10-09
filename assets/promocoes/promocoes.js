/* ═══════════════════════════════════════════════════════════════════
   PROMOÇÕES DA CASA — o que vale hoje, lido do painel.

   Irmã da agenda (assets/agenda/agenda.js) e vestida com a MESMA folha
   (.agd): a casa já declarou as cores dela nos tokens --agd-*, e a
   promoção sai com a mesma roupa da agenda sem uma linha de CSS nova.

   A diferença é o tempo. A agenda é um dia (quinta, 20h30); a promoção
   é um período — "toda terça", "até 31 out" — e pode valer só em alguns
   dias da semana. O QUE VALE e ATÉ QUANDO é decidido pelo sistema, no
   calendário da casa: o site só desenha o que chegou. `hoje` vem de lá
   e é o que faz o cartão gritar "hoje" na terça do chopp e ficar quieto
   na quarta — sem tirar a promoção da lista, porque o cliente planeja
   a semana.

   Nasce escondida: a seção só aparece se houver promoção valendo.
   Seção vazia diz "esta casa não faz promoção", que é pior que não ter.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var API = "/promocoes-api";

  /* ISODOW, como o sistema manda: 1 = segunda … 7 = domingo. */
  var CURTO = [null, "seg", "ter", "qua", "qui", "sex", "sáb", "dom"];
  var NOME  = [null, "toda segunda", "toda terça", "toda quarta", "toda quinta",
               "toda sexta", "todo sábado", "todo domingo"];
  var MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

  function el(tag, classe, texto) {
    var n = document.createElement(tag);
    if (classe) n.className = classe;
    if (texto != null && texto !== "") n.textContent = texto;
    return n;
  }

  /* "2026-10-31" -> "31 out". Sem `new Date(...)`: meia-noite UTC vira o
     dia anterior em Cuiabá. A data já é a da casa; aqui só se formata. */
  function diaMes(iso) {
    var p = iso.split("-");
    return (+p[2]) + " " + MESES[+p[1] - 1];
  }

  function dias(p) { return (p.dias_semana || []).map(Number).filter(function (d) { return d >= 1 && d <= 7; }); }

  /* O texto grande do cartão — onde a agenda põe o dia da semana. */
  function chamada(p) {
    var d = dias(p);
    if (!d.length || d.length === 7) return "todo dia";
    if (p.hoje) return "hoje";
    if (d.length === 1) return CURTO[d[0]];
    return d.map(function (n) { return CURTO[n]; }).join("·");
  }

  function diasPorExtenso(p) {
    var d = dias(p);
    if (!d.length || d.length === 7) return "";
    var nomes = d.map(function (n) { return NOME[n]; });
    return nomes.length === 1 ? nomes[0] : nomes.slice(0, -1).join(", ") + " e " + nomes[nomes.length - 1];
  }

  function montar(raiz) {
    var slug = raiz.getAttribute("data-promocoes");
    if (!slug) return;
    var secao = raiz.closest(".agd-secao") || raiz;

    fetch(API + "/" + encodeURIComponent(slug), { headers: { accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (d) {
        var promocoes = (d && d.promocoes) || [];
        if (!promocoes.length) return;        // a seção continua escondida
        desenhar(raiz, promocoes);
        secao.hidden = false;
      })
      .catch(function () {
        /* Sistema fora do ar: a seção fica escondida e o resto do site da
           casa funciona igual. */
      });
  }

  function desenhar(raiz, promocoes) {
    var grade = el("ul", "agd__grade");

    promocoes.forEach(function (p) {
      var cartao = el("li", "agd__dia" + (p.destaque ? " agd__dia--destaque" : ""));

      var grande = el("span", "agd__sigla", chamada(p));
      // "ter·qui" e "todo dia" não cabem no tamanho de "qui": encolhe só
      // quando o texto passa de uma sigla.
      if (grande.textContent.length > 4) grande.style.fontSize = "clamp(20px, 2.4vw, 28px)";
      cartao.appendChild(grande);

      cartao.appendChild(el("span", "agd__data", p.fim ? "até " + diaMes(p.fim) : "enquanto durar"));
      // <p>, não <h3>: é o que o gerente digitou, e sai como foi escrito
      // (a página do Kikiu põe todo título em minúscula).
      cartao.appendChild(el("p", "agd__o", p.titulo));
      if (p.descricao) cartao.appendChild(el("span", "agd__quem", p.descricao));
      var extenso = diasPorExtenso(p);
      if (extenso) cartao.appendChild(el("span", "agd__h", extenso));

      grade.appendChild(cartao);
    });

    raiz.appendChild(grade);
  }

  function iniciar() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-promocoes]"), montar);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
