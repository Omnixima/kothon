import type { OSType } from "@/lib/utils/keyboard";

/** Mac keycap symbols for a formatted shortcut part ("Option" → "⌥"). */
const MAC_SYMBOLS: Record<string, string> = {
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

/** Windows and Linux keycaps print key names, except the arrows. */
const PC_SYMBOLS: Record<string, string> = {
  up: "↑",
  down: "↓",
  left: "←",
  right: "→",
};

const normalize = (key: string) =>
  key
    .trim()
    .toLowerCase()
    .replace(/^(left|right)\s+/, "");

/**
 * The keycap for a key. On a Mac, its symbol, ignoring Left/Right
 * ("Left Option" → "⌥"); elsewhere, its name ("Ctrl", "Space").
 */
export const keySymbol = (key: string, os: OSType = "macos"): string => {
  const symbols = os === "macos" ? MAC_SYMBOLS : PC_SYMBOLS;
  return symbols[normalize(key)] ?? key;
};

/** Keys whose symbol reads better with its name beside it (Mac only). */
export const keyNeedsLabel = (key: string, os: OSType = "macos"): boolean =>
  os === "macos" && normalize(key) === "space";
