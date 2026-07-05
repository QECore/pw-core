import { Locator } from '@playwright/test'
import type {
  PageKeys,
  CheckableLocatorKeys,
  CheckboxLocatorKeys,
  EditableLocatorKeys,
  SelectableLocatorKeys,
  ModifyOptionsForTarget
} from '../config'

export interface ProxyLocatorMethods<T> {
  /** @see {@link https://playwright.dev/docs/api/class-locator#locator-click Locator.click} */
  click<Target extends PageKeys<T> | Locator>(
    target: Target,
    options?: ModifyOptionsForTarget<T, Target, Parameters<Locator['click']>[0]>
  ): Promise<void>

  /** @see {@link https://playwright.dev/docs/api/class-locator#locator-dblclick Locator.dblclick} */
  dblclick<Target extends PageKeys<T> | Locator>(
    target: Target,
    options?: ModifyOptionsForTarget<T, Target, Parameters<Locator['dblclick']>[0]>
  ): Promise<void>

  /** @see {@link https://playwright.dev/docs/api/class-locator#locator-hover Locator.hover} */
  hover<Target extends PageKeys<T> | Locator>(
    target: Target,
    options?: ModifyOptionsForTarget<T, Target, Parameters<Locator['hover']>[0]>
  ): Promise<void>

  /** @see {@link https://playwright.dev/docs/api/class-locator#locator-focus Locator.focus} */
  focus<Target extends PageKeys<T> | Locator>(
    target: Target,
    options?: ModifyOptionsForTarget<T, Target, Parameters<Locator['focus']>[0]>
  ): Promise<void>

  /** @see {@link https://playwright.dev/docs/api/class-locator#locator-blur Locator.blur} */
  blur<Target extends PageKeys<T> | Locator>(
    target: Target,
    options?: ModifyOptionsForTarget<T, Target, Parameters<Locator['blur']>[0]>
  ): Promise<void>

  /** @see {@link https://playwright.dev/docs/api/class-locator#locator-check Locator.check} */
  check<Target extends CheckableLocatorKeys<T> | Locator>(
    target: Target,
    options?: ModifyOptionsForTarget<T, Target, Parameters<Locator['check']>[0]>
  ): Promise<void>

  /** @see {@link https://playwright.dev/docs/api/class-locator#locator-uncheck Locator.uncheck} */
  uncheck<Target extends CheckboxLocatorKeys<T> | Locator>(
    target: Target,
    options?: ModifyOptionsForTarget<T, Target, Parameters<Locator['uncheck']>[0]>
  ): Promise<void>

  /** @see {@link https://playwright.dev/docs/api/class-locator#locator-clear Locator.clear} */
  clear<Target extends EditableLocatorKeys<T> | (string & {}) | Locator>(
    target: Target,
    options?: ModifyOptionsForTarget<T, Target, Parameters<Locator['clear']>[0]>
  ): Promise<void>

  /** @see {@link https://playwright.dev/docs/api/class-locator#locator-wait-for Locator.waitFor} */
  waitFor<Target extends PageKeys<T> | Locator>(
    target: Target,
    options?: ModifyOptionsForTarget<T, Target, Parameters<Locator['waitFor']>[0]>
  ): Promise<void>

  /** @see {@link https://playwright.dev/docs/api/class-locator#locator-is-checked Locator.isChecked} */
  isChecked<Target extends CheckableLocatorKeys<T> | Locator>(
    target: Target,
    options?: ModifyOptionsForTarget<T, Target, Parameters<Locator['isChecked']>[0]>
  ): Promise<boolean>

  /** @see {@link https://playwright.dev/docs/api/class-locator#locator-is-disabled Locator.isDisabled} */
  isDisabled<Target extends PageKeys<T> | Locator>(
    target: Target,
    options?: ModifyOptionsForTarget<T, Target, Parameters<Locator['isDisabled']>[0]>
  ): Promise<boolean>

  /** @see {@link https://playwright.dev/docs/api/class-locator#locator-is-visible Locator.isVisible} */
  isVisible<Target extends PageKeys<T> | Locator>(
    target: Target,
    options?: ModifyOptionsForTarget<T, Target, Parameters<Locator['isVisible']>[0]>
  ): Promise<boolean>

  /** @see {@link https://playwright.dev/docs/api/class-locator#locator-text-content Locator.textContent} */
  textContent<Target extends PageKeys<T> | Locator>(
    target: Target,
    options?: ModifyOptionsForTarget<T, Target, Parameters<Locator['textContent']>[0]>
  ): Promise<string | null>

