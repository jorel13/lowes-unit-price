// Lowe's Lumber Unit Price — adds $/ft, $/bd ft and $/sq ft badges to lowes.com.
(() => {
  'use strict';

  // ---------- Dimension parsing ----------
  // Matches numbers like 2, 1.5, 1/2, 23/32, 92-5/8 followed by -in / -ft.
  const NUM = String.raw`(\d+-\d+\/\d+|\d+\/\d+|\d+(?:\.\d+)?)`;
  const DIM = NUM + String.raw`\s*-?\s*(in|ft)\b`;
  const CHAIN = new RegExp(
    DIM + String.raw`\s*x\s*` + DIM + String.raw`(?:\s*x\s*` + DIM + ')?',
    'i'
  );

  function parseNum(s) {
    if (/^\d+-\d+\/\d+$/.test(s)) {
      const [whole, frac] = s.split('-');
      return Number(whole) + parseNum(frac);
    }
    if (s.includes('/')) {
      const [a, b] = s.split('/');
      return Number(a) / Number(b);
    }
    return parseFloat(s);
  }

  // Returns dimensions in inches, in the order they appear in the title.
  function parseDims(title) {
    const m = title && title.match(CHAIN);
    if (!m) return null;
    const dims = [];
    for (let i = 1; i < m.length; i += 2) {
      if (!m[i]) continue;
      const n = parseNum(m[i]);
      dims.push(m[i + 1].toLowerCase() === 'ft' ? n * 12 : n);
    }
    return dims.every((d) => d > 0) ? dims : null;
  }

  const SHEET_MIN_IN = 16; // both faces this big or bigger => sheet good

  // Works out which unit prices make sense for a product.
  function analyze(title, price) {
    const dims = parseDims(title);
    if (!dims || !(price > 0)) return null;

    const faces = dims.length === 3 ? dims.slice(1) : dims;
    const thickness = dims.length === 3 ? dims[0] : null;

    if (faces[0] >= SHEET_MIN_IN && faces[1] >= SHEET_MIN_IN) {
      const sqft = (faces[0] * faces[1]) / 144;
      return {
        kind: 'sheet',
        group: 'sheet:' + (thickness ? thickness.toFixed(3) : '?'),
        sort: price / sqft,
        lines: [`${money(price / sqft)} / sq ft`, `${trim(sqft)} sq ft`],
      };
    }

    // Linear stock (dimensional lumber, boards, trim): length is the last dimension.
    const lengthIn = dims[dims.length - 1];
    const lengthFt = lengthIn / 12;
    const perFt = price / lengthFt;
    const lines = [`${money(perFt)} / ft`];
    let sort = perFt;
    let group = 'linear';

    if (dims.length === 3) {
      // Board feet from the nominal (titled) size, the way lumber is normally quoted.
      const bf = (dims[0] * dims[1] * lengthIn) / 144;
      lines.push(`${money(price / bf)} / bd ft`);
      group = `linear:${trim(dims[0])}x${trim(dims[1])}`;
    }
    return { kind: 'linear', group, sort, lines };
  }

  function money(n) {
    return '$' + (n < 0.1 ? n.toFixed(3) : n.toFixed(2));
  }
  function trim(n) {
    return String(Math.round(n * 100) / 100);
  }
  function parsePrice(text) {
    if (!text) return NaN;
    const m = text.replace(/\s+/g, '').match(/\$([\d,]+(?:\.\d{1,2})?)/);
    return m ? parseFloat(m[1].replace(/,/g, '')) : NaN;
  }

  // ---------- Finding products on the page ----------
  function collectProducts() {
    const found = [];

    // Search / product-list grid tiles. Title and price live in sibling cells
    // that share a data-tile number inside the same .tile_group.
    document
      .querySelectorAll('[data-selector="prd-price-holder"][data-tile]')
      .forEach((priceHolder) => {
        const scope = priceHolder.closest('.tile_group') || document;
        const n = priceHolder.getAttribute('data-tile');
        const desc = scope.querySelector(
          `[data-selector="prd-description-holder"][data-tile="${n}"]`
        );
        const titleEl = desc && desc.querySelector('.description-spn, h4, a[aria-label]');
        const title =
          (titleEl && (titleEl.textContent || titleEl.getAttribute('aria-label'))) || '';
        const priceEl = priceHolder.querySelector('[data-selector="splp-prd-act-$"]');
        const price = parsePrice(
          (priceEl && priceEl.getAttribute('aria-label')) || priceHolder.textContent
        );
        found.push({ anchor: priceHolder, title, price });
      });

    // Recommendation carousels ("You may also like").
    document.querySelectorAll('.product-card[data-webvision-id]').forEach((card) => {
      const title = (card.querySelector('.product-desc') || {}).textContent || '';
      const priceEl = card.querySelector('.recs-final-price');
      const anchor = card.querySelector('.recs-price-block');
      if (!priceEl || !anchor) return;
      found.push({ anchor, title, price: parsePrice(priceEl.textContent) });
    });

    // Product detail page: use the page's structured data.
    if (location.pathname.startsWith('/pd/')) {
      const pd = readJsonLdProduct();
      const h1 = document.querySelector('h1');
      if (pd && h1) found.push({ anchor: h1, title: pd.name || h1.textContent, price: pd.price, pdp: true });
    }

    return found;
  }

  function readJsonLdProduct() {
    for (const s of document.querySelectorAll('script[type="application/ld+json"]')) {
      try {
        const data = JSON.parse(s.textContent);
        const items = Array.isArray(data) ? data : [data];
        for (const d of items) {
          if (d && d['@type'] === 'Product' && d.offers) {
            const offer = Array.isArray(d.offers) ? d.offers[0] : d.offers;
            return { name: d.name, price: Number(offer.price) };
          }
        }
      } catch (_) {
        /* ignore malformed blocks */
      }
    }
    return null;
  }

  // ---------- Rendering ----------
  function render() {
    const results = [];

    for (const p of collectProducts()) {
      const info = analyze(p.title, p.price);
      let badge = p.pdp
        ? p.anchor.parentElement && p.anchor.parentElement.querySelector(':scope > .lup-badge')
        : p.anchor.querySelector(':scope > .lup-badge');

      if (!info) {
        if (badge) badge.remove();
        continue;
      }
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'lup-badge';
        if (p.pdp) p.anchor.insertAdjacentElement('afterend', badge);
        else p.anchor.appendChild(badge);
      }
      const text = info.lines.join(' · ');
      if (badge.dataset.text !== text) {
        badge.dataset.text = text;
        badge.textContent = text;
        badge.title = 'Unit price calculated from the size in the product title';
      }
      if (!p.pdp) results.push({ badge, info });
    }

    // Mark the cheapest per-unit item within each comparable group
    // (same sheet thickness, or same nominal lumber cross-section).
    const groups = new Map();
    for (const r of results) {
      if (!groups.has(r.info.group)) groups.set(r.info.group, []);
      groups.get(r.info.group).push(r);
    }
    for (const list of groups.values()) {
      const min = Math.min(...list.map((r) => r.info.sort));
      for (const r of list) {
        const best = list.length > 1 && Math.abs(r.info.sort - min) < 1e-9;
        if (r.badge.classList.contains('lup-best') !== best) {
          r.badge.classList.toggle('lup-best', best);
        }
      }
    }
  }

  let timer = null;
  function schedule() {
    clearTimeout(timer);
    timer = setTimeout(render, 400);
  }

  new MutationObserver((muts) => {
    // Ignore mutations caused only by our own badges.
    const external = muts.some(
      (m) =>
        !(m.target.classList && m.target.classList.contains('lup-badge')) &&
        ![...m.addedNodes, ...m.removedNodes].every(
          (n) => n.classList && n.classList.contains('lup-badge')
        )
    );
    if (external) schedule();
  }).observe(document.body, { childList: true, subtree: true, characterData: true });

  render();

  // Exposed for quick testing from the console.
  window.__lowesUnitPrice = { analyze, parseDims, render };
})();
