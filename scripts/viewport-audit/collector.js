// Evaluated inside the audited page by the viewport audit (read as text and sent over CDP).
// Plain JavaScript on purpose: a TypeScript build step would rewrite this function and break injection.
(() => {
  const SELECTOR =
    'a[href], button, input:not([type=hidden]), select, textarea, summary, [role=button], [role=tab], [role=menuitem]';
  const items = [];

  for (const el of document.querySelectorAll(SELECTOR)) {
    if (el.closest('.sr-only, [aria-hidden="true"], nextjs-portal, [inert]')) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden' || style.display === 'none') continue;
    // Links written inside a sentence are exempt from the 44px rule.
    if (style.display === 'inline') continue;

    // A checkbox or radio is tapped through its label row, so measure that.
    const isToggle = el.tagName === 'INPUT' && (el.type === 'checkbox' || el.type === 'radio');
    const box = (isToggle && el.closest('label')) || el;
    const rect = box.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    // Off-canvas content (a closed drawer) is not on screen.
    if (rect.right <= 0 || rect.left >= innerWidth) continue;

    const label = (el.getAttribute('aria-label') || el.name || el.textContent || el.placeholder || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    items.push({
      tag: el.tagName.toLowerCase(),
      type: el.type || '',
      label,
      w: rect.width,
      h: rect.height,
      fontSize: parseFloat(style.fontSize),
    });
  }

  const charts = [...document.querySelectorAll('.recharts-responsive-container')]
    .map((container) => {
      const svg = container.querySelector('svg');
      return svg ? { container: Math.round(container.getBoundingClientRect().width), svg: Math.round(svg.getBoundingClientRect().width) } : null;
    })
    .filter(Boolean);

  // Visible text, one entry per element kind and size (rows repeat the same cell many times).
  // Chart text (svg), screen-reader text and elements marked `data-small-text-ok` are exempt.
  const texts = [];
  const seenText = new Set();
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.textContent.trim().replace(/\s+/g, ' ');
    const el = node.parentElement;
    if (!text || !el) continue;
    if (el.closest('svg, .sr-only, [data-small-text-ok], nextjs-portal, script, style, noscript, template')) continue;
    const style = getComputedStyle(el);
    if (style.visibility === 'hidden') continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    if (rect.right <= 0 || rect.left >= innerWidth) continue;
    // Parked above the page, e.g. Recharts' #recharts_measurement_span at top: -20000px.
    if (rect.bottom + scrollY <= 0) continue;

    const fontSize = parseFloat(style.fontSize);
    const textClasses = (el.getAttribute('class') || '').split(/\s+/).filter((c) => /(^|:)text-/.test(c)).join('.');
    const key = `${el.tagName}|${textClasses}|${fontSize}`;
    if (seenText.has(key)) continue;
    seenText.add(key);
    const tag = el.tagName.toLowerCase() + (textClasses ? `.${textClasses}` : '');
    texts.push({ label: `${tag} "${text.slice(0, 30)}"`, fontSize });
  }

  const firstRecord = document.querySelector('[data-records] > *');

  return {
    innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    items,
    charts,
    dashboard: Boolean(document.querySelector('[data-dashboard]')),
    texts,
    firstRecordTop: firstRecord ? Math.round(firstRecord.getBoundingClientRect().top + scrollY) : null,
  };
})()
