/** Mac keycap symbols for a formatted shortcut part ("Option" → "⌥"). */
const SYMBOLS: Record<string, string> = {
  option: "⌥",
  alt: "⌥",
  command: "⌘",
  cmd: "⌘",
  control: "⌃",
  ctrl: "⌃",
  shift: "⇧",
  space: "␣",
  enter: "↩",
  return: "↩",
  tab: "⇥",
  escape: "⎋",
  esc: "⎋",
  delete: "⌫",
  backspace: "⌫",
  fn: "fn",
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
};

/** The symbol for a key, ignoring Left/Right ("Left Option" → "⌥"). */
export const keySymbol = (key: string): string => {
  const k = key
    .trim()
    .toLowerCase()
    .replace(/^(left|right)\s+/, "");
  return SYMBOLS[k] ?? key;
};

/** Keys whose symbol reads better with its name beside it. */
export const keyNeedsLabel = (key: string): boolean =>
  key
    .trim()
    .toLowerCase()
    .replace(/^(left|right)\s+/, "") === "space";
