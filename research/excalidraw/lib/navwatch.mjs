// Watches navigations that the page starts itself: links, redirects, scripts and popups. The
// `goto` step checks its own target, but these never pass through it. Blocking them before the
// request leaves would need request interception, which changes caching and service-worker
// behaviour under observation, so the watcher halts the session instead: once the main frame
// leaves the navigation allowlist, or any popup opens, every later step fails fatally. Popups are
// closed as soon as they are seen.
import { isAllowedNavigation } from './guard.mjs';
import { sanitiseUrl } from './sanitise.mjs';

/**
 * Attaches the watcher to a Playwright page. `record` receives a metadata-only event for each
 * violation. Returns a function that yields the first halt reason, or null.
 */
export function watchNavigation(page, record = () => undefined) {
  let reason = null;
  const halt = (text, url) => {
    reason ??= text;
    record({ event: 'navigation-halt', reason: text, ...sanitiseUrl(url) });
  };
  page.on('framenavigated', (frame) => {
    if (frame === page.mainFrame() && !isAllowedNavigation(frame.url())) {
      halt('the page navigated off the allowlist.', frame.url());
    }
  });
  page.on('popup', (popup) => {
    halt('the page opened a popup.', popup.url());
    void popup.close().catch(() => undefined);
  });
  return () => reason;
}
