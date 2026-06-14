<script lang="ts">
  import { onMount } from "svelte";
  import { PALETTE } from "@shared/palette";
  import { BOARD_W, BOARD_H, WRITE_RADIUS_M } from "@shared/constants";

  // First-run onboarding. `onenter` hands control back to the map; the intent
  // lets App decide whether to nudge the location flow ("paint") or just browse.
  let { onenter }: { onenter: (intent: "paint" | "explore") => void } = $props();

  let canvasEl = $state<HTMLCanvasElement | null>(null);
  let online = $state(12);

  // Each board cell is drawn SCALE×SCALE device pixels on the hero canvas.
  const SCALE = 6;

  // Tiny pixel sprites stamped onto the 96×64 board ('.' = empty cell). Glyphs
  // map to palette indices so the mock uses the exact production 16-color set.
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
    { x: 16, y: 30, map: { X: 2 }, rows: HEART }, // red heart
    { x: 150, y: 18, map: { Y: 4, K: 0 }, rows: SMILEY }, // yellow smiley
    { x: 60, y: 84, map: { G: 6, L: 5, T: 15 }, rows: TREE }, // green tree
    { x: 104, y: 16, map: { S: 4 }, rows: STAR }, // yellow star
    { x: 168, y: 96, map: { D: 11 }, rows: DIAMOND }, // cyan diamond
    { x: 120, y: 64, map: { X: 1 }, rows: HEART }, // purple heart
    { x: 24, y: 96, map: { G: 6, L: 5, T: 15 }, rows: TREE }, // second tree
    { x: 176, y: 50, map: { S: 3 }, rows: STAR }, // orange star
    { x: 36, y: 60, map: { D: 10 }, rows: DIAMOND }, // sky-blue diamond
  ];

  // Fixed accent pixels, spread across the board so the full palette appears.
  const ACCENTS: [number, number, number][] = [
    [10, 14, 10],
    [44, 22, 9],
    [86, 44, 7],
    [112, 52, 11],
    [140, 78, 5],
    [40, 112, 3],
    [78, 116, 4],
    [100, 104, 1],
    [132, 112, 6],
    [162, 118, 10],
    [184, 20, 2],
    [14, 74, 4],
    [96, 80, 7],
    [150, 100, 3],
    [180, 74, 5],
    [62, 40, 8],
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
      ctx.fillStyle = "rgba(17,19,26,0.28)";
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
    { top: 22, left: 18, c: PALETTE[7], label: "Riverside Park" },
    { top: 38, left: 74, c: PALETTE[3], label: null },
    { top: 64, left: 30, c: PALETTE[5], label: "Campus North" },
    { top: 72, left: 82, c: PALETTE[2], label: null },
    { top: 16, left: 58, c: PALETTE[4], label: null },
    { top: 84, left: 54, c: PALETTE[10], label: null },
    { top: 50, left: 46, c: PALETTE[1], label: null },
  ];

  const FEATURES = [
    {
      key: "map",
      title: "Live map rooms",
      body: "Every place on the map can host its own shared board. Glowing pins show where people are painting right now.",
    },
    {
      key: "nearby",
      title: "Nearby-only painting",
      body: "Viewing is open to everyone. Painting unlocks only when you're physically within 100m of the spot — so each canvas stays truly local.",
    },
    {
      key: "board",
      title: "Real-time pixel board",
      body: `A shared ${BOARD_W}×${BOARD_H} grid and a fixed 16-color palette. Watch pixels land live as the people around you draw together.`,
    },
    {
      key: "privacy",
      title: "Privacy-friendly location",
      body: "Your precise coordinates are used only for the proximity check, then discarded. They're never stored or shown publicly.",
    },
  ];

  const USECASES = [
    "Local murals",
    "Campus games",
    "Festival walls",
    "Neighborhood messages",
    "Pop-up exhibitions",
    "Event souvenirs",
  ];
</script>

