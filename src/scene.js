const Li = getStoredLilyCount(),
  Yl = Array.from({ length: Li }, (i, t) => {
    const e = t * 2.39996 + 0.6,
      n = 5 + t * 2.4,
      r = Math.sin(e) * n,
      s = -8 - Math.cos(e) * n * 1.15;
    return new D(r, nn(r, s), s);
  }),
  tl = 2.1;
function lg() {