  /** @see {@link https://playwright.dev/docs/api/class-locator#locator-inner-text Locator.innerText} */
  innerText<Target extends PageKeys<T> | Locator>(
    target: Target,
    options?: ModifyOptionsForTarget<T, Target, Parameters<Locator['innerText']>[0]>
  ): Promise<string>

  /** @see {@link https://playwright.dev/docs/api/class-locator#locator-all-inner-texts Locator.allInnerTexts} */
  allInnerTexts<Target extends PageKeys<T> | Locator>(
    target: Target
  ): Promise<string[]>

  /** @see {@link https://playwright.dev/docs/api/class-locator#locator-all-text-contents Locator.allTextContents} */
  allTextContents<Target extends PageKeys<T> | Locator>(
    target: Target
  ): Promise<string[]>

  /** @see {@link https://playwright.dev/docs/api/class-locator#locator-count Locator.count} */
  count<Target extends PageKeys<T> | Locator>(
    target: Target
  ): Promise<number>

  /** @see {@link https://playwright.dev/docs/api/class-locator#locator-scroll-into-view-if-needed Locator.scrollIntoViewIfNeeded} */
  scrollIntoViewIfNeeded<Target extends PageKeys<T> | Locator>(
    target: Target,
    options?: ModifyOptionsForTarget<T, Target, Parameters<Locator['scrollIntoViewIfNeeded']>[0]>
  ): Promise<void>

  /** @see {@link https://playwright.dev/docs/api/class-locator#locator-bounding-box Locator.boundingBox} */
  boundingBox<Target extends PageKeys<T> | Locator>(
    target: Target
  ): Promise<{ x: number; y: number; width: number; height: number } | null>

  /** @see {@link https://playwright.dev/docs/api/class-locator#locator-press Locator.press} */
  press<Target extends EditableLocatorKeys<T> | (string & {}) | Locator>(
    target: Target,
    key: string,
    options?: ModifyOptionsForTarget<T, Target, Parameters<Locator['press']>[1]>
  ): Promise<void>

  /** @see {@link https://playwright.dev/docs/api/class-locator#locator-press-sequentially Locator.pressSequentially} */
  pressSequentially<Target extends EditableLocatorKeys<T> | (string & {}) | Locator>(
    target: Target,
    value: string,
    options?: ModifyOptionsForTarget<T, Target, Parameters<Locator['pressSequentially']>[1]>
  ): Promise<void>

  /** @see {@link https://playwright.dev/docs/api/class-locator#locator-select-option Locator.selectOption} */
  selectOption<Target extends SelectableLocatorKeys<T> | (string & {}) | Locator>(
    target: Target,
    values: string | string[] | { value?: string; label?: string; index?: number } | null,
    options?: ModifyOptionsForTarget<T, Target, Parameters<Locator['selectOption']>[1]>
  ): Promise<string[]>

  /** @see {@link https://playwright.dev/docs/api/class-locator#locator-set-input-files Locator.setInputFiles} */
  setInputFiles<Target extends PageKeys<T> | Locator>(
    target: Target,
    files: string | string[] | { name: string; mimeType: string; buffer: Buffer } | { name: string; mimeType: string; buffer: Buffer }[],
    options?: ModifyOptionsForTarget<T, Target, Parameters<Locator['setInputFiles']>[1]>
  ): Promise<void>

  /** @see {@link https://playwright.dev/docs/api/class-locator#locator-get-attribute Locator.getAttribute} */
  getAttribute<Target extends PageKeys<T> | Locator>(
    target: Target,
    name: string,
    options?: ModifyOptionsForTarget<T, Target, Parameters<Locator['getAttribute']>[1]>
  ): Promise<string | null>

  /** @see {@link https://playwright.dev/docs/api/class-locator#locator-fill Locator.fill} */
  fill<Target extends EditableLocatorKeys<T> | (string & {}) | Locator>(
    target: Target,
    value: string,
    options?: ModifyOptionsForTarget<T, Target, Parameters<Locator['fill']>[1]> & {
      mask?: boolean
    }
  ): Promise<void>

  /** @see {@link https://playwright.dev/docs/api/class-locator#locator-drag-to Locator.dragTo} */
  dragTo<Target extends PageKeys<T> | Locator>(
    target: Target,
    destination: PageKeys<T> | Locator,
    options?: ModifyOptionsForTarget<T, Target, Parameters<Locator['dragTo']>[1]>
  ): Promise<void>
}
