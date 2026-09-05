declare global {
  interface Window {
    __pwCoreRecordHover?: (selector: string) => void
  }
}

export function clientHoverTracker() {
  let lastHoveredElement: Element | null = null
  let hoverEntryTime = 0
  let lastRecordedHover: Element | null = null
  let lastMutationTime = 0

  const recordHover = (element: Element) => {
    const selector = getUniqueCssSelector(element)
    if (selector && window.__pwCoreRecordHover) {
      window.__pwCoreRecordHover(selector)
    }
  }

  const getUniqueCssSelector = (el: Element): string => {
    if (el.getAttribute('data-testid')) {
      return `[data-testid="${el.getAttribute('data-testid')}"]`
    }
    if (el.getAttribute('data-parent-id')) {
      return `[data-parent-id="${el.getAttribute('data-parent-id')}"]`
    }
    const htmlElement = el as HTMLElement
    if (htmlElement.id) {
      return `#${htmlElement.id}`
    }
    if (el.tagName === 'BODY') return 'body'
    let path = el.tagName.toLowerCase()
    if (typeof htmlElement.className === 'string' && htmlElement.className) {
      const firstClass = htmlElement.className.split(/\s+/)[0]
      if (firstClass && !firstClass.includes('[') && !firstClass.includes(':')) {
        path += `.${firstClass}`
      }
    }
    return path
  }

  const observer = new MutationObserver(() => {
    lastMutationTime = Date.now()
    // Case 2: Delayed mutation happens after 150ms of hover
    if (lastHoveredElement && lastRecordedHover !== lastHoveredElement) {
      const elapsed = Date.now() - hoverEntryTime
      if (elapsed >= 150) {
        lastRecordedHover = lastHoveredElement
        recordHover(lastHoveredElement)
      }
    }
  })

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true
  })

  document.addEventListener('mouseover', (e: MouseEvent) => {
    const target = e.target
    if (!(target instanceof Element) || target.closest('#pw-core-codegen-panel')) return
    const hoverTarget =
      target.closest(
        'button, a, [role="menuitem"], [role="option"], .menu-item, [data-testid], svg, path, [data-parent-id]'
      ) || target
    if (hoverTarget !== lastHoveredElement) {
      lastHoveredElement = hoverTarget
      hoverEntryTime = Date.now()
      const currentTarget = hoverTarget

      // Case 1: Fast mutation happens during the first 150ms of hover
      setTimeout(() => {
        if (lastHoveredElement === currentTarget && lastRecordedHover !== currentTarget) {
          const sinceMutation = Date.now() - lastMutationTime
          if (sinceMutation < 400) {
            lastRecordedHover = currentTarget
            recordHover(currentTarget)
          }
        }
      }, 150)
    }
  })
}
