// Smoke test: connect two clients to a room, join, paint, verify broadcast.
// Node 22 has a global WebSocket.
const ROOM = "wydm9k95";
const CENTER = { lat: 37.554616928100586, lng: 126.97053909301758 };
const URL = `ws://localhost:5173/ws/${ROOM}`;

function client(name) {
  return new Promise((resolve) => {
    const log = [];
    const ws = new WebSocket(URL);
    ws.onopen = () => {
      log.push(`${name} open`);
      ws.send(JSON.stringify({ t: "join", lat: CENTER.lat, lng: CENTER.lng, acc: 10 }));
    };
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.t === "snapshot") {
        log.push(`${name} snapshot canWrite=${m.canWrite} online=${m.online} bytes=${m.pixels.length}`);
        if (name === "A") {
          ws.send(JSON.stringify({ t: "paint", x: 5, y: 7, color: 3, lat: CENTER.lat, lng: CENTER.lng, acc: 10 }));
        }
      } else if (m.t === "ack") {
        log.push(`${name} ack ok=${m.ok} reason=${m.reason ?? "-"} cd=${m.cooldownMs ?? "-"}`);
      } else if (m.t === "pixel") {
        log.push(`${name} pixel x=${m.x} y=${m.y} color=${m.color}`);
      } else if (m.t === "presence") {
        log.push(`${name} presence online=${m.online}`);
      }
    };
    ws.onerror = () => log.push(`${name} error`);
    setTimeout(() => { try { ws.close(); } catch {} resolve(log); }, 2500);
  });
}

// Also test the gate rejection: paint from far away / bad accuracy.
function gateReject() {
  return new Promise((resolve) => {
    const log = [];
    const ws = new WebSocket(URL);
    ws.onopen = () => ws.send(JSON.stringify({ t: "join", lat: CENTER.lat, lng: CENTER.lng, acc: 10 }));
    ws.onmessage = (e) => {
      const m = JSON.parse(e.data);
      if (m.t === "snapshot") {
        // far away paint -> out_of_range
        ws.send(JSON.stringify({ t: "paint", x: 1, y: 1, color: 1, lat: 35.0, lng: 129.0, acc: 10 }));
        // low accuracy paint -> low_accuracy
        ws.send(JSON.stringify({ t: "paint", x: 2, y: 2, color: 1, lat: CENTER.lat, lng: CENTER.lng, acc: 500 }));
      } else if (m.t === "ack" && !m.ok) {
        log.push(`reject reason=${m.reason}`);
      }
    };
    setTimeout(() => { try { ws.close(); } catch {} resolve(log); }, 2000);
  });
}

const [a, b] = await Promise.all([client("A"), client("B")]);
const rej = await gateReject();
console.log([...a, "---", ...b, "---", ...rej].join("\n"));
process.exit(0);
