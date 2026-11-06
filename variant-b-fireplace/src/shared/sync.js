// The three parts are separate documents. A coordinator in the parent page (our preview) tells
// them one shared start time, so the shared background camera stays aligned during the intro.
export const TAG = 'wtf-fireplace';
const ACK_WAIT = 300; // no coordinator answers → we run alone (production)
const START_WAIT = 3000; // coordinator waits for slower siblings, but not forever

// Resolves with the shared start time in Date.now() ms (the same clock in every frame,
// unlike performance.now(), which starts with each document).
export function waitForStart(part) {
  return new Promise((resolve) => {
    if (window.parent === window) return resolve(Date.now());
    let timer = setTimeout(done, ACK_WAIT);

    function done(at = Date.now()) {
      clearTimeout(timer);
      window.removeEventListener('message', onMessage);
      resolve(at);
    }

    function onMessage(e) {
      const d = e.data;
      if (e.source !== window.parent || !d || d.tag !== TAG) return;
      if (d.kind === 'hold') {
        clearTimeout(timer);
        timer = setTimeout(done, START_WAIT);
      }
      if (d.kind === 'start' && Number.isFinite(d.at)) done(d.at);
    }

    window.addEventListener('message', onMessage);
    // '*': the publisher's origin is unknown and the message carries nothing private.
    window.parent.postMessage({ tag: TAG, kind: 'ready', part }, '*');
  });
}
