/**
 * cardapio-vivo.js — o cardápio do QR acompanha o painel.
 *
 * A página que o QR abre nasce pronta (HTML, rápida, boa no Google). Este
 * script chega depois e a deixa em dia com o painel da casa, que é onde a
 * gestão muda preço, põe foto e desliga o prato que acabou:
 *
 *   - PREÇO: o do painel manda;
 *   - FOTO: a que a casa subiu no painel aparece no cartão do prato;
 *   - ACABOU: item desligado no painel some da página. Só some se o painel
 *     o NOMEIA como desligado — um prato que o painel simplesmente não
 *     conhece nunca é escondido;
 *   - PRATO NOVO: item novo do painel entra no fim da seção de MESMO NOME.
 *
 * E em qualquer falha — painel fora do ar, resposta estranha, demora — a
 * página fica exatamente como nasceu. Este script só acrescenta; a página
 * nunca depende dele para ser legível.
 *
 * Casa os pratos pelo NOME sem acento e sem pontuação: "Pão de Alho" e
 * "pao de alho" são o mesmo prato.
 */
(function () {
  var tag = document.querySelector('script[data-api]');
  if (!tag || !('fetch' in window)) return;

  var norm = function (s) {
    return String(s == null ? '' : s).normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]+/g, '');
  };
  var brl = function (cents) {
    return 'R$ ' + (cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  var ctl = window.AbortController ? new AbortController() : null;
  var limite = setTimeout(function () { if (ctl) ctl.abort(); }, 6000);

  fetch(tag.getAttribute('data-api'), { headers: { Accept: 'application/json' }, signal: ctl ? ctl.signal : undefined })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (dados) { clearTimeout(limite); if (dados && Array.isArray(dados.categories)) aplicar(dados); })
    .catch(function () { clearTimeout(limite); });

  function aplicar(dados) {
    // ── o que o painel sabe ──────────────────────────────────────────
    var doPainel = {};   // nome normalizado -> item
    var lista = [];
    dados.categories.forEach(function (c) {
      (c.items || []).forEach(function (it) {
        var n = norm(it.name);
        if (!n) return;
        var e = { n: n, nome: it.name, desc: it.description, cents: it.price_cents, foto: it.image_url, cat: norm(c.category) };
        if (!doPainel[n]) { doPainel[n] = e; lista.push(e); }
      });
    });
    var desligados = {};
    (dados.unavailable || []).forEach(function (nome) { desligados[norm(nome)] = true; });

    // ── o que a página mostra ────────────────────────────────────────
    var cartoes = [].slice.call(document.querySelectorAll('.i[data-nome]'));
    var casados = 0;
    var vistos = {};

    cartoes.forEach(function (li) {
      var n = norm(li.getAttribute('data-nome'));
      vistos[n] = true;
      var p = doPainel[n];
      if (p) {
        casados++;
        var preco = li.querySelector('.i__preco');
        if (preco && typeof p.cents === 'number' && preco.textContent.trim() !== brl(p.cents)) preco.textContent = brl(p.cents);
        if (p.foto && !li.querySelector('.i__foto')) porFoto(li, p.foto, p.nome);
      } else if (desligados[n]) {
        li.hidden = true;   // o painel disse, pelo nome: acabou
      }
    });

    // ── prato novo ───────────────────────────────────────────────────
    // Só quando os nomes da página e do painel provadamente falam a mesma
    // língua (a maioria casou). Painel ainda sem organizar, com nomes
    // diferentes, despejaria duplicata na página — nesse caso não mexe.
    if (cartoes.length && casados / cartoes.length >= 0.6) {
      var secoes = {};
      [].forEach.call(document.querySelectorAll('.sec[data-titulo]'), function (s) { secoes[norm(s.getAttribute('data-titulo'))] = s; });
      lista.forEach(function (p) {
        if (vistos[p.n] || desligados[p.n]) return;
        var sec = secoes[p.cat];
        var ul = sec && sec.querySelector('.lista');
        if (ul && typeof p.cents === 'number') ul.appendChild(novoCartao(p));
      });
    }

    // ── o que ficou vazio some junto ─────────────────────────────────
    [].forEach.call(document.querySelectorAll('.lista'), function (ul) {
      var filhos = [].slice.call(ul.children), grupo = null, vivos = 0;
      var fecha = function () { if (grupo) grupo.hidden = vivos === 0; };
      filhos.forEach(function (f) {
        if (f.classList.contains('div')) { fecha(); grupo = f; vivos = 0; f.hidden = false; }
        else if (!f.hidden) vivos++;
      });
      fecha();
    });
    [].forEach.call(document.querySelectorAll('.sec'), function (sec) {
      var temItem = sec.querySelector('.i:not([hidden])');
      sec.hidden = !temItem;
      var ficha = document.querySelector('.fichas a[href="#' + sec.id + '"]');
      if (ficha) ficha.hidden = !temItem;
    });
  }

  function porFoto(li, url, alt) {
    var img = document.createElement('img');
    img.className = 'i__foto';
    img.alt = alt || '';
    img.loading = 'lazy';
    img.decoding = 'async';
    img.width = 640; img.height = 480;
    img.onerror = function () { img.remove(); li.classList.remove('i--foto'); };
    img.src = url;
    li.insertBefore(img, li.firstChild);
    li.classList.add('i--foto');
  }

  function novoCartao(p) {
    var li = document.createElement('li');
    li.className = 'i vis';
    li.setAttribute('data-nome', p.nome);
    var txt = document.createElement('div');
    txt.className = 'i__txt';
    var topo = document.createElement('div');
    topo.className = 'i__topo';
    var h = document.createElement('h3');
    h.className = 'i__nome';
    h.textContent = p.nome;
    var preco = document.createElement('span');
    preco.className = 'i__preco';
    preco.textContent = brl(p.cents);
    topo.appendChild(h); topo.appendChild(preco);
    txt.appendChild(topo);
    if (p.desc) {
      var d = document.createElement('p');
      d.className = 'i__desc';
      d.textContent = p.desc;
      txt.appendChild(d);
    }
    li.appendChild(txt);
    if (p.foto) porFoto(li, p.foto, p.nome);
    return li;
  }
})();
