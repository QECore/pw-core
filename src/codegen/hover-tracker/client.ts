export function clientHoverTracker() {
  let lastHoveredElement: any = null
  let hoverEntryTime = 0
  let lastRecordedHover: any = null
  let lastMutationTime = 0

  const getUniqueCssSelector = (el: any): string => {
    if (el.getAttribute('data-testid')) {
      return `[data-testid="${el.getAttribute('data-testid')}"]`
    }
    if (el.getAttribute('data-parent-id')) {
      return `[data-parent-id="${el.getAttribute('data-parent-id')}"]`
    }
    if (el.id) {
      return `#${el.id}`
    }
    if (el.tagName === 'BODY') return 'body'
    let path = el.tagName.toLowerCase()
    if (el.className) {
      const firstClass = el.className.split(/\s+/)[0]
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
        const selector = getUniqueCssSelector(lastHoveredElement)
        if (selector && (window as any).__pwCoreRecordHover) {
          ;(window as any).__pwCoreRecordHover(selector)
        }
      }
    }
  })

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true
  })

  document.addEventListener('mouseover', (e: any) => {
    const target = e.target
    if (!target || target.closest('#pw-core-codegen-panel')) return
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
            const selector = getUniqueCssSelector(currentTarget)
            if (selector && (window as any).__pwCoreRecordHover) {
              ;(window as any).__pwCoreRecordHover(selector)
            }
          }
        }
      }, 150)
    }
  })
}
