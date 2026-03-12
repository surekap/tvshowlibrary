/**
 * Generate a deterministic color for a show based on its name.
 * Returns a hex color string from a curated palette.
 */
const COLOR_PALETTE = [
  "#6366f1", // indigo
  "#8b5cf6", // violet
  "#ec4899", // pink
  "#f43f5e", // rose
  "#f97316", // orange
  "#eab308", // yellow
  "#22c55e", // green
  "#14b8a6", // teal
  "#06b6d4", // cyan
  "#3b82f6", // blue
  "#a855f7", // purple
  "#ef4444", // red
];

export function getShowColor(showName: string): string {
  let hash = 0;
  for (let i = 0; i < showName.length; i++) {
    const char = showName.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  const index = Math.abs(hash) % COLOR_PALETTE.length;
  return COLOR_PALETTE[index];
}

export function formatEpisodeCode(season: number, episode: number): string {
  const s = String(season).padStart(2, "0");
  const e = String(episode).padStart(2, "0");
  return `S${s}E${e}`;
}

export function formatAirDate(aired: string | null | undefined): string {
  if (!aired) return "TBA";
  try {
    const date = new Date(aired);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return aired;
  }
}
