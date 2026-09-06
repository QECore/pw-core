import { BrowserContext, Page } from '@playwright/test'
import { FloatingPanelOptions } from './types'
import { FLOATING_PANEL_STYLE, getFloatingPanelHtml } from './template'
import { clientInjectFloatingPanel } from './client'

export class FloatingPanelManager {
  constructor(
    private context: BrowserContext,
    private options: FloatingPanelOptions
  ) {}

  /**
   * Set up all required floating panel logic, including exposing callbacks and page event listeners.
   */
  public async initialize(): Promise<void> {
    // 1. Expose functions to the browser context
    await this.context.exposeFunction('__pwCoreGetTestIndex', () => {
      return this.options.getDisplayTestIndex()
    })

    await this.context.exposeFunction('__pwCoreStartNewTest', () => {
      return this.options.onStartNewTest()
    })

    await this.context.exposeFunction('__pwCoreStartNewSerialTest', () => {
      return this.options.onStartNewSerialTest()
    })

    // 2. Listen for page events to automatically inject the panel
    this.context.on('page', (p: Page) => {
      p.on('load', () => this.inject(p))
      p.on('domcontentloaded', () => this.inject(p))
      p.on('framenavigated', (frame) => {
        if (frame === p.mainFrame()) {
          // Wait briefly for SPA framework to mount before injecting/updating
          setTimeout(() => {
            this.inject(p)
          }, 200)
        }
      })
    })
  }

  /**
   * Inject or update the floating panel on a single page.
   */
  public async inject(page: Page): Promise<void> {
    try {
      const idx = this.options.getDisplayTestIndex()
      const fileName = this.options.getOutputFileName()
      const hasSteps = this.options.hasSteps()

      const newTestTitle = hasSteps
        ? 'Start new test recording (new page/file)'
        : 'Disabled: Record at least one action/assertion to start a new test'

      const newSerialTitle = hasSteps
        ? 'Add serial test (continues on same page)'
        : 'Disabled: Record at least one action/assertion to add a serial test'

      const disabledAttr = hasSteps ? '' : ' disabled style="opacity:0.35; cursor:not-allowed;"'

      const htmlContent = getFloatingPanelHtml(idx, fileName, newTestTitle, newSerialTitle, disabledAttr)

      // Evaluate the client injection function directly in the page context via Playwright
      await page.evaluate(clientInjectFloatingPanel, {
        idx,
        fileName,
        hasSteps,
        cssStyle: FLOATING_PANEL_STYLE,
        htmlContent
      })
    } catch {
      // Non-fatal: ignore injection failure on navigation frames and allow recording to proceed
    }
  }

  /**
   * Helper to inject or update the panel on all active pages.
   */
  public async injectAll(): Promise<void> {
    for (const p of this.context.pages()) {
      await this.inject(p)
    }
  }
}
