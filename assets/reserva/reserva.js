/* ═══════════════════════════════════════════════════════════════════
   RESERVA PELO SITE — o mesmo script nas três casas

   Uso, dentro da página da casa:

     <div id="reservar" data-reserva="kikiu"
          data-whatsapp="https://wa.me/55...">
       <p class="rsv-sem-js">… link do WhatsApp, que é o que aparece
          enquanto isto aqui não carrega …</p>
     </div>
     <script src="/assets/reserva/reserva.js" defer></script>

   O `data-reserva` é o apelido da casa no sistema (saiko, forneatto,
   kikiu) — o mesmo que identifica o cardápio digital.

   DUAS COISAS QUE ESTE ARQUIVO NÃO FAZ, de propósito:

   1. Não sabe horário de funcionamento. As horas de cada dia vêm
      prontas do sistema, calculadas pela mesma função que vai julgar a
      reserva. Se a regra morasse aqui também, o turno que vira a noite
      (o Kikiu na sexta vai das 17h às 2h, então 01:00 é horário de
      SÁBADO no calendário) seria errado em algum momento — e ninguém
      descobriria até um cliente perder a mesa.

   2. Não converte fuso. Manda "2026-09-17" e "20:00" como quem fala:
      vinte horas, no relógio da casa. Quem sabe quanto isso vale em
      UTC é o sistema, que sabe onde a casa fica — não o celular de
      quem está reservando, que pode estar em qualquer lugar.

   O endereço /reservas-api/ é do próprio domínio da casa (um desvio
   configurado no vercel.json). O visitante nunca vê outro endereço.
   ═══════════════════════════════════════════════════════════════════ */
