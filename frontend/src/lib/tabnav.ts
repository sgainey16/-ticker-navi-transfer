// Minimal cross-component tab switcher for the top-tab shell.
let handler: ((key: string) => void) | null = null;

export const setTabHandler = (h: ((key: string) => void) | null) => {
  handler = h;
};

export const goToTab = (key: string) => {
  handler?.(key);
};
