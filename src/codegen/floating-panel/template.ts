export const FLOATING_PANEL_STYLE = `
  @keyframes __pwpulse{0%,100%{opacity:.4}50%{opacity:1}}
  @keyframes __pwcolorchange{0%,100%{color:#000}50%{color:#ef4444}}
  #pw-core-test-num {
    animation: __pwcolorchange 3s ease-in-out infinite;
    font-weight: 700;
  }
  #pw-core-codegen-panel .__pw-btn {
    all:unset; display:flex; align-items:center; justify-content:center;
    width:32px; height:36px; cursor:pointer; color:#000;
    transition:background .12s, color .12s; flex-shrink:0;
  }
  #pw-core-codegen-panel .__pw-btn:hover:not(:disabled) { background:rgba(0,0,0,0.07); color:#000; }
  #pw-core-codegen-panel .__pw-btn.--active { color:#000; }
  #pw-core-codegen-panel .__pw-sep { width:1px; height:20px; background:rgba(0,0,0,0.12); flex-shrink:0; margin:0; }
  #pw-core-codegen-panel .__pw-drag { display:flex; align-items:center; justify-content:center; width:22px; height:36px; cursor:grab; color:rgba(0,0,0,0.4); flex-shrink:0; }
  #pw-core-codegen-panel .__pw-drag:active { cursor:grabbing; }
  #pw-core-codegen-panel .__pw-label { font-size:13px; font-weight:500; color:#000; padding:0 4px; white-space:nowrap; line-height:36px; }
`

export function getFloatingPanelHtml(
  idx: string,
  fileName: string,
  newTestTitle: string,
  newSerialTitle: string,
  disabledAttr: string
): string {
  return `
<!-- Drag handle (grid dots like Playwright) -->
<div class="__pw-drag" id="pw-core-drag-handle" title="Drag to move">
  <svg width="10" height="12" viewBox="0 0 10 12" fill="currentColor">
    <rect x="1" y="0.5" width="2" height="2" rx="0.5"/><rect x="6" y="0.5" width="2" height="2" rx="0.5"/>
    <rect x="1" y="4.5" width="2" height="2" rx="0.5"/><rect x="6" y="4.5" width="2" height="2" rx="0.5"/>
    <rect x="1" y="8.5" width="2" height="2" rx="0.5"/><rect x="6" y="8.5" width="2" height="2" rx="0.5"/>
  </svg>
</div>
<div class="__pw-sep"></div>
<!-- Test label -->
<span class="__pw-label" title="Recording to ${fileName}">Test <span id="pw-core-test-num">#${idx}</span></span>
<div class="__pw-sep"></div>
<!-- New Test button -->
<button class="__pw-btn" id="pw-core-new-test-btn" title="${newTestTitle}"${disabledAttr}>
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="2" width="9" height="11" rx="1.5"/>
    <line x1="11" y1="5" x2="14" y2="5"/>
    <line x1="12.5" y1="3.5" x2="12.5" y2="6.5"/>
    <line x1="5" y1="6" x2="8" y2="6"/>
    <line x1="5" y1="8.5" x2="8" y2="8.5"/>
  </svg>
</button>
<div class="__pw-sep"></div>
<!-- New Serial Test button -->
<button class="__pw-btn" id="pw-core-new-serial-btn" title="${newSerialTitle}"${disabledAttr}>
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="2" width="7" height="12" rx="1"/>
    <rect x="11" y="2" width="3" height="3" rx="0.5"/>
    <rect x="11" y="6.5" width="3" height="3" rx="0.5"/>
    <rect x="11" y="11" width="3" height="3" rx="0.5"/>
  </svg>
</button>`
}
