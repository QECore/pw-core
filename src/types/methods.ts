import { zeroArgMethodsList, oneArgMethodsList } from '../constants/methods'

export type AllowedZeroArgMethods = (typeof zeroArgMethodsList)[number]
export type AllowedOneArgMethods = (typeof oneArgMethodsList)[number]
export type AllowedMethodKeys = AllowedZeroArgMethods | AllowedOneArgMethods
