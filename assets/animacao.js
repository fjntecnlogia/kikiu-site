/* animacao.js — ver animacao.css. Pequeno de proposito: roda depois de tudo
 * e, se falhar, a pagina continua inteira (nada depende dele para aparecer). */
(function () {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches || !('IntersectionObserver' in window)) return;

  var alvos = document.querySelectorAll(
    '.scatto, .foto, .destaque, .facciata, .fachada, .qr-cardapio, .cartao-opiniao, .agd-item');
  var vh = window.innerHeight || 800;
  var grupos = new Map();   // o "irmao numero N" de cada grupo entra com atraso N

  alvos.forEach(function (el) {
    var topo = el.getBoundingClientRect().top;
    if (topo < vh * 0.92) return;                   // ja esta na tela: nunca esconder
    var pai = el.parentElement, n = grupos.get(pai) || 0;
    grupos.set(pai, n + 1);
    el.style.setProperty('--i', n % 4);             // de 4 em 4: a fila nao fica longa
    el.classList.add('anima');
  });
  document.documentElement.classList.add('anima-on');

  var io = new IntersectionObserver(function (itens) {
    itens.forEach(function (it) {
      if (!it.isIntersecting) return;
      it.target.classList.add('entrou');
      io.unobserve(it.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
  document.querySelectorAll('.anima').forEach(function (el) { io.observe(el); });

  // linha de leitura
  var barra = document.createElement('div');
  barra.className = 'anima-progresso'; barra.setAttribute('aria-hidden', 'true');
  document.body.appendChild(barra);
  var esperando = false;
  function atualizar() {
    esperando = false;
    var h = document.documentElement.scrollHeight - window.innerHeight;
    barra.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, window.scrollY / h) : 0) + ')';
  }
  window.addEventListener('scroll', function () {
    if (!esperando) { esperando = true; requestAnimationFrame(atualizar); }
  }, { passive: true });
  atualizar();
})();
