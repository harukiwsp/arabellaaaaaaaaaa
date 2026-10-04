import QRCode from 'qrcode'
import './qr.css'

const St = document.getElementById("qr"),
  M = St.getContext("2d"),
  Mt = document.getElementById("url"),
  ae = document.getElementById("caption");
Mt.value = `${location.origin}/`;
const v = St.width,
  Rt = "#0b1a3a";
function At(r, i, o) {
  M.beginPath();
  for (let e = 0; e <= 360; e++) {
    const t = (e / 360) * Math.PI * 2,
      n = 16 * Math.sin(t) ** 3,
      s =
        13 * Math.cos(t) -
        5 * Math.cos(2 * t) -
        2 * Math.cos(3 * t) -
        Math.cos(4 * t),
      a = o / 34;
    e ? M.lineTo(r + n * a, i - s * a) : M.moveTo(r + n * a, i - s * a);
  }
  M.closePath();
}
function K(r, i, o, e, t) {
  (M.beginPath(), M.roundRect(r, i, o, e, t));
}
function Bt(r, i, o) {
  ((M.fillStyle = Rt),
    K(r, i, 7 * o, 7 * o, o * 1.6),
    M.fill(),
    (M.fillStyle = "#fff"),
    K(r + o, i + o, 5 * o, 5 * o, o * 1.1),
    M.fill(),
    (M.fillStyle = Rt),
    K(r + 2 * o, i + 2 * o, 3 * o, 3 * o, o * 0.8),
    M.fill());
}
function _e(r, i, o) {
  const e = o * 4.2;
  ((M.fillStyle = "#ffffff"),
    K(r - e / 2 - o * 0.3, i - e / 2 - o * 0.3, e + o * 0.6, e + o * 0.6, o),
    M.fill(),
    At(r, i, e),
    (M.fillStyle = "#f05aa0"),
    M.fill());
}
function G() {
  const r = Mt.value.trim() || location.origin,
    i = QRCode.create(r, { errorCorrectionLevel: "H" }),
    o = i.modules.size;
  M.clearRect(0, 0, v, v);
  const e = v / 2,
    t = v * 0.47,
    n = v * 0.92;
  At(e, t, n);
  const s = M.createLinearGradient(0, 0, v, v);
  (s.addColorStop(0, "#ffd6ea"),
    s.addColorStop(0.55, "#ffc0dc"),
    s.addColorStop(1, "#c9d6ff"),
    (M.fillStyle = s),
    (M.shadowColor = "rgba(255, 120, 190, 0.55)"),
    (M.shadowBlur = 60),
    M.fill(),
    (M.shadowBlur = 0),
    (M.lineWidth = 10),
    (M.strokeStyle = "#f05aa0"),
    M.stroke());
  const a = 3,
    u = v * 0.335,
    c = u / (o + a * 2),
    l = e - u / 2,
    m = t + v * 0.049 - u / 2;
  (M.save(),
    At(e, t, n * 0.94),
    M.clip(),
    (M.fillStyle = "rgba(240, 90, 160, 0.28)"));
  let w = 7;
  const f = () => (w = (w * 16807) % 2147483647) / 2147483647;
  for (let d = 0; d < v; d += c)
    for (let y = 0; y < v; y += c)
      (y > l - c * 1.5 &&
        y < l + u + c * 0.5 &&
        d > m - c * 1.5 &&
        d < m + u + c * 0.5) ||
        (f() < 0.42 &&
          (M.beginPath(),
          M.arc(y + c / 2, d + c / 2, c * 0.36, 0, Math.PI * 2),
          M.fill()));
  (M.restore(),
    (M.fillStyle = "#ffffff"),
    (M.shadowColor = "rgba(11, 26, 58, 0.25)"),
    (M.shadowBlur = 24),
    K(l, m, u, u, c * 2.4),
    M.fill(),
    (M.shadowBlur = 0));
  const A = l + a * c,
    P = m + a * c,
    b = (d, y) =>
      (d < 7 && y < 7) || (d < 7 && y >= o - 7) || (d >= o - 7 && y < 7);
  M.fillStyle = Rt;
  for (let d = 0; d < o; d++)
    for (let y = 0; y < o; y++)
      !i.modules.get(d, y) ||
        b(d, y) ||
        (K(
          A + y * c + c * 0.06,
          P + d * c + c * 0.06,
          c * 0.88,
          c * 0.88,
          c * 0.32,
        ),
        M.fill());
  (Bt(A, P, c),
    Bt(A + (o - 7) * c, P, c),
    Bt(A, P + (o - 7) * c, c),
    i.version < 7 && _e(e, m + u / 2, c),
    (M.fillStyle = "#7a1d4f"),
    (M.textAlign = "center"),
    (M.font = `${Math.round(v * 0.05)}px "Great Vibes", cursive`),
    M.fillText(ae.value, e, m + u + v * 0.075));
}
document.fonts.ready.then(G);
G();
Mt.addEventListener("input", G);
ae.addEventListener("input", G);
document.getElementById("download").addEventListener("click", () => {
  const r = document.createElement("a");
  ((r.download = "heart-qr.png"),
    (r.href = St.toDataURL("image/png")),
    r.click());
});
