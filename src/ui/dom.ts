type Attrs = Record<string, string | number | boolean | undefined>;

/** Tiny element factory: h('button', { class: 'tool', 'aria-label': 'Hjem' }, [child…]). */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Attrs = {},
  children: Array<Node | string> = [],
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === false) continue;
    el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const c of children) el.append(c);
  return el;
}

export function svg(markup: string): HTMLElement {
  const wrap = document.createElement('span');
  wrap.className = 'icon';
  wrap.innerHTML = markup;
  return wrap;
}
