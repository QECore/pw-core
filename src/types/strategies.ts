import { rolesList, strategyList } from '../constants/strategies'

export type RoleType = (typeof rolesList)[number]
export type StrategyType = (typeof strategyList)[number]

export type PlaywrightRoleOptions = {
  exact?: boolean
  checked?: boolean
  disabled?: boolean
  expanded?: boolean
  includeHidden?: boolean
  level?: number
  pressed?: boolean
  selected?: boolean
}

export type PlaywrightTextOptions = {
  exact?: boolean
}

export type LocatorStrategyOptions<S extends string> = S extends RoleType
  ? PlaywrightRoleOptions
  : S extends 'text' | 'label' | 'title' | 'placeholder' | 'altText'
    ? PlaywrightTextOptions
    : {}
