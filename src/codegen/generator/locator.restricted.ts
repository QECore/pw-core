export const exactUtilities = [
  'flex',
  'grid',
  'relative',
  'absolute',
  'sticky',
  'group',
  'dark',
  'light',
  'transition',
  'transition-all',
  'duration',
  'rounded',
  'shadow'
]

export const tailwindPrefixes = [
  'm-',
  'mt-',
  'mb-',
  'ml-',
  'mx-',
  'my-',
  'p-',
  'px-',
  'py-',
  'text-',
  'bg-',
  'flex-',
  'grid-',
  'justify-',
  'items-',
  'gap-',
  'space-',
  'w-',
  'h-',
  'min-',
  'max-',
  'translate-',
  'scale-',
  'rotate-',
  'duration-',
  'transition-',
  'opacity-',
  'border-',
  'rounded-',
  'shadow-',
  'cursor-',
  'delay-',
  'ease-',
  'overflow-'
]

export const stateClasses = [
  'active',
  'selected',
  'open',
  'expanded',
  'collapsed',
  'hover',
  'focused',
  'scale-105',
  'opacity-100'
]

export const decorativeList = [
  'dot',
  'icon',
  'circle',
  'line',
  'separator',
  'bullet',
  'caret',
  'arrow',
  'chevron',
  'svg',
  'polygon',
  'polyline',
  'path',
  'marker',
  'logo'
]

export const PATTERNS = {
  stylePatterns: {
    marginPadding: '^[mp][trblxy]?-?\\d+$',
    displayLayout: '^(flex|grid|block|inline|hidden|table)$',
    positioning: '^(relative|absolute|fixed|sticky)$',
    dimensions: '^(w|h|min-w|min-h|max-w|max-h)-\\d+$',
    colorsAndBorders: '^(text|bg|border|ring|divide|from|to|via)-[a-z]+',
    typography: '^(font|leading|tracking|whitespace|break|align|list|underline|line-through)-',
    flexboxGridAlign: '^(items|justify|content|self|place)-',
    spacing: '^(gap|space)-',
    transitionsAnimations: '^(duration|delay|ease|animate|transition|origin|scale|opacity|rotate|skew)-',
    miscStyles: '^(border|rounded|shadow|opacity|z|top|bottom|left|right|inset)-',
    interactivity: '^(select|cursor|pointer-events|resize)-',
    easeCurves: '^ease-',
    flexGridGrowShrink: '^(grow|shrink|order|col|row)-',
    layoutOverflow: '^overflow-'
  },
  restrictedTexts: {
    welcome: 'welcome',
    ago: 'ago',
    dollar: '$',
    colon: ':'
  },
  unstableIdentifiers: {
    uuidPattern: 'uuid|guid|hash',
    numericPattern: '^\\d+$',
    hexHashPattern: '^[a-f0-9]{8,}$',
    longAlphaNumPattern: '^[a-z0-9]{20,}$'
  }
}

export const stylePatterns = Object.values(PATTERNS.stylePatterns)

export function isRestrictedClass(cName: string): boolean {
  if (cName.includes('[') && cName.includes(']')) return true
  if (cName.includes(':')) return true

  if (exactUtilities.includes(cName)) return true
  if (stateClasses.includes(cName.toLowerCase())) return true
  if (tailwindPrefixes.some((prefix) => cName.startsWith(prefix))) return true

  return stylePatterns.some((pat) => new RegExp(pat).test(cName))
}
