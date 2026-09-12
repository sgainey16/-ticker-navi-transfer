// Minimal cross-component tab switcher for the top-tab shell.
// A requested tab is queued when the tab host isn't mounted yet (e.g. an OUT-rail
// tap from a hard deep-link), then replayed as soon as the host registers — so the
// shell always lands on the tab the user chose, never a default.
let handler: ((key: string) => void) | null = null;
let pending: string | null = null;

export const setTabHandler = (h: ((key: string) => void) | null) => {
  handler = h;
  if (h && pending) {
    const key = pending;
    pending = null;
    h(key);
  }
};

export const goToTab = (key: string) => {
  if (handler) handler(key);
  else pending = key;
};
