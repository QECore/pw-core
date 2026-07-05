export interface FloatingPanelOptions {
  getDisplayTestIndex: () => string
  getOutputFileName: () => string
  hasSteps: () => boolean
  onStartNewTest: () => Promise<void> | void
  onStartNewSerialTest: () => Promise<void> | void
}
