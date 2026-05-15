/**
 * Stable, anonymous “who queued this” label per browser (localStorage).
 * Uses animal emoji + coined / nature-Latin style tokens — not real people’s names.
 */

const STORAGE_KEY = "jam:contributor:v1";

const ANIMAL_EMOJIS = [
  "🦦",
  "🐨",
  "🦊",
  "🐙",
  "🦑",
  "🐧",
  "🦔",
  "🐢",
  "🦎",
  "🐸",
  "🦋",
  "🐞",
  "🐝",
  "🦆",
  "🦢",
  "🐬",
  "🦭",
  "🦘",
  "🐿️",
  "🦫",
  "🦚",
  "🦜",
  "🦩",
  "🪼",
  "🐠",
  "🐡",
  "🦐",
  "🪿",
  "🦤",
  "🐲",
] as const;

/** Coined / descriptive tokens (no common personal given names). */
const LABEL_TOKENS = [
  "Vesperil",
  "Noctilon",
  "Citrides",
  "Silvatrix",
  "Astrapex",
  "Brumifold",
  "Lucerneve",
  "Foliarix",
  "Umbrelis",
  "Caudapex",
  "Pinnavel",
  "Fulgoris",
  "Velumark",
  "Altispar",
  "Nimbulon",
  "Zephyline",
  "Stratalux",
  "Lumivex",
  "Calyxar",
  "Micastra",
  "Torrenvil",
  "Glacieth",
  "Nivalux",
  "Auratrix",
  "Polarvex",
  "Stellispar",
  "Solgrain",
  "Lunatrix",
  "Marivent",
  "Azurel",
  "Viridion",
  "Rubrist",
  "Citrvex",
  "Olivent",
  "Tealith",
  "Aequor",
  "Sabulon",
  "Nivalis",
  "Pintris",
  "Volant",
  "Cirrhex",
  "Pluvion",
  "Saxumal",
  "Torrind",
  "Virent",
  "Algent",
  "Ferventix",
  "Gelidor",
  "Lapidon",
  "Florvex",
] as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

/**
 * Returns a persisted label like "🦦 Lumivex". Safe to call from client event handlers.
 */
export function getOrCreateJamContributorLabel(): string {
  if (typeof window === "undefined") return "";
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const o = JSON.parse(raw) as { label?: unknown };
      if (typeof o.label === "string") {
        const t = o.label.trim();
        if (t.length > 0 && t.length <= 80) return t;
      }
    }
  } catch {
    /* ignore */
  }
  const label = `${pick(ANIMAL_EMOJIS)} ${pick(LABEL_TOKENS)}`;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ label }));
  } catch {
    /* ignore */
  }
  return label;
}
