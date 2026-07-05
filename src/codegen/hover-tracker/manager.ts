import { BrowserContext } from '@playwright/test'
import { HoverTrackerOptions } from './types'
import { clientHoverTracker } from './client'

export class HoverTrackerManager {
  constructor(
    private context: BrowserContext,
    private options: HoverTrackerOptions
  ) {}

  /**
   * Initialize the hover tracking hooks on the browser context.
   */
  public async initialize(): Promise<void> {
    // 1. Expose function to browser context
    await this.context.exposeFunction('__pwCoreRecordHover', (selector: string) => {
      return this.options.onRecordHover(selector)
    })

    const fnStr = clientHoverTracker.toString()
    // 2. Add client script as init script
    await this.context.addInitScript((scriptStr) => {
      const fn = new Function(`return ${scriptStr}`)()
      fn()
    }, fnStr)
  }
}
