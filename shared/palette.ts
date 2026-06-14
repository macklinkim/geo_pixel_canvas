// 16-color fixed palette. Single source for client renderer, worker, and MCP preview.
// Mixed dark/bright hues so pixel art separates from the map underneath.
// Index = palette color id (0..15). EMPTY (255) is rendered as transparent.

// 32-color pixel-art palette — primary colors first for easy picking.
export const PALETTE: readonly string[] = [
  "#000000", // 0  black
  "#FFFFFF", // 1  white
  "#7F7F7F", // 2  gray
  "#C3C3C3", // 3  light gray

  "#880015", // 4  dark red
  "#ED1C24", // 5  red
  "#FF7F27", // 6  orange
  "#FFF200", // 7  yellow

  "#22B14C", // 8  green
  "#00FF00", // 9  bright green
  "#00A2E8", // 10 sky blue
  "#3F48CC", // 11 blue

  "#000080", // 12 navy
  "#A349A4", // 13 purple
  "#B83DBA", // 14 vivid purple
  "#FFAEC9", // 15 pink

  "#FFC90E", // 16 warm yellow
  "#EFE4B0", // 17 beige
  "#B97A57", // 18 brown
  "#8B4513", // 19 dark brown

  "#C8BFE7", // 20 lavender
  "#99D9EA", // 21 pale cyan
  "#B5E61D", // 22 lime
  "#7092BE", // 23 muted blue

  "#FFB347", // 24 light orange
  "#FF6961", // 25 coral red
  "#77DD77", // 26 soft green
  "#AEC6CF", // 27 soft blue

  "#F4F4F4", // 28 off white
  "#1A1A1A", // 29 near black
  "#5D275D", // 30 deep purple
  "#38B764", // 31 pixel green
] as const;

export const PALETTE_SIZE = PALETTE.length;

export function isValidColor(color: number): boolean {
  return Number.isInteger(color) && color >= 0 && color < PALETTE_SIZE;
}