<div class="landing">
  <header class="lp-bar">
    <div class="brand">
      <span class="logo-glyph" aria-hidden="true">
        <svg viewBox="0 0 8 8" width="20" height="20" shape-rendering="crispEdges">
          <rect width="8" height="8" fill="#11131a" rx="1.5" />
          <rect x="1" y="1" width="2" height="2" fill={PALETTE[2]} />
          <rect x="5" y="1" width="2" height="2" fill={PALETTE[4]} />
          <rect x="1" y="5" width="2" height="2" fill={PALETTE[6]} />
          <rect x="5" y="5" width="2" height="2" fill={PALETTE[10]} />
          <rect x="3" y="3" width="2" height="2" fill={PALETTE[11]} />
        </svg>
      </span>
      <span class="brand-name">Geo Pixel Board</span>
    </div>
    <button class="lp-skip" onclick={() => onenter("explore")}>Skip intro →</button>
  </header>

  <section class="hero">
    <div class="hero-copy">
      <span class="eyebrow"><span class="dot"></span> Live boards in your city</span>
      <h1>Turn real places into <span class="grad">pixel canvases</span></h1>
      <p class="sub">
        Open the map, find a place nearby, and paint with everyone standing around the
        same spot.
      </p>
      <div class="cta">
        <button class="btn-primary" onclick={() => onenter("paint")}>Start painting</button>
        <button class="btn-ghost" onclick={() => onenter("explore")}>Explore rooms</button>
      </div>
      <ul class="hero-facts">
        <li>{BOARD_W}×{BOARD_H} board</li>
        <li>16 colors</li>
        <li>{WRITE_RADIUS_M}m radius</li>
      </ul>
    </div>

    <div class="hero-mock">
      <div class="mini-map" aria-hidden="true">
        {#each PINS as pin (pin.top + "-" + pin.left)}
          <span class="pin" style:top="{pin.top}%" style:left="{pin.left}%" style:--pin={pin.c}>
            {#if pin.label}<span class="pin-label">{pin.label}</span>{/if}
          </span>
        {/each}

        <div class="board-modal">
          <div class="bm-head">
            <span class="bm-title">
              <span class="bm-live"></span> Riverside Park
            </span>
            <span class="bm-online">{online} online</span>
          </div>
          <div class="bm-canvas-wrap">
            <canvas bind:this={canvasEl} class="bm-canvas"></canvas>
          </div>
          <div class="bm-palette">
            {#each PALETTE as color, i (i)}
              <span class="bm-swatch" class:sel={i === 2} style:background={color}></span>
            {/each}
          </div>
          <div class="bm-foot">
            <span class="badge ok">● Nearby painting enabled</span>
            <span class="badge">{WRITE_RADIUS_M}m radius</span>
          </div>
        </div>
      </div>
    </div>
  </section>

  <a class="scroll-hint" href="#how">How it works ↓</a>

  <section class="features" id="how">
    {#each FEATURES as f (f.key)}
      <article class="card">
        <span class="card-icon" aria-hidden="true">
          {#if f.key === "map"}
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
              <path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
              <path d="M9 4v14M15 6v14" stroke="currentColor" stroke-width="1.6" />
              <circle cx="6" cy="11" r="1.4" fill={PALETTE[3]} />
              <circle cx="18" cy="13" r="1.4" fill={PALETTE[7]} />
            </svg>
          {:else if f.key === "nearby"}
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="1.4" opacity="0.4" />
              <circle cx="12" cy="12" r="5" stroke="currentColor" stroke-width="1.6" />
              <circle cx="12" cy="12" r="2" fill={PALETTE[5]} />
            </svg>
          {:else if f.key === "board"}
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none" shape-rendering="crispEdges">
              <rect x="3" y="3" width="18" height="18" rx="2" stroke="currentColor" stroke-width="1.6" />
              <rect x="6" y="6" width="3" height="3" fill={PALETTE[2]} />
              <rect x="11" y="6" width="3" height="3" fill={PALETTE[4]} />
              <rect x="6" y="11" width="3" height="3" fill={PALETTE[6]} />
              <rect x="11" y="11" width="3" height="3" fill={PALETTE[10]} />
            </svg>
          {:else}
            <svg viewBox="0 0 24 24" width="24" height="24" fill="none">
              <rect x="5" y="10" width="14" height="10" rx="2" stroke="currentColor" stroke-width="1.6" />
              <path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="currentColor" stroke-width="1.6" />
              <circle cx="12" cy="15" r="1.6" fill={PALETTE[11]} />
            </svg>
          {/if}
        </span>
        <h3>{f.title}</h3>
        <p>{f.body}</p>
      </article>
    {/each}
  </section>

  <section class="usecases">
    <h2>One canvas per place</h2>
    <p class="usecases-sub">
      A board is whatever the people standing there make of it.
    </p>
    <ul class="chips">
      {#each USECASES as u (u)}
        <li>{u}</li>
      {/each}
    </ul>
  </section>

  <section class="cta-bottom">
    <h2>Find a place. Start painting.</h2>
    <div class="cta">
      <button class="btn-primary" onclick={() => onenter("paint")}>Start painting</button>
      <button class="btn-ghost" onclick={() => onenter("explore")}>Explore rooms</button>
    </div>
  </section>

  <footer class="lp-footer">
    <span>Geo Pixel Board</span>
    <span class="muted">Location is used only to check if you're close enough to paint — never stored or shown.</span>
  </footer>
</div>

<style>
  .landing {
    position: absolute;
    inset: 0;
    z-index: 50;
    overflow-y: auto;
    background:
      radial-gradient(1200px 600px at 80% -10%, rgba(65, 166, 246, 0.08), transparent 60%),
      radial-gradient(900px 500px at 0% 100%, rgba(61, 220, 132, 0.07), transparent 55%),
      var(--bg);
    color: var(--text);
    scroll-behavior: smooth;
    /* Offset the sticky header when jumping to the #how anchor. */
    scroll-padding-top: 72px;
  }

  /* ---- top bar ---- */
  .lp-bar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 14px clamp(16px, 4vw, 48px);
    position: sticky;
    top: 0;
    z-index: 5;
    backdrop-filter: blur(8px);
    background: rgba(11, 13, 18, 0.6);
    border-bottom: 1px solid var(--border);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 9px;
    font-weight: 700;
    letter-spacing: 0.2px;
  }
  .logo-glyph {
    display: inline-flex;
  }
  .lp-skip {
    background: none;
    border: none;
    color: var(--text-dim);
    font-size: 13px;
    padding: 6px 8px;
  }
  .lp-skip:hover {
    color: var(--text);
  }

  /* ---- hero ---- */
  .hero {
    display: grid;
    grid-template-columns: 1.05fr 1fr;
    gap: clamp(24px, 5vw, 64px);
    align-items: center;
    padding: clamp(32px, 6vw, 72px) clamp(16px, 4vw, 48px) 24px;
    max-width: 1280px;
    margin: 0 auto;
    min-height: 78vh;
  }
  .eyebrow {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    color: var(--text-dim);
    text-transform: uppercase;
    letter-spacing: 1.2px;
    margin-bottom: 18px;
  }
  .eyebrow .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: var(--ok);
    box-shadow: 0 0 0 4px rgba(61, 220, 132, 0.2);
    animation: pulse 2s ease-in-out infinite;
  }
  h1 {
    font-size: clamp(34px, 5.4vw, 60px);
    line-height: 1.04;
    margin: 0 0 18px;
    letter-spacing: -1px;
    font-weight: 800;
  }
  .grad {
    background: linear-gradient(96deg, var(--ok), #73eff7 60%, #ffcd75);
    -webkit-background-clip: text;
    background-clip: text;
    color: transparent;
  }
  .sub {
    font-size: clamp(15px, 1.6vw, 19px);
    color: var(--text-dim);
    max-width: 30em;
    line-height: 1.55;
    margin: 0 0 28px;
  }
  .cta {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
  }
  .btn-primary,
  .btn-ghost {
    border-radius: var(--radius);
    padding: 13px 22px;
    font-size: 15px;
    font-weight: 700;
    border: 1px solid transparent;
    transition: transform 0.1s ease, background 0.12s ease, border-color 0.12s ease;
  }
  .btn-primary {
    background: linear-gradient(180deg, #4be39a, var(--ok));
    color: #06281a;
    box-shadow: 0 6px 20px rgba(61, 220, 132, 0.28);
  }
  .btn-primary:hover {
    transform: translateY(-1px);
  }
  .btn-ghost {
    background: var(--surface-2);
    border-color: var(--border);
    color: var(--text);
  }
  .btn-ghost:hover {
    background: #232838;
  }
  .hero-facts {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    gap: 18px;
    padding: 0;
    margin: 26px 0 0;
    font-size: 13px;
    color: var(--text-dim);
    font-family: ui-monospace, "SF Mono", "Cascadia Code", monospace;
  }
  .hero-facts li {
    display: flex;
    align-items: center;
  }
  .hero-facts li + li::before {
    content: "·";
    margin-right: 18px;
    color: var(--border);
  }

  /* ---- hero mock map + board modal ---- */
  .hero-mock {
    perspective: 1200px;
  }
  .mini-map {
    position: relative;
    aspect-ratio: 4 / 3;
    border-radius: 14px;
    border: 1px solid var(--border);
    overflow: hidden;
    background-color: #0e1116;
    background-image:
      linear-gradient(rgba(120, 140, 170, 0.06) 1px, transparent 1px),
      linear-gradient(90deg, rgba(120, 140, 170, 0.06) 1px, transparent 1px),
      radial-gradient(120px 80px at 22% 70%, rgba(56, 183, 100, 0.1), transparent 70%),
      radial-gradient(160px 90px at 78% 28%, rgba(65, 166, 246, 0.08), transparent 70%);
    background-size: 28px 28px, 28px 28px, 100% 100%, 100% 100%;
    box-shadow: var(--shadow);
  }
  .pin {
    position: absolute;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--pin);
    border: 2px solid #0e1116;
    transform: translate(-50%, -50%);
    box-shadow: 0 0 0 0 var(--pin);
    animation: ping 2.6s ease-out infinite;
  }
  .pin-label {
    position: absolute;
    left: 14px;
    top: -4px;
    white-space: nowrap;
    font-size: 10px;
    color: var(--text);
    background: rgba(11, 13, 18, 0.8);
    border: 1px solid var(--border);
    border-radius: 5px;
    padding: 2px 6px;
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  }
  .board-modal {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: min(80%, 360px);
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    box-shadow: var(--shadow);
    padding: 10px;
  }
  .bm-head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
    font-size: 12px;
  }
  .bm-title {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-weight: 600;
  }
  .bm-live {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    background: var(--ok);
    box-shadow: 0 0 6px var(--ok);
    animation: pulse 1.6s ease-in-out infinite;
  }
  .bm-online {
    color: var(--text-dim);
    font-family: ui-monospace, monospace;
    font-variant-numeric: tabular-nums;
  }
  .bm-canvas-wrap {
    border-radius: 5px;
    overflow: hidden;
    border: 1px solid var(--border);
    line-height: 0;
  }
  .bm-canvas {
    width: 100%;
    height: auto;
    display: block;
    image-rendering: pixelated;
    background: #fff;
  }
  .bm-palette {
    display: grid;
    grid-template-columns: repeat(16, 1fr);
    gap: 3px;
    margin: 8px 0;
  }
  .bm-swatch {
    aspect-ratio: 1;
    border-radius: 3px;
    box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.3);
  }
  .bm-swatch.sel {
    outline: 2px solid var(--text);
    outline-offset: 1px;
  }
  .bm-foot {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }
  .badge {
    font-size: 10.5px;
    color: var(--text-dim);
    border: 1px solid var(--border);
    border-radius: 999px;
    padding: 3px 8px;
  }
  .badge.ok {
    color: var(--ok);
    border-color: rgba(61, 220, 132, 0.4);
  }

  /* ---- scroll hint ---- */
  .scroll-hint {
    display: block;
    text-align: center;
    color: var(--text-dim);
    font-size: 13px;
    text-decoration: none;
    padding: 8px 0 36px;
    animation: bob 2.4s ease-in-out infinite;
  }
  .scroll-hint:hover {
    color: var(--text);
  }

  /* ---- features ---- */
  .features {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px;
    max-width: 1100px;
    margin: 0 auto;
    padding: 16px clamp(16px, 4vw, 48px) 40px;
  }
  .card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 22px;
    transition: border-color 0.15s ease, transform 0.15s ease;
  }
  .card:hover {
    border-color: #38415a;
    transform: translateY(-2px);
  }
  .card-icon {
    display: inline-flex;
    color: var(--text);
    background: var(--surface-2);
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 9px;
    margin-bottom: 14px;
  }
  .card h3 {
    margin: 0 0 8px;
    font-size: 17px;
  }
  .card p {
    margin: 0;
    color: var(--text-dim);
    font-size: 14px;
    line-height: 1.55;
  }

  /* ---- use cases ---- */
  .usecases {
    text-align: center;
    padding: 28px clamp(16px, 4vw, 48px) 16px;
    max-width: 900px;
    margin: 0 auto;
  }
  .usecases h2 {
    font-size: clamp(24px, 3.4vw, 34px);
    margin: 0 0 8px;
    letter-spacing: -0.5px;
  }
  .usecases-sub {
    color: var(--text-dim);
    margin: 0 0 22px;
  }
  .chips {
    list-style: none;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
    padding: 0;
    margin: 0;
  }
  .chips li {
    border: 1px solid var(--border);
    background: var(--surface);
    border-radius: 999px;
    padding: 8px 16px;
    font-size: 14px;
    color: var(--text);
  }

  /* ---- bottom CTA + footer ---- */
  .cta-bottom {
    text-align: center;
    padding: 56px clamp(16px, 4vw, 48px);
  }
  .cta-bottom h2 {
    font-size: clamp(26px, 4vw, 40px);
    margin: 0 0 22px;
    letter-spacing: -0.5px;
  }
  .cta-bottom .cta {
    justify-content: center;
  }
  .lp-footer {
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 6px;
    text-align: center;
    padding: 28px 24px 48px;
    border-top: 1px solid var(--border);
    font-size: 13px;
  }
  .lp-footer .muted {
    color: var(--text-dim);
    max-width: 38em;
  }

  /* ---- keyframes ---- */
  @keyframes pulse {
    0%,
    100% {
      opacity: 1;
    }
    50% {
      opacity: 0.45;
    }
  }
  @keyframes ping {
    0% {
      box-shadow: 0 0 0 0 var(--pin);
      opacity: 1;
    }
    70% {
      box-shadow: 0 0 0 10px transparent;
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
      transform: translateY(0);
    }
    50% {
      transform: translateY(4px);
    }
  }

  /* ---- responsive ---- */
  @media (max-width: 860px) {
    .hero {
      grid-template-columns: 1fr;
      min-height: auto;
      padding-top: clamp(24px, 8vw, 48px);
    }
    .hero-mock {
      order: 2;
    }
    .btn-primary,
    .btn-ghost {
      flex: 1 1 auto;
      text-align: center;
      justify-content: center;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .eyebrow .dot,
    .bm-live,
    .pin,
    .scroll-hint {
      animation: none;
    }
  }
</style>
