export function getSemanticScore(value: string | null): number {
  if (!value) return 0
  let score = 0

  // Hyphenated values are intentional naming (e.g. "why-pw-core", "page-registry")
  if (value.includes('-')) score += 10

  // Longer values are more descriptive
  if (value.length > 5) score += 5
  if (value.length > 10) score += 5

  // Exclude purely numeric or long random sequences
  if (!/\d{4,}/.test(value)) score += 10

  // Pure words (no digits) are more semantic
  if (/^[a-zA-Z-_]+$/.test(value)) score += 5

  // Penalize extremely short generic values
  if (value.length <= 3) score -= 15

  // Penalize single-word utility-like values (e.g. "flex", "block", "hidden")
  const utilityNames = [
    'flex', 'grid', 'block', 'inline', 'hidden', 'visible', 'relative', 'absolute',
    'fixed', 'sticky', 'static', 'auto', 'none', 'inherit', 'initial', 'unset',
    'revert', 'polyline', 'svg', 'path', 'circle', 'rect', 'div', 'span', 'section',
    'article', 'main', 'header', 'footer', 'nav', 'aside', 'tbody', 'thead', 'tr',
    'td', 'th'
  ]
  if (utilityNames.includes(value.toLowerCase())) score -= 30

  // Penalize CSS utility-pattern values (e.g. transition-all, border-0, shadow-lg)
  const utilityPatterns = [
    /^transition-/, /^transform-/, /^duration-/, /^ease-/, /^delay-/, /^animate-/,
    /^shadow-/, /^opacity-/, /^blur-/, /^scale-/, /^translate-/, /^rotate-/,
    /^skew-/, /^origin-/, /^border-/, /^rounded-/, /^ring-/, /^outline-/, /^bg-/,
    /^text-/, /^font-/, /^leading-/, /^tracking-/, /^w-/, /^h-/, /^min-/, /^max-/,
    /^gap-/, /^space-/, /^m[tblrxy]?-/, /^p[tblrxy]?-/, /^col-/, /^row-/, /^grid-/,
    /^flex-/, /^z-/, /^inset-/, /^top-/, /^right-/, /^bottom-/, /^left-/
  ]
  if (utilityPatterns.some((p) => p.test(value))) score -= 25

  return score
}
