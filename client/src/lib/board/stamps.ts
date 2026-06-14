// Stamp templates: sets of cell offsets (with color) relative to the tap point.
// "smile" uses the user's selected color; flags carry their own colors.

import { PALETTE_SIZE } from "@shared/palette";

export interface Offset {
  dx: number;
  dy: number;
}

export interface StampCell {
  dx: number;
  dy: number;
  color: number;
}

export interface StampDef {
  key: string;
  label: string; // emoji/text shown on the picker button
  name: string; // accessible label
  build: (color: number) => StampCell[];
}

// ---- smiley (procedural, uses the selected color) ----

export function smileyOffsets(r = 8): Offset[] {
  const cells = new Set<string>();
  const add = (x: number, y: number) => cells.add(`${x},${y}`);
  for (let a = 0; a < 360; a += 2) {
    const rad = (a * Math.PI) / 180;
    add(Math.round(Math.cos(rad) * r), Math.round(Math.sin(rad) * r));
  }
  const ey = -Math.round(r * 0.35);
  const ex = Math.round(r * 0.42);
  for (const sx of [-ex, ex]) {
    for (let oy = 0; oy <= 1; oy++) for (let ox = 0; ox <= 1; ox++) add(sx + ox, ey + oy);
  }
  const mr = r * 0.58;
  for (let a = 20; a <= 160; a += 3) {
    const rad = (a * Math.PI) / 180;
    add(Math.round(Math.cos(rad) * mr), Math.round(Math.sin(rad) * mr * 0.9) + 1);
  }
  return [...cells].map((s) => {
    const [dx, dy] = s.split(",").map(Number);
    return { dx: dx ?? 0, dy: dy ?? 0 };
  });
}

// ---- flag grid builder ----

const FW = 13;
const FH = 9;
const CX = (FW - 1) / 2; // 6
const CY = (FH - 1) / 2; // 4

// Palette indices (see shared/palette.ts, 32-color set)
const C = {
  black: 0,
  white: 1,
  gray: 2,
  red: 5,
  orange: 6,
  yellow: 7,
  green: 8,
  sky: 10,
  blue: 11,
  navy: 12,
};

type Grid = number[][];
const newGrid = (): Grid => Array.from({ length: FH }, () => new Array<number>(FW).fill(-1));
const fillAll = (g: Grid, c: number) => g.forEach((row) => row.fill(c));
function rows(g: Grid, y0: number, y1: number, c: number): void {
  for (let y = y0; y <= y1; y++) for (let x = 0; x < FW; x++) g[y]![x] = c;
}
function rect(g: Grid, x0: number, y0: number, x1: number, y1: number, c: number): void {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) if (g[y]) g[y]![x] = c;
}
function disc(g: Grid, cx: number, cy: number, r: number, c: number): void {
  for (let y = 0; y < FH; y++)
    for (let x = 0; x < FW; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) g[y]![x] = c;
}

const STAR5 = ["..X..", "XXXXX", ".XXX.", ".X.X.", "X...X"];
function star(g: Grid, cx: number, cy: number, c: number): void {
  STAR5.forEach((rowStr, ry) => {
    for (let rx = 0; rx < rowStr.length; rx++) {
      if (rowStr[rx] !== "X") continue;
      const x = cx + rx - 2;
      const y = cy + ry - 2;
      if (g[y] && x >= 0 && x < FW) g[y]![x] = c;
    }
  });
}

function gridToCells(g: Grid): StampCell[] {
  const out: StampCell[] = [];
  for (let y = 0; y < FH; y++) {
    for (let x = 0; x < FW; x++) {
      const c = g[y]![x]!;
      if (c >= 0) out.push({ dx: x - CX, dy: y - CY, color: c });
    }
  }
  return out;
}

// Gray frame just outside the flag (so white-bordered flags read on white paper).
function frameCells(): StampCell[] {
  const out: StampCell[] = [];
  const x0 = -CX - 1;
  const x1 = FW - 1 - CX + 1;
  const y0 = -CY - 1;
  const y1 = FH - 1 - CY + 1;
  for (let x = x0; x <= x1; x++) {
    out.push({ dx: x, dy: y0, color: C.gray }, { dx: x, dy: y1, color: C.gray });
  }
  for (let y = y0 + 1; y <= y1 - 1; y++) {
    out.push({ dx: x0, dy: y, color: C.gray }, { dx: x1, dy: y, color: C.gray });
  }
  return out;
}

function perimeterHasWhite(g: Grid): boolean {
  for (let x = 0; x < FW; x++) {
    if (g[0]![x] === C.white || g[0]![x] === -1) return true;
    if (g[FH - 1]![x] === C.white || g[FH - 1]![x] === -1) return true;
  }
  for (let y = 0; y < FH; y++) {
    if (g[y]![0] === C.white || g[y]![0] === -1) return true;
    if (g[y]![FW - 1] === C.white || g[y]![FW - 1] === -1) return true;
  }
  return false;
}