(function () {
  "use strict";

  var API = "/reservas-api";

  var DIAS = ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"];
  var MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];

  /** "2026-09-17" -> "quinta, 17 de set". Sem Date: fuso do navegador não entra nessa conta. */
  function porExtenso(iso) {
    var p = iso.split("-");
    // Date em UTC só para descobrir o dia da semana; a data já é a da casa.
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2]));
    return DIAS[d.getUTCDay()] + ", " + (+p[2]) + " de " + MESES[+p[1] - 1];
  }

  /** Hoje no relógio DA CASA, não no do visitante. */
  function hojeNaCasa(fuso) {
    try {
      // en-CA formata como AAAA-MM-DD, que é exatamente o que a API quer.
      return new Intl.DateTimeFormat("en-CA", { timeZone: fuso }).format(new Date());
    } catch (e) {
      return new Date().toISOString().slice(0, 10);
    }
  }

  function somarDias(iso, n) {
    var p = iso.split("-");
    var d = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2] + n));
    return d.toISOString().slice(0, 10);
  }

  function el(tag, attrs, filhos) {
    var n = document.createElement(tag);
    for (var k in attrs || {}) {
      if (k === "class") n.className = attrs[k];
      else if (k === "text") n.textContent = attrs[k];
      else n.setAttribute(k, attrs[k]);
    }
    (filhos || []).forEach(function (f) { n.appendChild(f); });
    return n;
  }

  function campo(rotulo, controle, largo) {
    var id = controle.id;
    return el("div", { class: "rsv__campo" + (largo ? " rsv__campo--largo" : "") }, [
      el("label", { class: "rsv__rotulo", for: id, text: rotulo }),
      controle,
    ]);
  }

  function montar(raiz) {
    var slug = raiz.getAttribute("data-reserva");
    if (!slug) return;
    var whats = raiz.getAttribute("data-whatsapp") || "";
    var estatico = raiz.querySelector(".rsv-sem-js");

    fetch(API + "/" + encodeURIComponent(slug) + "/horarios", { headers: { accept: "application/json" } })
      .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
      .then(function (casa) {
        // Casa sem agenda configurada continua só com o WhatsApp: melhor
        // do que deixar a pessoa preencher tudo para levar não no fim.
        if (!casa || !casa.aceita) return;
        desenhar(raiz, slug, casa, estatico, whats);
      })
      .catch(function () {
        /* Sistema fora do ar: o bloco do WhatsApp fica onde está. O site
           da casa não pode depender de outro serviço para funcionar. */
      });
  }

  function desenhar(raiz, slug, casa, estatico, whats) {
    var forma = el("form", { class: "rsv", novalidate: "novalidate" });
    var id = function (n) { return "rsv-" + slug + "-" + n; };

    var data = el("input", { type: "date", id: id("data"), name: "data", required: "required" });
    var hoje = hojeNaCasa(casa.fuso);
    data.min = hoje;
    data.max = somarDias(hoje, casa.janelaDias || 90);
    data.value = hoje;

    var hora = el("select", { id: id("hora"), name: "hora", required: "required" });
    var pessoas = el("select", { id: id("pessoas"), name: "pessoas", required: "required" });
    for (var i = 1; i <= 20; i++) {
      pessoas.appendChild(el("option", { value: String(i), text: i === 1 ? "1 pessoa" : i + " pessoas" }));
    }
    pessoas.value = "2";

    var nome = el("input", { type: "text", id: id("nome"), name: "nome", required: "required",
                             autocomplete: "name", placeholder: "Como te chamamos" });
    var tel = el("input", { type: "tel", id: id("telefone"), name: "telefone", required: "required",
                            autocomplete: "tel", inputmode: "tel", placeholder: "(65) 90000-0000" });
    var obs = el("textarea", { id: id("obs"), name: "observacao", maxlength: "500",
                               placeholder: "Aniversário, cadeirante, mesa na varanda… (opcional)" });

    // A armadilha. O nome é comum de propósito — robô que preenche tudo
    // que parece campo de nome cai aqui. Gente nunca vê.
    var armadilha = el("input", { type: "text", name: "sobrenome", tabindex: "-1",
                                  autocomplete: "off", "aria-hidden": "true" });
    var caixaArmadilha = el("div", { class: "rsv__armadilha", "aria-hidden": "true" }, [armadilha]);

    var enviar = el("button", { type: "submit", class: "rsv__enviar", text: "Pedir reserva" });
    var ajuda = el("p", { class: "rsv__ajuda",
      text: "A casa confirma em seguida — o pedido só vale depois disso." });
    var recado = el("p", { class: "rsv__recado", role: "status", "aria-live": "polite", hidden: "hidden" });

    forma.appendChild(el("div", { class: "rsv__grade" }, [
      campo("Dia", data),
      campo("Hora", hora),
      campo("Pessoas", pessoas),
      campo("Nome", nome),
      campo("Telefone", tel),
      campo("Observação", obs, true),
    ]));
    forma.appendChild(caixaArmadilha);
    forma.appendChild(el("div", { class: "rsv__acoes" }, [enviar, ajuda]));
    forma.appendChild(recado);

    function dizer(texto, tipo) {
      recado.textContent = "";
      recado.className = "rsv__recado rsv__recado--" + tipo;
      recado.appendChild(el("b", { text: tipo === "ok" ? "Pedido enviado" : "Não deu" }));
      recado.appendChild(document.createTextNode(texto));
      recado.hidden = false;
    }

    /* As horas de um dia vêm do sistema — ver o cabeçalho. Enquanto não
       chegam, o campo fica desabilitado: horário que a casa não abre
       nunca chega a ser oferecido. */
    var pedidoAtual = 0;
    function carregarHoras() {
      var meu = ++pedidoAtual;
      hora.innerHTML = "";
      hora.disabled = true;
      hora.appendChild(el("option", { value: "", text: "carregando…" }));
      fetch(API + "/" + encodeURIComponent(slug) + "/horarios?data=" + encodeURIComponent(data.value),
            { headers: { accept: "application/json" } })
        .then(function (r) { return r.ok ? r.json() : Promise.reject(r.status); })
        .then(function (d) {
          // Resposta de um dia que a pessoa já trocou: ignora, senão a
          // lista de terça aparece depois que ela escolheu sábado.
          if (meu !== pedidoAtual) return;
          hora.innerHTML = "";
          var horas = (d && d.horas) || [];
          if (!horas.length) {
            hora.appendChild(el("option", { value: "", text: "fechado neste dia" }));
            hora.disabled = true;
            enviar.disabled = true;
            return;
          }
          horas.forEach(function (h) { hora.appendChild(el("option", { value: h, text: h })); });
          // 20h é o que a maioria quer; se a casa não abre à noite, o
          // primeiro horário do dia serve.
          hora.value = horas.indexOf("20:00") >= 0 ? "20:00" : horas[0];
          hora.disabled = false;
          enviar.disabled = false;
        })
        .catch(function () {
          if (meu !== pedidoAtual) return;
          hora.innerHTML = "";
          hora.appendChild(el("option", { value: "", text: "não consegui carregar" }));
          hora.disabled = true;
          enviar.disabled = true;
        });
    }

    data.addEventListener("change", carregarHoras);
    carregarHoras();

    forma.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (!data.value || !hora.value) { dizer("Escolha o dia e a hora.", "erro"); return; }
      if (nome.value.trim().length < 2) { dizer("Escreva seu nome.", "erro"); nome.focus(); return; }
      if (tel.value.replace(/\D/g, "").length < 8) { dizer("Confira o telefone — é por ele que a casa confirma.", "erro"); tel.focus(); return; }

      enviar.disabled = true;
      var antes = enviar.textContent;
      enviar.textContent = "Enviando…";
      recado.hidden = true;

      fetch(API + "/" + encodeURIComponent(slug), {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({
          tipo: "mesa",
          data: data.value,
          hora: hora.value,
          pessoas: parseInt(pessoas.value, 10),
          nome: nome.value.trim(),
          telefone: tel.value.trim(),
          observacao: obs.value.trim() || undefined,
          sobrenome: armadilha.value || undefined,
        }),
      })
        .then(function (r) {
          return r.json().catch(function () { return {}; })
            .then(function (corpo) { return { ok: r.ok, corpo: corpo }; });
        })
        .then(function (res) {
          if (res.ok) {
            forma.querySelector(".rsv__grade").hidden = true;
            forma.querySelector(".rsv__acoes").hidden = true;
            dizer(
              "Anotamos " + porExtenso(data.value) + " às " + hora.value + ", para " +
              pessoas.value + (pessoas.value === "1" ? " pessoa" : " pessoas") +
              ". A casa liga ou manda mensagem para confirmar.",
              "ok",
            );
            return;
          }
          // `erro` é o formato da rota; `error` só aparece quando o
          // limite de envios corta o pedido antes de ele chegar lá.
          var texto = res.corpo.erro || res.corpo.error ||
            "Não consegui registrar agora." + (whats ? " Tente pelo WhatsApp." : "");
          dizer(texto, "erro");
          enviar.disabled = false;
          enviar.textContent = antes;
          if (res.corpo.motivo === "fora_do_horario" || res.corpo.motivo === "sem_disponibilidade") {
            carregarHoras();
          }
        })
        .catch(function () {
          dizer("Sem conexão com o sistema agora." + (whats ? " Chame no WhatsApp que a casa anota na mão." : ""), "erro");
          enviar.disabled = false;
          enviar.textContent = antes;
        });
    });

    raiz.appendChild(forma);
    if (estatico) estatico.hidden = true;
  }

  function iniciar() {
    Array.prototype.forEach.call(document.querySelectorAll("[data-reserva]"), montar);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar);
  else iniciar();
})();
