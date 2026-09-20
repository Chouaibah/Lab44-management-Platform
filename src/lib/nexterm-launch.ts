'use client';

/**
 * Launch a Nexterm console in a new tab: sign the user in with a session token
 * and open exactly one entry — nothing typed, no login form.
 *
 * ── Why this is not one URL ──────────────────────────────────────────────────
 * Verified against the Nexterm source (gnmyt/Nexterm, `client/src`):
 *
 *  1. `UserContext.jsx` reads `?token=` from the URL, calls
 *     `updateSessionToken()` (which writes `localStorage.sessionToken`) and then
 *     `navigate('/servers', { replace: true })` — the query string is stripped
 *     immediately. So `?token=…&connectId=…` in a single URL always loses the
 *     entry.
 *  2. `Servers.jsx` reads `?connectId=` and auto-connects, but only once the
 *     session is valid, and only for an entry that has an identity attached
 *     (`canConnectWithoutPrompt`). `?connectId=…` on an unauthenticated tab is
 *     therefore ignored and the login dialog is shown.
 *
 * Hence two navigations. The second one is *timed*: firing it too early
 * replaces the token URL before the SPA has persisted the token, which leaves
 * the tab logged out — the exact "Nexterm without login" symptom. A fixed short
 * timer races the bundle download, so we wait for the token navigation to
 * commit and then leave the SPA time to store the token.
 */

/** Strip trailing slashes/fragments and add a scheme when the URL has none. */
export function normalizeNextermBaseUrl(url?: string | null): string {
  let base = (url || '').trim().replace(/[/#]+$/, '');
  if (base && !base.startsWith('http://') && !base.startsWith('https://')) {
    base = `http://${base}`;
  }
  return base;
}

const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

/**
 * Resolve once the popup has committed its new document (i.e. it is no longer
 * `about:blank`). Reading `location.href` of a cross-origin window throws, and
 * that throw *is* the signal that the document was replaced. Resolves `false`
 * on timeout, in which case the caller waits longer instead.
 */
function waitForDocumentCommit(win: Window, timeoutMs: number): Promise<boolean> {
  return new Promise((resolve) => {
    const startedAt = Date.now();
    const tick = () => {
      if (win.closed) return resolve(false);
      let done = false;
      try {
        // Readable → still the initial about:blank (or a same-origin document).
        done = win.location.href !== 'about:blank';
      } catch {
        // Threw → a cross-origin document is now committed.
        done = true;
      }
      if (done) return resolve(true);
      if (Date.now() - startedAt >= timeoutMs) return resolve(false);
      window.setTimeout(tick, 150);
    };
    tick();
  });
}

export interface NextermLaunchOptions {
  /** Nexterm's browser-facing base URL, e.g. `http://192.168.100.131:6989`. */
  baseUrl: string;
  /** Session token from the API (`authToken`). */
  sessionToken: string;
  /** The entry to open (`identifier`). */
  entryId: string | number;
}

/**
 * Opens the console tab. Returns immediately; the entry navigation happens a
 * few seconds later, once the token has been stored by the Nexterm SPA.
 *
 * If the popup is blocked the same URL is opened in the current tab, because a
 * silent failure here is indistinguishable from "Nexterm is broken".
 */
export function launchNextermConsole({ baseUrl, sessionToken, entryId }: NextermLaunchOptions): void {
  const serversUrl = `${baseUrl}/servers`;
  const tokenUrl = `${serversUrl}?token=${encodeURIComponent(sessionToken)}`;
  const entryUrl = `${serversUrl}?connectId=${encodeURIComponent(String(entryId))}`;

  const win = window.open(tokenUrl, '_blank');
  if (!win) {
    window.location.href = tokenUrl;
    return;
  }

  void (async () => {
    const committed = await waitForDocumentCommit(win, 8000);
    // After the document commits, the SPA still has to boot and write the token
    // to localStorage before the query string can be replaced.
    await sleep(committed ? 2500 : 4500);
    if (win.closed) return;
    try {
      win.location.href = entryUrl;
    } catch {
      // A cross-origin write can be refused; the user then sees their own entry
      // list inside Nexterm and opens the VM with one click.
    }
  })();
}
