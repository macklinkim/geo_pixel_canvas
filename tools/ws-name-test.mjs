// Paint once in wydm9k7s (a null-named seed) to trigger reverse-geocode backfill.
const ROOM = "wydm9k7s";
const C = { lat: 37.553415298461914, lng: 126.97397232055664 };
const ws = new WebSocket(`ws://localhost:5174/ws/${ROOM}`);
ws.onopen = () => ws.send(JSON.stringify({ t: "join", lat: C.lat, lng: C.lng, acc: 8 }));
ws.onmessage = (e) => {
  const m = JSON.parse(e.data);
  if (m.t === "snapshot") {
    ws.send(JSON.stringify({ t: "paint", x: 10, y: 10, color: 9, lat: C.lat, lng: C.lng, acc: 8 }));
  } else if (m.t === "ack") {
    console.log("ack", JSON.stringify(m));
  }
};
setTimeout(() => { try { ws.close(); } catch {} process.exit(0); }, 4000);
