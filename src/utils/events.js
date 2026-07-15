export function triggerRender() {
  window.dispatchEvent(new Event('app:render'));
}
