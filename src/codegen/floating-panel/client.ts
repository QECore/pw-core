declare global {
  interface Window {
    __pwCoreStartNewTest?: () => void
    __pwCoreStartNewSerialTest?: () => void
  }
}

export interface FloatingPanelPayload {
  idx: string
  fileName: string
  hasSteps: boolean
  cssStyle: string
  htmlContent: string
}

export function clientInjectFloatingPanel(payload: FloatingPanelPayload) {
  function safeSessionStorage(action: 'get' | 'set' | 'remove', key: string, value?: string): string | null {
    try {
      if (action === 'get') return sessionStorage.getItem(key)
      if (action === 'set' && value !== undefined) sessionStorage.setItem(key, value)
      if (action === 'remove') sessionStorage.removeItem(key)
    } catch {}
    return null
  }

  const { idx, hasSteps, cssStyle, htmlContent } = payload

  if (!document.body) {
    window.addEventListener('DOMContentLoaded', () => clientInjectFloatingPanel(payload), { once: true })
    return
  }

  const sessionHasSteps = safeSessionStorage('get', 'pw-core-has-steps') === 'true'
  const effectiveHasSteps = hasSteps || sessionHasSteps

  if (effectiveHasSteps) {
    safeSessionStorage('set', 'pw-core-has-steps', 'true')
  }

  const numEl = document.getElementById('pw-core-test-num')
  const existingNewTestBtn = document.getElementById('pw-core-new-test-btn') as HTMLButtonElement | null
  const existingNewSerialBtn = document.getElementById('pw-core-new-serial-btn') as HTMLButtonElement | null

  if (existingNewTestBtn) {
    if (effectiveHasSteps) {
      existingNewTestBtn.disabled = false
      existingNewTestBtn.removeAttribute('disabled')
      existingNewTestBtn.style.opacity = '1'
      existingNewTestBtn.style.cursor = 'pointer'
      existingNewTestBtn.title = 'Start new test recording (new page/file)'
    } else {
      existingNewTestBtn.disabled = true
      existingNewTestBtn.setAttribute('disabled', 'true')
      existingNewTestBtn.style.opacity = '0.35'
      existingNewTestBtn.style.cursor = 'not-allowed'
      existingNewTestBtn.title = 'Disabled: Record at least one action/assertion to start a new test'
    }
  }

  if (existingNewSerialBtn) {
    if (effectiveHasSteps) {
      existingNewSerialBtn.disabled = false
      existingNewSerialBtn.removeAttribute('disabled')
      existingNewSerialBtn.style.opacity = '1'
      existingNewSerialBtn.style.cursor = 'pointer'
      existingNewSerialBtn.title = 'Add serial test (continues on same page)'
    } else {
      existingNewSerialBtn.disabled = true
      existingNewSerialBtn.setAttribute('disabled', 'true')
      existingNewSerialBtn.style.opacity = '0.35'
      existingNewSerialBtn.style.cursor = 'not-allowed'
      existingNewSerialBtn.title = 'Disabled: Record at least one action/assertion to add a serial test'
    }
  }

  if (numEl) {
    numEl.textContent = '#' + idx
    return
  }

  // Remove existing panel to re-inject with updated index
  const existing = document.getElementById('pw-core-codegen-panel')
  if (existing) existing.remove()

  const div = document.createElement('div')
  div.id = 'pw-core-codegen-panel'
  div.setAttribute('data-pw-core-panel', 'true')
  div.style.cssText = [
    'position:fixed',
    'top:0px',
    'left:35%',
    'z-index:2147483647',
    'display:flex',
    'align-items:center',
    'gap:0',
    'background:rgba(255,255,255,0.867)',
    'box-shadow: rgba(0, 0, 0, 0.1) 0px 5px 5px',
    'backdrop-filter:blur(8px)',
    '-webkit-backdrop-filter:blur(8px)',
    'border:1px solid rgba(0,0,0,0.12)',
    'border-radius:4px',
    'font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif',
    'color:#000',
    'user-select:none',
    'pointer-events:all',
    'cursor:grab',
    'overflow:hidden'
  ].join(';')

  const styleEl = document.createElement('style')
  styleEl.textContent = cssStyle
  div.appendChild(styleEl)

  // Create temporary container to parse htmlContent
  const temp = document.createElement('div')
  temp.innerHTML = htmlContent
  while (temp.firstChild) {
    div.appendChild(temp.firstChild)
  }

  document.body.appendChild(div)

  // Drag logic — constrained to top edge only
  let dragging = false
  let dragStartX = 0
  let startLeft = 0

  const dragHandle = document.getElementById('pw-core-drag-handle')
  const onMouseDown = (e: MouseEvent) => {
    dragging = true
    dragStartX = e.clientX
    const rect = div.getBoundingClientRect()
    startLeft = rect.left
    div.style.cursor = 'grabbing'
    if (dragHandle) dragHandle.style.cursor = 'grabbing'
    e.preventDefault()
  }
  const onMouseMove = (e: MouseEvent) => {
    if (!dragging) return
    const dx = e.clientX - dragStartX
    const newLeft = Math.max(0, Math.min(window.innerWidth - div.offsetWidth, startLeft + dx))
    div.style.left = newLeft + 'px'
  }
  const onMouseUp = () => {
    dragging = false
    div.style.cursor = 'grab'
    if (dragHandle) dragHandle.style.cursor = 'grab'
  }

  if (dragHandle) dragHandle.addEventListener('mousedown', onMouseDown)
  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)

  const enableButtons = () => {
    safeSessionStorage('set', 'pw-core-has-steps', 'true')

    const newTestBtn = document.getElementById('pw-core-new-test-btn') as HTMLButtonElement | null
    const newSerialBtn = document.getElementById('pw-core-new-serial-btn') as HTMLButtonElement | null

    if (newTestBtn && newTestBtn.disabled) {
      newTestBtn.disabled = false
      newTestBtn.removeAttribute('disabled')
      newTestBtn.style.opacity = '1'
      newTestBtn.style.cursor = 'pointer'
      newTestBtn.title = 'Start new test recording (new page/file)'
    }
    if (newSerialBtn && newSerialBtn.disabled) {
      newSerialBtn.disabled = false
      newSerialBtn.removeAttribute('disabled')
      newSerialBtn.style.opacity = '1'
      newSerialBtn.style.cursor = 'pointer'
      newSerialBtn.title = 'Add serial test (continues on same page)'
    }
  }

  // Auto-enable buttons instantly on any page interaction
  document.addEventListener('click', (e) => {
    if (e.target && (e.target as HTMLElement).closest('#pw-core-codegen-panel')) return
    enableButtons()
  }, { capture: true, passive: true })

  document.addEventListener('keydown', (e) => {
    if (e.target && (e.target as HTMLElement).closest('#pw-core-codegen-panel')) return
    enableButtons()
  }, { capture: true, passive: true })

  document.addEventListener('input', (e) => {
    if (e.target && (e.target as HTMLElement).closest('#pw-core-codegen-panel')) return
    enableButtons()
  }, { capture: true, passive: true })

  const optimisticUpdate = (type: 'test' | 'serial') => {
    const numEl = document.getElementById('pw-core-test-num')
    if (numEl) {
      const current = numEl.textContent || ''
      const clean = current.replace('#', '')
      if (type === 'test') {
        const parts = clean.split('.')
        const nextMajor = parseInt(parts[0], 10) + 1
        numEl.textContent = '#' + nextMajor
      } else {
        const parts = clean.split('.')
        if (parts.length === 1) {
          numEl.textContent = '#' + parts[0] + '.2'
        } else {
          const nextMinor = (parseInt(parts[1], 10) || 1) + 1
          numEl.textContent = '#' + parts[0] + '.' + nextMinor
        }
      }
    }

    const newTestBtn = document.getElementById('pw-core-new-test-btn') as HTMLButtonElement | null
    const newSerialBtn = document.getElementById('pw-core-new-serial-btn') as HTMLButtonElement | null
    if (newTestBtn) {
      newTestBtn.disabled = true
      newTestBtn.setAttribute('disabled', 'true')
      newTestBtn.style.opacity = '0.35'
      newTestBtn.style.cursor = 'not-allowed'
    }
    if (newSerialBtn) {
      newSerialBtn.disabled = true
      newSerialBtn.setAttribute('disabled', 'true')
      newSerialBtn.style.opacity = '0.35'
      newSerialBtn.style.cursor = 'not-allowed'
    }
  }

  div.addEventListener('click', (e: MouseEvent) => {
    const target = e.target as HTMLElement | null
    if (!target) return
    const btn = target.closest('.__pw-btn') as HTMLButtonElement | null
    if (!btn || btn.disabled) return

    e.preventDefault()
    e.stopPropagation()

    if (btn.id === 'pw-core-new-test-btn') {
      safeSessionStorage('remove', 'pw-core-has-steps')
      optimisticUpdate('test')
      const trigger = () => {
        if (window.__pwCoreStartNewTest) {
          window.__pwCoreStartNewTest()
        } else {
          setTimeout(trigger, 50)
        }
      }
      trigger()
    } else if (btn.id === 'pw-core-new-serial-btn') {
      safeSessionStorage('remove', 'pw-core-has-steps')
      optimisticUpdate('serial')
      const trigger = () => {
        if (window.__pwCoreStartNewSerialTest) {
          window.__pwCoreStartNewSerialTest()
        } else {
          setTimeout(trigger, 50)
        }
      }
      trigger()
    }
  })
}
