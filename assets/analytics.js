/**
 * Medicao das tres casas — secao 19 do briefing.
 *
 * UMA propriedade do GA4 para o grupo inteiro, nao tres. E a unica forma de
 * responder a pergunta que o briefing faz: quantas pessoas passam de uma casa
 * para outra. Com tres propriedades separadas, cada uma so enxerga a sua, e o
 * `cross_brand_click` nao significa nada.
 *
 * Por isso TODO evento leva `casa` junto. No relatorio, "casa" vira a dimensao
 * que separa Saiko, Forneatto e Kikiu dentro da mesma propriedade.
 *
 * ENQUANTO `MEDIDA` ESTIVER VAZIO ESTE ARQUIVO NAO FAZ NADA: nao carrega o
 * gtag, nao abre conexao, nao deixa cookie. De proposito — site de cliente nao
 * carrega script de terceiro "por enquanto".
 */
const MEDIDA = '';   // <- o G-XXXXXXXXXX da propriedade do grupo
const CASA = 'kikiu';

if (MEDIDA) {
  // O gtag.js entra depois do primeiro desenho da pagina: medicao nunca pode
  // competir com o conteudo pela banda do cliente.
  const t = document.createElement('script');
  t.async = true;
  t.src = `https://www.googletagmanager.com/gtag/js?id=${MEDIDA}`;
  document.head.appendChild(t);
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  gtag('js', new Date());
  gtag('config', MEDIDA, { casa: CASA });
}

/** Um evento, sempre com a casa junto. Silencioso se a medicao esta desligada. */
function medir(nome, dados = {}) {
  if (!MEDIDA || typeof gtag !== 'function') return;
  gtag('event', nome, { casa: CASA, ...dados });
}

/**
 * A ligacao e por SELETOR, nao por atributo no HTML.
 *
 * Assim nenhuma pagina precisa ser marcada a mao, e um link novo que alguem
 * acrescente amanha ja nasce medido. Marcar evento a evento no HTML envelhece
 * mal: basta alguem copiar um bloco sem o atributo e o numero cala.
 */
// Dominio -> apelido da casa. Sem isto o relatorio recebia
// `para: "saikogastronomia"`, que e o dominio picado, e nao o nome da casa —
// e as duas pontas do mesmo evento (`casa` e `para`) ficavam em linguagens
// diferentes.
const CASA_DO_DOMINIO = {
  'saikogastronomia.com.br': 'saiko',
  'forneattocucina.com.br': 'forneatto',
  'kikiu.com.br': 'kikiu',
};
const OUTRAS = Object.keys(CASA_DO_DOMINIO)
  .filter(d => !location.hostname.endsWith(d));

function qualEvento(a) {
  const href = a.getAttribute('href') || '';
  const texto = (a.textContent || '').trim().toLowerCase();

  if (/^tel:/i.test(href))                      return ['phone_click', {}];
  if (/wa\.me|api\.whatsapp/i.test(href)) {
    // Reservar e falar com a casa sao coisas diferentes, e as duas vao pelo
    // WhatsApp. Quem decide e o texto do botao.
    const reserva = /reserv/i.test(texto) || /reserv/i.test(href);
    return [reserva ? 'reservation_click' : 'whatsapp_click', { destino: 'whatsapp' }];
  }
  if (/instagram\.com/i.test(href))             return ['instagram_click', {}];
  if (/maps|goo\.gl\/maps|google\.com\/maps/i.test(href)) return ['directions_click', {}];
  if (/^\/(cardapio|bebidas)/.test(href))       return ['menu_view', {}];

  const outra = OUTRAS.find(d => href.includes(d));
  if (outra) return ['cross_brand_click', { para: CASA_DO_DOMINIO[outra] }];

  return null;
}

document.addEventListener('click', ev => {
  const a = ev.target.closest('a[href]');
  if (!a) return;
  const achado = qualEvento(a);
  if (achado) medir(achado[0], achado[1]);
}, { capture: true });

/**
 * `menu_item_view` e `event_view` sao VISTA, nao clique: o item do cardapio e a
 * atracao da agenda aparecem rolando a pagina, e ninguem clica neles. Sem
 * IntersectionObserver eles nunca seriam medidos.
 *
 * Cada um conta UMA vez por carregamento — o observador se desliga no primeiro
 * encontro. Sem isso, rolar para cima e para baixo multiplica o numero e o
 * relatorio vira ficcao.
 */
/** Texto limpo de um elemento, curto o bastante para caber num parametro. */
const texto = el => (el?.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80);

/** O subtitulo mais proximo ACIMA do item na mesma lista (Petiscos, Caipirinhas). */
function grupoAcima(el) {
  for (let n = el.previousElementSibling; n; n = n.previousElementSibling) {
    if (n.classList.contains('div') || n.classList.contains('divisor')) return n;
  }
  return null;
}

function observarVistas() {
  const alvos = [
    ['menu_item_view', '.i, .prato, .piatto, .item[data-id]', el => ({
      item: texto(el.querySelector('.i__nome, .prato__nome, .piatto__nome, .item__nome') || el),
      // A secao vai JUNTO porque o nome sozinho mente: "Limao" e caipirinha,
      // caipiroska E suco; "Kamai" e vodca e gin. Sem isto, tres produtos
      // diferentes viram uma linha so no relatorio.
      secao: [texto(el.closest('section')?.querySelector('.sec__tit, h2')),
              texto(grupoAcima(el))].filter(Boolean).join(' / '),
    })],
    ['event_view', '.agenda__item, .evento, [data-evento]', el =>
      ({ evento: texto(el) })],
  ];
  if (!('IntersectionObserver' in window)) return;

  for (const [nome, seletor, extrair] of alvos) {
    const els = document.querySelectorAll(seletor);
    if (!els.length) continue;
    const obs = new IntersectionObserver(entradas => {
      for (const e of entradas) {
        if (!e.isIntersecting) continue;
        obs.unobserve(e.target);
        try { medir(nome, extrair(e.target)); } catch {}
      }
    }, { threshold: .4 });
    els.forEach(el => obs.observe(el));
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', observarVistas);
} else {
  observarVistas();
}
