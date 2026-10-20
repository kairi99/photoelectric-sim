// Tiny DOM helpers for the pedagogy layer (no innerHTML: strings go through textContent).
export function el<K extends keyof HTMLElementTagNameMap>(tag: K, cls?: string, parent?: Element): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag)
  if (cls) e.className = cls
  parent?.append(e)
  return e
}

export function button(label: string, cls: string, parent?: Element, onClick?: () => void): HTMLButtonElement {
  const b = el('button', cls, parent)
  b.type = 'button'
  b.textContent = label
  if (onClick) b.addEventListener('click', onClick)
  return b
}

/** localStorage with try/catch: storage may be blocked or full. */
export const store = {
  get(key: string): string | null {
    try { return localStorage.getItem(key) } catch { return null }
  },
  set(key: string, value: string): void {
    try { localStorage.setItem(key, value) } catch { /* ignore */ }
  },
}
