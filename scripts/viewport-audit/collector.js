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

  return { innerWidth, scrollWidth: document.documentElement.scrollWidth, items, charts };
})()
