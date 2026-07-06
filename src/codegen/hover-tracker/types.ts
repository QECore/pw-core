export interface HoverTrackerOptions {
  onRecordHover: (selector: string) => Promise<void> | void
}
