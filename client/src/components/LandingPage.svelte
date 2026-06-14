<script lang="ts">
  import { onMount } from "svelte";
  import { MapPin, Radar, Radio, ShieldCheck, Palette as PaletteIcon, Users } from "lucide-svelte";
  import { PALETTE } from "@shared/palette";
  import { BOARD_W, BOARD_H, WRITE_RADIUS_M } from "@shared/constants";

  // First-run onboarding. `onenter` hands control back to the app; the intent
  // lets App decide whether to nudge the location flow ("paint") or just browse.
  let { onenter }: { onenter: (intent: "paint" | "explore") => void } = $props();

  let canvasEl = $state<HTMLCanvasElement | null>(null);
  let online = $state(12);

  // Each board cell is drawn SCALE×SCALE device pixels on the hero canvas.
  const SCALE = 6;

  // Tiny pixel sprites stamped onto the board ('.' = empty cell). Glyphs map to
  // palette indices so the mock uses the exact production color set.
  type Sprite = { x: number; y: number; rows: string[]; map: Record<string, number> };
  // Reusable glyph bitmaps; placements below spread them across the 192×128 board.
  const HEART = [".XX.XX.", "XXXXXXX", "XXXXXXX", ".XXXXX.", "..XXX..", "...X..."];
  const SMILEY = [
    ".YYYYY.",
    "YYYYYYY",
    "YYKYKYY",
    "YYYYYYY",
    "YKYYYKY",
    "YYKKKYY",
    ".YYYYY.",
  ];
  const TREE = ["...L...", "..LGL..", ".LGGGL.", "LGGGGGL", "...T...", "...T..."];
  const STAR = ["...S...", ".SSSSS.", "..SSS..", ".SS.SS.", ".S...S."];
  const DIAMOND = ["..D..", ".DDD.", "DDDDD", ".DDD.", "..D.."];

  const SPRITES: Sprite[] = [
    { x: 16, y: 30, map: { X: 5 }, rows: HEART }, // red heart
    { x: 150, y: 18, map: { Y: 7, K: 0 }, rows: SMILEY }, // yellow smiley
    { x: 60, y: 84, map: { G: 8, L: 17, T: 19 }, rows: TREE }, // green tree
    { x: 104, y: 16, map: { S: 7 }, rows: STAR }, // yellow star
    { x: 168, y: 96, map: { D: 10 }, rows: DIAMOND }, // sky-blue diamond
    { x: 120, y: 64, map: { X: 14 }, rows: HEART }, // purple heart
    { x: 24, y: 96, map: { G: 8, L: 17, T: 19 }, rows: TREE }, // second tree
    { x: 176, y: 50, map: { S: 6 }, rows: STAR }, // orange star
    { x: 36, y: 60, map: { D: 11 }, rows: DIAMOND }, // blue diamond
  ];

  // Fixed accent pixels, spread across the board so the palette reads as full.
  const ACCENTS: [number, number, number][] = [
    [10, 14, 5],
    [44, 22, 9],
    [86, 44, 7],
    [112, 52, 13],
    [140, 78, 6],
    [40, 112, 9],
    [78, 116, 7],
    [100, 104, 14],
    [132, 112, 8],
    [162, 118, 10],
    [184, 20, 5],
    [14, 74, 8],
    [96, 80, 7],
    [150, 100, 6],
    [180, 74, 11],
    [62, 40, 15],
  ];

  type Pixel = { x: number; y: number; c: number };

  function buildArt(): Pixel[] {
    const out: Pixel[] = [];
    for (const s of SPRITES) {
      s.rows.forEach((row, r) => {
        for (let col = 0; col < row.length; col++) {
          const ch = row[col];
          if (ch === ".") continue;
          out.push({ x: s.x + col, y: s.y + r, c: s.map[ch] });
        }
      });
    }
    for (const [x, y, c] of ACCENTS) out.push({ x, y, c });
    // Diagonal sweep reveal: sort by x+y with a touch of jitter so it feels hand-drawn.
    return out.sort((a, b) => a.x + a.y - (b.x + b.y) + (Math.random() - 0.5) * 6);
  }

  function draw(ctx: CanvasRenderingContext2D, pixels: Pixel[], count: number, blinkOn: boolean) {
    const W = BOARD_W * SCALE;
    const H = BOARD_H * SCALE;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, W, H);
    // Faint guide grid every 4 cells so the surface reads as a pixel canvas.
    ctx.strokeStyle = "rgba(0,0,0,0.06)";
    ctx.lineWidth = 1;
    for (let x = 0; x <= BOARD_W; x += 4) {
      ctx.beginPath();
      ctx.moveTo(x * SCALE + 0.5, 0);
      ctx.lineTo(x * SCALE + 0.5, H);
      ctx.stroke();
    }
    for (let y = 0; y <= BOARD_H; y += 4) {
      ctx.beginPath();
      ctx.moveTo(0, y * SCALE + 0.5);
      ctx.lineTo(W, y * SCALE + 0.5);
      ctx.stroke();
    }
    for (let i = 0; i < count; i++) {
      const p = pixels[i];
      ctx.fillStyle = PALETTE[p.c];
      ctx.fillRect(p.x * SCALE, p.y * SCALE, SCALE, SCALE);
    }
    // Blinking cursor on the next cell → suggests a live painter at work.
    if (count < pixels.length && blinkOn) {
      const p = pixels[count];
      ctx.fillStyle = "rgba(23,23,23,0.3)";
      ctx.fillRect(p.x * SCALE, p.y * SCALE, SCALE, SCALE);
    }
  }

  onMount(() => {
    const el = canvasEl;
    const ctx = el?.getContext("2d");
    if (!el || !ctx) return;
    el.width = BOARD_W * SCALE;
    el.height = BOARD_H * SCALE;
    ctx.imageSmoothingEnabled = false;

    const pixels = buildArt();
    const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

    if (reduceMotion) {
      draw(ctx, pixels, pixels.length, false);
      return;
    }

    const REVEAL_MS = 2200;
    const start = performance.now();
    let raf = 0;
    const loop = (now: number) => {
      const t = now - start;
      const progress = Math.min(1, t / REVEAL_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      const count = Math.floor(eased * pixels.length);
      draw(ctx, pixels, count, Math.floor(t / 450) % 2 === 0);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    // Gentle presence flicker so "N online" feels live, not pasted on.
    const id = setInterval(() => {
      online = 10 + Math.floor(Math.random() * 6);
    }, 2600);

    return () => {
      cancelAnimationFrame(raf);
      clearInterval(id);
    };
  });

  // Decorative room pins on the mock map (percent positions, palette colors).
  const PINS = [
    { top: 22, left: 18, c: PALETTE[5], label: "Riverside Park" },
    { top: 38, left: 74, c: PALETTE[10], label: null },
    { top: 64, left: 30, c: PALETTE[8], label: "Campus North" },
    { top: 72, left: 82, c: PALETTE[6], label: null },
    { top: 16, left: 58, c: PALETTE[7], label: null },
    { top: 84, left: 54, c: PALETTE[14], label: null },
    { top: 50, left: 46, c: PALETTE[11], label: null },
  ];

  // How-it-works cards. Each carries a clay accent + a lucide icon component.
  const FEATURES = [
    {
      key: "map",
      title: "Pick a place",
      body: "Open the map and tap any spot. Every place on earth can host its own shared board — glowing pins show where people are painting right now.",
      color: "var(--clay-blue)",
      icon: MapPin,
    },
    {
      key: "nearby",
      title: "Paint nearby",
      body: `Anyone can watch. Painting unlocks only when you're physically within ${WRITE_RADIUS_M}m of the spot, so every canvas stays truly local.`,
      color: "var(--clay-green)",
      icon: Radar,
    },
    {
      key: "live",
      title: "Watch it live",
      body: `A shared ${BOARD_W}×${BOARD_H} grid and a fixed ${PALETTE.length}-color palette. Watch pixels land in real time as the people around you draw together.`,
      color: "var(--clay-yellow)",
      icon: Radio,
    },
    {
      key: "privacy",
      title: "Privacy by design",
      body: "Your precise coordinates are used only for the proximity check, then discarded. They're never stored, logged, or shown to anyone.",
      color: "var(--clay-purple)",
      icon: ShieldCheck,
    },
  ];

  const USECASES = [
    "Local murals",
    "Campus games",
    "Festival walls",
    "Neighborhood notes",
    "Pop-up exhibitions",
    "Event souvenirs",
  ];
</script>

<div class="landing">
  <header class="lp-bar">
    <div class="brand">
      <span class="logo-glyph" aria-hidden="true">
        <svg viewBox="0 0 8 8" width="22" height="22" shape-rendering="crispEdges">
          <rect width="8" height="8" fill="#171717" rx="1.5" />
          <rect x="1" y="1" width="2" height="2" fill={PALETTE[5]} />
          <rect x="5" y="1" width="2" height="2" fill={PALETTE[7]} />
          <rect x="1" y="5" width="2" height="2" fill={PALETTE[8]} />
          <rect x="5" y="5" width="2" height="2" fill={PALETTE[10]} />
          <rect x="3" y="3" width="2" height="2" fill={PALETTE[14]} />
        </svg>
      </span>
      <span class="brand-name">Geo Pixel Board</span>
    </div>
    <button class="btn btn-sm" onclick={() => onenter("explore")}>Explore rooms</button>
  </header>

  <section class="hero">
    <div class="hero-copy">
      <span class="eyebrow"><span class="dot"></span> Live boards in your city</span>
      <h1>Turn real places into <span class="hl">pixel canvases</span></h1>
      <p class="sub">
        Open the map, find a place near you, and paint together with everyone standing
        around the same spot. One living canvas per location.
      </p>
      <div class="cta">
        <button class="btn-primary" onclick={() => onenter("paint")}>Start painting</button>
        <button class="btn-ghost" onclick={() => onenter("explore")}>Explore rooms</button>
      </div>
      <ul class="hero-facts">
        <li><b>{BOARD_W}×{BOARD_H}</b> board</li>
        <li><b>{PALETTE.length}</b> colors</li>
        <li><b>{WRITE_RADIUS_M}m</b> write radius</li>
      </ul>
    </div>

    <div class="hero-mock">
      <span class="float-badge fb-rooms" aria-hidden="true"><span class="fb-dot"></span> Live rooms</span>
      <span class="float-badge fb-colors" aria-hidden="true"><PaletteIcon size={14} strokeWidth={2.6} /> {PALETTE.length} colors</span>
      <span class="float-badge fb-radius" aria-hidden="true"><MapPin size={14} strokeWidth={2.6} /> {WRITE_RADIUS_M}m to paint</span>

      <div class="mini-map" aria-hidden="true">
        {#each PINS as pin (pin.top + "-" + pin.left)}
          <span class="pin" style:top="{pin.top}%" style:left="{pin.left}%" style:--pin={pin.c}>
            {#if pin.label}<span class="pin-label">{pin.label}</span>{/if}
          </span>
        {/each}

        <div class="board-card">
          <div class="bc-head">
            <span class="bc-title"><span class="bc-live"></span> Riverside Park</span>
            <span class="bc-online"><Users size={13} strokeWidth={2.6} /> {online}</span>
          </div>
          <div class="bc-canvas-wrap">
            <canvas bind:this={canvasEl} class="bc-canvas"></canvas>
          </div>
          <div class="bc-palette">
            {#each PALETTE as color, i (i)}
              <span class="bc-swatch" class:sel={i === 5} style:background={color}></span>
            {/each}
          </div>
          <div class="bc-foot">
            <span class="tag ok">● Nearby painting on</span>
            <span class="tag">{WRITE_RADIUS_M}m radius</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="features" id="how">
    <h2 class="section-title">How it works</h2>
    <div class="cards">
      {#each FEATURES as f (f.key)}
        {@const Icon = f.icon}
        <article class="card">
          <span class="card-icon" style:--accent={f.color} aria-hidden="true">
            <Icon size={26} strokeWidth={2.4} />
          </span>
          <h3>{f.title}</h3>
          <p>{f.body}</p>
        </article>
      {/each}
    </div>
  </section>

  <section class="usecases">
    <h2 class="section-title">One canvas per place</h2>
    <p class="usecases-sub">A board becomes whatever the people standing there make of it.</p>
    <ul class="chips">
      {#each USECASES as u (u)}
        <li>{u}</li>
      {/each}
    </ul>
  </section>

  <section class="cta-bottom">
    <div class="cta-card">
      <h2>Find a place. Start painting.</h2>
      <p>Viewing is open to everyone — grab a color when you're nearby.</p>
      <div class="cta">
        <button class="btn-primary" onclick={() => onenter("paint")}>Start painting</button>
        <button class="btn-ghost" onclick={() => onenter("explore")}>Explore rooms</button>
      </div>
    </div>
  </section>

  <footer class="lp-footer">
    <span class="ft-brand">Geo Pixel Board</span>
    <span class="muted">Location is used only to check if you're close enough to paint — never stored or shown.</span>
  </footer>
</div>

<style>
  /* Clay tokens are scoped to the landing only, so the rest of the (dark) app
     — VerifyGate, RoomPanel, MapView — keeps its own theme untouched. */
  .landing {
    --cream: #fff7e8;
    --cream-2: #fff4dc;
    --ink: #171717;
    --muted: #5f5a50;
    --clay-blue: #4f8cff;
    --clay-yellow: #ffcd75;
    --clay-green: #3ddc84;
    --clay-red: #ef5d6b;
    --clay-purple: #b86bff;
    --clay-radius: 16px;
    --clay-shadow: 6px 6px 0 var(--ink);
    --clay-shadow-sm: 4px 4px 0 var(--ink);

    position: absolute;
    inset: 0;
    z-index: 50;
    overflow-x: hidden;
    overflow-y: auto;
    background-color: var(--cream);
    /* Faint dot grid → reads as "map paper" without stealing attention. */
    background-image: radial-gradient(rgba(23, 23, 23, 0.05) 1.4px, transparent 1.4px);
    background-size: 22px 22px;
    color: var(--ink);
    scroll-behavior: smooth;
    scroll-padding-top: 84px;
    font-weight: 500;
  }

  /* ---- top bar ---- */
  .lp-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 14px clamp(16px, 4vw, 48px);
    position: sticky;
    top: 0;
    z-index: 5;
    background: var(--cream);
    border-bottom: 2px solid var(--ink);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    font-weight: 800;
    font-size: 17px;
    letter-spacing: -0.3px;
  }
  .logo-glyph {
    display: inline-flex;
    padding: 4px;
    background: var(--cream-2);
    border: 2px solid var(--ink);
    border-radius: 10px;
    box-shadow: var(--clay-shadow-sm);
  }
  .btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    border: 2px solid var(--ink);
    background: #fff;
    color: var(--ink);
    font-weight: 700;
    border-radius: 999px;
    box-shadow: var(--clay-shadow-sm);
    transition: transform 0.1s ease, box-shadow 0.1s ease;
  }
  .btn-sm {
    padding: 8px 16px;
    font-size: 14px;
  }
  .btn:hover {
    transform: translate(-1px, -1px);
    box-shadow: 5px 5px 0 var(--ink);
  }
  .btn:active {
    transform: translate(2px, 2px);
    box-shadow: 1px 1px 0 var(--ink);
  }

  /* ---- hero ---- */
  .hero {
    display: grid;
    grid-template-columns: 1.02fr 1fr;
    gap: clamp(28px, 5vw, 68px);
    align-items: center;
    padding: clamp(28px, 5vw, 64px) clamp(16px, 4vw, 48px) 32px;
    max-width: 1240px;
    margin: 0 auto;
    min-height: 74vh;
  }
  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 12.5px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--ink);
    background: var(--clay-yellow);
    border: 2px solid var(--ink);
    border-radius: 999px;
    padding: 6px 14px;
    box-shadow: var(--clay-shadow-sm);
    margin-bottom: 22px;
  }
  .eyebrow .dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--clay-green);
    border: 1.5px solid var(--ink);
    animation: pulse 2s ease-in-out infinite;
  }
  h1 {
    font-size: clamp(36px, 5.6vw, 64px);
    line-height: 1.02;
    margin: 0 0 18px;
    letter-spacing: -1.5px;
    font-weight: 900;
  }
  .hl {
    position: relative;
    white-space: nowrap;
    background: var(--clay-blue);
    color: #fff;
    padding: 0 10px;
    border: 2px solid var(--ink);
    border-radius: 12px;
    box-shadow: var(--clay-shadow-sm);
    display: inline-block;
    transform: rotate(-1.5deg);
  }
  .sub {
    font-size: clamp(15px, 1.6vw, 19px);
    color: var(--muted);
    max-width: 30em;
    line-height: 1.55;
    margin: 6px 0 28px;
    font-weight: 500;
  }
  .cta {
    display: flex;
    flex-wrap: wrap;
    gap: 14px;
  }
  .btn-primary,
  .btn-ghost {
    border-radius: 999px;
    padding: 14px 26px;
    font-size: 15.5px;
    font-weight: 800;
    border: 2.5px solid var(--ink);
    box-shadow: var(--clay-shadow);
    transition: transform 0.1s ease, box-shadow 0.1s ease;
  }
  .btn-primary {
    background: var(--clay-green);
    color: var(--ink);
  }
  .btn-ghost {
    background: #fff;
    color: var(--ink);
  }
  .btn-primary:hover,
  .btn-ghost:hover {
    transform: translate(-2px, -2px);
    box-shadow: 8px 8px 0 var(--ink);
  }
  .btn-primary:active,
  .btn-ghost:active {
    transform: translate(3px, 3px);
    box-shadow: 2px 2px 0 var(--ink);
  }
  .hero-facts {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
    padding: 0;
    margin: 30px 0 0;
    font-size: 13px;
    color: var(--ink);
  }
  .hero-facts li {
    background: var(--cream-2);
    border: 2px solid var(--ink);
    border-radius: 999px;
    padding: 6px 14px;
    font-weight: 600;
  }
  .hero-facts b {
    font-weight: 900;
  }

  /* ---- hero mock: map paper + floating board card ---- */
  .hero-mock {
    position: relative;
  }
  .float-badge {
    position: absolute;
    z-index: 3;
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    font-weight: 800;
    color: var(--ink);
    border: 2px solid var(--ink);
    border-radius: 999px;
    padding: 7px 13px;
    box-shadow: var(--clay-shadow-sm);
    white-space: nowrap;
  }
  .fb-rooms {
    top: -14px;
    left: 18px;
    background: var(--clay-green);
    transform: rotate(-3deg);
  }
  .fb-colors {
    top: 26px;
    right: -10px;
    background: var(--clay-yellow);
    transform: rotate(3deg);
    animation: bob 3.4s ease-in-out infinite;
  }
  .fb-radius {
    bottom: -14px;
    left: 24px;
    background: var(--clay-purple);
    color: #fff;
    transform: rotate(2deg);
  }
  .fb-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #fff;
    border: 1.5px solid var(--ink);
    animation: pulse 1.8s ease-in-out infinite;
  }
  .mini-map {
    position: relative;
    aspect-ratio: 4 / 3;
    border-radius: var(--clay-radius);
    border: 3px solid var(--ink);
    overflow: hidden;
    background-color: #eaf3ea;
    /* Streets + parks pattern, kept soft so the board card stays the focus. */
    background-image:
      linear-gradient(rgba(23, 23, 23, 0.07) 2px, transparent 2px),
      linear-gradient(90deg, rgba(23, 23, 23, 0.07) 2px, transparent 2px),
      radial-gradient(130px 90px at 22% 72%, rgba(61, 220, 132, 0.28), transparent 70%),
      radial-gradient(170px 100px at 80% 26%, rgba(79, 140, 255, 0.22), transparent 70%);
    background-size: 30px 30px, 30px 30px, 100% 100%, 100% 100%;
    box-shadow: var(--clay-shadow);
  }
  .pin {
    position: absolute;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--pin);
    border: 2.5px solid var(--ink);
    transform: translate(-50%, -50%);
    box-shadow: 0 0 0 0 var(--pin);
    animation: ping 2.6s ease-out infinite;
  }
  .pin-label {
    position: absolute;
    left: 16px;
    top: -5px;
    white-space: nowrap;
    font-size: 10px;
    font-weight: 700;
    color: var(--ink);
    background: #fff;
    border: 2px solid var(--ink);
    border-radius: 6px;
    padding: 2px 6px;
  }
  .board-card {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(82%, 366px);
    background: #fff;
    border: 3px solid var(--ink);
    border-radius: var(--clay-radius);
    box-shadow: var(--clay-shadow);
    padding: 11px;
  }
  .bc-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 9px;
    font-size: 12.5px;
  }
  .bc-title {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-weight: 800;
  }
  .bc-live {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--clay-green);
    border: 1.5px solid var(--ink);
    animation: pulse 1.6s ease-in-out infinite;
  }
  .bc-online {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
  }
  .bc-canvas-wrap {
    border-radius: 9px;
    overflow: hidden;
    border: 2.5px solid var(--ink);
    line-height: 0;
  }
  .bc-canvas {
    width: 100%;
    height: auto;
    display: block;
    image-rendering: pixelated;
    background: #fff;
  }
  .bc-palette {
    display: grid;
    grid-template-columns: repeat(16, 1fr);
    gap: 3px;
    margin: 9px 0;
  }
  .bc-swatch {
    aspect-ratio: 1;
    border-radius: 3px;
    box-shadow: inset 0 0 0 1px rgba(23, 23, 23, 0.35);
  }
  .bc-swatch.sel {
    outline: 2.5px solid var(--ink);
    outline-offset: 1px;
    border-radius: 4px;
  }
  .bc-foot {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .tag {
    font-size: 10.5px;
    font-weight: 700;
    color: var(--ink);
    background: var(--cream-2);
    border: 2px solid var(--ink);
    border-radius: 999px;
    padding: 3px 9px;
  }
  .tag.ok {
    background: var(--clay-green);
  }

  /* ---- shared section heading ---- */
  .section-title {
    font-size: clamp(24px, 3.6vw, 36px);
    font-weight: 900;
    letter-spacing: -0.8px;
    text-align: center;
    margin: 0 0 28px;
  }

  /* ---- features ---- */
  .features {
    max-width: 1120px;
    margin: 0 auto;
    padding: clamp(36px, 6vw, 64px) clamp(16px, 4vw, 48px) 24px;
  }
  .cards {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 18px;
  }
  .card {
    background: #fff;
    border: 2.5px solid var(--ink);
    border-radius: var(--clay-radius);
    padding: 24px;
    box-shadow: var(--clay-shadow);
    transition: transform 0.12s ease, box-shadow 0.12s ease;
  }
  .card:hover {
    transform: translate(-2px, -2px);
    box-shadow: 8px 8px 0 var(--ink);
  }
  .card-icon {
    display: inline-flex;
    color: var(--ink);
    background: var(--accent);
    border: 2.5px solid var(--ink);
    border-radius: 13px;
    padding: 11px;
    margin-bottom: 16px;
    box-shadow: var(--clay-shadow-sm);
  }
  .card h3 {
    margin: 0 0 9px;
    font-size: 18px;
    font-weight: 800;
    letter-spacing: -0.3px;
  }
  .card p {
    margin: 0;
    color: var(--muted);
    font-size: 14px;
    line-height: 1.55;
    font-weight: 500;
  }

  /* ---- use cases ---- */
  .usecases {
    text-align: center;
    padding: clamp(28px, 5vw, 48px) clamp(16px, 4vw, 48px) 16px;
    max-width: 880px;
    margin: 0 auto;
  }
  .usecases .section-title {
    margin-bottom: 10px;
  }
  .usecases-sub {
    color: var(--muted);
    margin: 0 0 24px;
    font-weight: 500;
  }
  .chips {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 11px;
    padding: 0;
    margin: 0;
  }
  .chips li {
    border: 2.5px solid var(--ink);
    background: #fff;
    border-radius: 999px;
    padding: 9px 18px;
    font-size: 14px;
    font-weight: 700;
    box-shadow: var(--clay-shadow-sm);
  }
  .chips li:nth-child(3n + 1) {
    background: var(--clay-yellow);
  }
  .chips li:nth-child(3n + 2) {
    background: #fff;
  }
  .chips li:nth-child(3n) {
    background: var(--clay-green);
  }

  /* ---- bottom CTA + footer ---- */
  .cta-bottom {
    padding: clamp(40px, 6vw, 72px) clamp(16px, 4vw, 48px);
    max-width: 960px;
    margin: 0 auto;
  }
  .cta-card {
    text-align: center;
    background: var(--clay-blue);
    border: 3px solid var(--ink);
    border-radius: 24px;
    box-shadow: var(--clay-shadow);
    padding: clamp(32px, 5vw, 56px) clamp(20px, 4vw, 48px);
    color: #fff;
  }
  .cta-card h2 {
    font-size: clamp(26px, 4vw, 42px);
    font-weight: 900;
    letter-spacing: -0.8px;
    margin: 0 0 10px;
  }
  .cta-card p {
    margin: 0 0 24px;
    font-weight: 600;
    opacity: 0.92;
  }
  .cta-card .cta {
    justify-content: center;
  }
  .lp-footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
    text-align: center;
    padding: 32px 24px 52px;
    border-top: 2px solid var(--ink);
    font-size: 13px;
  }
  .ft-brand {
    font-weight: 800;
  }
  .lp-footer .muted {
    color: var(--muted);
    max-width: 38em;
    font-weight: 500;
  }

  /* ---- keyframes ---- */
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.4;
    }
  }
  @keyframes ping {
    0% {
      box-shadow: 0 0 0 0 var(--pin);
      opacity: 1;
    }
    70% {
      box-shadow: 0 0 0 9px transparent;
      opacity: 0.9;
    }
    100% {
      box-shadow: 0 0 0 0 transparent;
      opacity: 1;
    }
  }
  @keyframes bob {
    0%,
    100% {
      transform: rotate(3deg) translateY(0);
    }
    50% {
      transform: rotate(3deg) translateY(-5px);
    }
  }

  /* ---- responsive ---- */
  @media (max-width: 860px) {
    .hero {
      grid-template-columns: 1fr;
      min-height: auto;
      padding-top: clamp(24px, 8vw, 40px);
    }
    .hero-mock {
      order: 2;
      margin: 8px 6px 0;
    }
    .btn-primary,
    .btn-ghost {
      flex: 1 1 auto;
    }
    .fb-colors {
      right: 0;
    }
  }

  @media (max-width: 420px) {
    h1 {
      font-size: clamp(30px, 9vw, 40px);
    }
    .hl {
      white-space: normal;
    }
    .float-badge {
      font-size: 11px;
      padding: 6px 10px;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .eyebrow .dot,
    .bc-live,
    .fb-dot,
    .fb-colors,
    .pin {
      animation: none;
    }
  }
</style>
