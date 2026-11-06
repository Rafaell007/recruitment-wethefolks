// Read on click, not at load: the ad server may set window.clickTag after our script runs.
export function openClickTag() {
  const clickTag = window.clickTag || 'https://example.com/landing';
  window.open(clickTag, '_blank');
}
