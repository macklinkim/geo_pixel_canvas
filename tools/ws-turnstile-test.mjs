// WS write-path human-verification test (no cookie -> token required).
const ROOM = "wydm9k95";
const C = { lat: 37.554616928100586, lng: 126.97053909301758 };
const FAR = { lat: 35.1, lng: 129.0 };
const ws = new WebSocket(`ws://localhost:5173/ws/${ROOM}`);
const log = [];
let step = 0;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

ws.onopen = () => ws.send(JSON.stringify({ t: "join", lat: C.lat, lng: C.lng, acc: 8 }));

ws.onmessage = async (e) => {
  const m = JSON.parse(e.data);
  if (m.t === "snapshot") {
    // 1) in-range paint, NO token -> expect human_required
    ws.send(JSON.stringify({ t: "paint", x: 1, y: 1, color: 5, lat: C.lat, lng: C.lng, acc: 8 }));
  } else if (m.t === "ack") {
    log.push(`ack ok=${m.ok} reason=${m.reason ?? "-"}`);
    step++;
    await sleep(150);
    if (step === 1) {
      // 2) in-range paint WITH token -> expect ok (test secret passes)
      ws.send(JSON.stringify({ t: "paint", x: 2, y: 2, color: 5, lat: C.lat, lng: C.lng, acc: 8, token: "dummy" }));
    } else if (step === 2) {
      // 3) far paint, no token -> expect out_of_range (location gate first)
      ws.send(JSON.stringify({ t: "paint", x: 3, y: 3, color: 5, lat: FAR.lat, lng: FAR.lng, acc: 8 }));
    } else {
      console.log(log.join("\n"));
      try { ws.close(); } catch {}
      process.exit(0);
    }
  }
};
setTimeout(() => { console.log(log.join("\n")); process.exit(0); }, 6000);
