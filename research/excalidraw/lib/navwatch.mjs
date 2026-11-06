// Watches navigations that the page starts itself: links, redirects, scripts and popups. The
// `goto` step checks its own target, but these never pass through it. Blocking them before the
// request leaves would need request interception, which changes caching and service-worker
// behaviour under observation, so the watcher halts the session instead: once the main frame
// leaves the navigation allowlist, or any popup opens, every later step fails fatally. Popups are
// closed as soon as they are seen. The halt reason is kept in the session state, so a restarted
// driver stays halted, and a driver that attaches to a page already off the allowlist halts at
// once.
//
// A room or `json` link value in the URL is allowed only once a `runLast` scenario has started
// (see createGate in server.mjs). A `goto` step never opens one: checkNavigation refuses such a
// target before navigating. The page can still reach one itself, for example when a UI click
// outside `runLast` starts a session, and a driver restarted on a new `--out`, with an empty
// state, can attach to a page still in a room. Either would run ordinary scenarios in a view that
// may show the room link, so both halt the session. That halt comes after the navigation.
import { isAllowedNavigation } from './guard.mjs';
import { hasSecretFragment, sanitiseUrl } from './sanitise.mjs';
import { memoryState } from './session-state.mjs';

const unlockedRoom = (url, state) => hasSecretFragment(url) && state.runLastStarted().length === 0;

/**
 * Attaches the watcher to a Playwright page. `record` receives a metadata-only event for each
 * violation; `state` keeps the first halt reason (see session-state.mjs). Returns a function that
 * yields the first halt reason, or null.
 */
export function watchNavigation(page, record = () => undefined, state = memoryState()) {
  const halt = (text, url) => {
    state.halt(text);
    record({ event: 'navigation-halt', reason: text, ...sanitiseUrl(url) });
  };
  const current = page.mainFrame().url();
  if (!isAllowedNavigation(current)) halt('the page was off the allowlist when attached.', current);
  else if (unlockedRoom(current, state)) {
    halt('the page held a collaboration value when attached, with no runLast scenario.', current);
  }
  page.on('framenavigated', (frame) => {
    if (frame !== page.mainFrame()) return;
    if (!isAllowedNavigation(frame.url())) {
      halt('the page navigated off the allowlist.', frame.url());
    } else if (unlockedRoom(frame.url(), state)) {
      halt('the page reached a collaboration value without a runLast scenario.', frame.url());
    }
  });
  page.on('popup', (popup) => {
    halt('the page opened a popup.', popup.url());
    void popup.close().catch(() => undefined);
  });
  return () => state.halted();
}