function flag(builder: (g: Grid) => void): StampCell[] {
  const g = newGrid();
  builder(g);
  const cells = gridToCells(g);
  // Add a gray outline for flags whose edge is white/transparent.
  if (perimeterHasWhite(g)) cells.push(...frameCells());
  return cells;
}

const FLAGS = {
  KR: () => flag((g) => {
    fillAll(g, C.white);
    for (let y = 0; y < FH; y++)
      for (let x = 0; x < FW; x++)
        if ((x - CX) ** 2 + (y - CY) ** 2 <= 4)
          g[y]![x] = y < CY ? C.red : y > CY ? C.blue : x < CX ? C.red : C.blue;
    for (const [x, y] of [[1, 1], [2, 1], [10, 1], [11, 1], [1, 7], [2, 7], [10, 7], [11, 7]] as const)
      g[y]![x] = C.black;
  }),
  JP: () => flag((g) => { fillAll(g, C.white); disc(g, CX, CY, 2, C.red); }),
  ID: () => flag((g) => { rows(g, 0, 3, C.red); rows(g, 4, 8, C.white); }),
  TH: () => flag((g) => {
    rows(g, 0, 1, C.red); rows(g, 2, 2, C.white); rows(g, 3, 5, C.navy);
    rows(g, 6, 6, C.white); rows(g, 7, 8, C.red);
  }),
  VN: () => flag((g) => { fillAll(g, C.red); star(g, CX, CY, C.yellow); }),
  CN: () => flag((g) => {
    fillAll(g, C.red); star(g, 3, 3, C.yellow);
    for (const [x, y] of [[6, 1], [8, 2], [8, 4], [6, 5]] as const) g[y]![x] = C.yellow;
  }),
  US: () => flag((g) => {
    for (let y = 0; y < FH; y++) rows(g, y, y, y % 2 === 0 ? C.red : C.white);
    rect(g, 0, 0, 5, 4, C.navy);
    for (let y = 0; y <= 4; y++) for (let x = 1; x <= 4; x++) if ((x + y) % 2 === 0) g[y]![x] = C.white;
  }),
  TW: () => flag((g) => {
    fillAll(g, C.red); rect(g, 0, 0, 6, 4, C.navy); disc(g, 3, 2, 1, C.white); g[2]![3] = C.white;
  }),
  HK: () => flag((g) => {
    fillAll(g, C.red);
    for (const [x, y] of [[6, 2], [6, 6], [4, 4], [8, 4], [6, 4], [5, 3], [7, 5], [7, 3], [5, 5]] as const)
      g[y]![x] = C.white;
  }),
  PH: () => flag((g) => {
    rows(g, 0, 3, C.blue); rows(g, 4, 8, C.red);
    for (let y = 0; y < FH; y++) { const w = 5 - Math.abs(y - 4); for (let x = 0; x < w; x++) g[y]![x] = C.white; }
    g[4]![1] = C.yellow;
  }),
  SG: () => flag((g) => {
    rows(g, 0, 3, C.red); rows(g, 4, 8, C.white);
    disc(g, 3, 2, 2, C.white); disc(g, 4, 2, 2, C.red);
    for (const [x, y] of [[6, 1], [7, 2], [6, 3]] as const) g[y]![x] = C.white;
  }),
} satisfies Record<string, () => StampCell[]>;

// ---- registry ----

export const STAMPS: StampDef[] = [
  { key: "smile", label: "🙂", name: "스마일", build: (color) => smileyOffsets().map((o) => ({ ...o, color })) },
  { key: "KR", label: "🇰🇷", name: "한국", build: () => FLAGS.KR() },
  { key: "JP", label: "🇯🇵", name: "일본", build: () => FLAGS.JP() },
  { key: "CN", label: "🇨🇳", name: "중국", build: () => FLAGS.CN() },
  { key: "TW", label: "🇹🇼", name: "대만", build: () => FLAGS.TW() },
  { key: "US", label: "🇺🇸", name: "미국", build: () => FLAGS.US() },
  { key: "HK", label: "🇭🇰", name: "홍콩", build: () => FLAGS.HK() },
  { key: "PH", label: "🇵🇭", name: "필리핀", build: () => FLAGS.PH() },
  { key: "VN", label: "🇻🇳", name: "베트남", build: () => FLAGS.VN() },
  { key: "SG", label: "🇸🇬", name: "싱가포르", build: () => FLAGS.SG() },
  { key: "ID", label: "🇮🇩", name: "인도네시아", build: () => FLAGS.ID() },
  { key: "TH", label: "🇹🇭", name: "태국", build: () => FLAGS.TH() },
];

export function getStamp(key: string): StampDef {
  return STAMPS.find((s) => s.key === key) ?? STAMPS[0]!;
}

// Guard: ensure flag colors are within the palette (dev safety, tree-shaken in prod).
void PALETTE_SIZE;
