// 3D valley of lilies: terrain, flowers, aurora, fireflies, camera flights and lily picking.
// Ported from the original "Valley of Lilies" build; identifiers are compact but the
// public surface is `createValley(canvas, { onPick })` and `LILY_COUNT`.
import {
  Color as Ot,
  Vector3 as D,
  Vector2 as Et,
  Group as Vn,
  Mesh as ge,
  SphereGeometry as Vr,
  ShaderMaterial as ie,
  BackSide as we,
  DoubleSide as Ye,
  AdditiveBlending as Pn,
  BufferGeometry as Me,
  BufferAttribute as he,
  Float32BufferAttribute as ae,
  Points as kr,
  PlaneGeometry as Yn,
  Quaternion as Ze,
  InstancedMesh as wa,
  Matrix4 as $t,
  Euler as He,
  CanvasTexture as ym,
  CylinderGeometry as Ra,
  MeshBasicMaterial as ji,
  TextureLoader as Rm,
  WebGLRenderer as vm,
  LinearSRGBColorSpace as qn,
  Scene as xm,
  PerspectiveCamera as ze,
  Raycaster as Cm,
  Clock as Bl,
  MathUtils as Ur,
} from 'three'
import { OrbitControls as Lm } from 'three/examples/jsm/controls/OrbitControls.js'
import { EffectComposer as Zm } from 'three/examples/jsm/postprocessing/EffectComposer.js'
import { RenderPass as $m } from 'three/examples/jsm/postprocessing/RenderPass.js'
import { UnrealBloomPass as Ai } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js'
import { OutputPass as tg } from 'three/examples/jsm/postprocessing/OutputPass.js'

const Gl = `
float hash(vec2 p) { p = fract(p * vec2(123.34, 456.21)); p += dot(p, p + 45.32); return fract(p.x * p.y); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
`,
  Wr = `
uniform vec3 uFogColor;
uniform float uFogDensity;
vec3 applyFog(vec3 col, float dist) {
  float f = 1.0 - exp(-uFogDensity * uFogDensity * dist * dist);
  return mix(col, uFogColor, clamp(f, 0.0, 1.0));
}
`,
  ve = {
    uTime: { value: 0 },
    uFogColor: { value: new Ot(0.03, 0.07, 0.16) },
    uFogDensity: { value: 0.0085 },
    uLightDir: { value: new D(-0.38, 0.6, -0.7).normalize() },
    uPixelRatio: { value: 1 },
  };
function Qi(i) {
  let t = i >>> 0;
  return () => {
    t = (t + 1831565813) >>> 0;
    let e = t;
    return (
      (e = Math.imul(e ^ (e >>> 15), e | 1)),
      (e ^= e + Math.imul(e ^ (e >>> 7), e | 61)),
      ((e ^ (e >>> 14)) >>> 0) / 4294967296
    );
  };
}
const wr = (i, t, e) => {
    const n = Math.min(Math.max((e - i) / (t - i), 0), 1);
    return n * n * (3 - 2 * n);
  },
  eg = new D(-0.38, 0.42, -0.82).normalize();
function ng() {
  const i = new Vn(),
    t = new ge(
      new Vr(1500, 48, 32),
      new ie({
        side: we,
        depthWrite: !1,
        uniforms: { uTime: ve.uTime, uMoonDir: { value: eg } },
        vertexShader: `
        varying vec3 vDir;
        void main() {
          vDir = position;
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
        }`,
        fragmentShader: `
        uniform float uTime; uniform vec3 uMoonDir;
        varying vec3 vDir;
        ${Gl}

        vec3 aurora(vec3 d) {
          vec3 c = vec3(0.0);
          if (d.y < -0.02) return c;
          vec2 h = normalize(d.xz + 1e-5);
          float t = uTime * 0.045;
          for (int i = 0; i < 3; i++) {
            float fi = float(i);
            float base = 0.13 + 0.1 * fi
              + 0.07 * sin(h.x * 2.4 + h.y * 1.3 + t * 2.0 + fi * 1.7)
              + 0.06 * (fbm(h * 2.5 + vec2(fi * 5.0, t)) - 0.5);
            float y = d.y - base;
            float shape = smoothstep(-0.015, 0.025, y) * exp(-max(y, 0.0) * (5.5 + fi * 2.5));
            float rays = fbm(h * 22.0 + vec2(fi * 13.0 + sin(t + fi) * 1.5, t * 2.5));
            rays = 0.25 + 1.1 * rays * rays;
            float cover = smoothstep(0.3, 0.68, fbm(h * 1.6 + vec2(fi * 3.1 - t * 0.6, fi * 2.0 + t * 0.3)));
            vec3 low = vec3(0.12, 1.0, 0.62);
            vec3 high = mix(vec3(1.0, 0.36, 0.78), vec3(0.42, 0.52, 1.0), fi * 0.5);
            vec3 cc = mix(low, high, smoothstep(0.0, 0.16, y));
            c += cc * shape * rays * cover * (0.95 - fi * 0.22);
          }
          return c;
        }

        vec3 shootingStar(vec3 d) {
          float period = 6.5;
          float id = floor(uTime / period);
          float ph = mod(uTime, period);
          if (ph > 1.1) return vec3(0.0);
          float az = atan(d.x, -d.z);
          float el = asin(clamp(d.y, -1.0, 1.0));
          vec2 start = vec2(hash(vec2(id, 1.0)) * 2.4 - 1.2, 0.45 + hash(vec2(id, 2.0)) * 0.5);
          vec2 dir = normalize(vec2(hash(vec2(id, 3.0)) > 0.5 ? 1.0 : -1.0, -0.55));
          vec2 head = start + dir * ph * 0.55;
          vec2 tail = head - dir * 0.22;
          vec2 pa = vec2(az, el) - tail, ba = head - tail;
          float k = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
          float dist = length(pa - ba * k);
          float fade = sin(ph / 1.1 * 3.14159);
          return vec3(0.85, 0.92, 1.0) * smoothstep(0.0035, 0.0, dist) * k * k * fade * 1.6;
        }

        void main() {
          vec3 d = normalize(vDir);
          float el = d.y;
          vec3 col = mix(vec3(0.05, 0.13, 0.24), vec3(0.025, 0.05, 0.15), smoothstep(-0.02, 0.22, el));
          col = mix(col, vec3(0.008, 0.015, 0.06), smoothstep(0.22, 0.95, el));

          // faint milky way
          float band = exp(-pow(dot(d, normalize(vec3(0.55, 0.35, 0.75))) * 5.0, 2.0));
          col += vec3(0.18, 0.12, 0.3) * band * fbm(d.xz * 6.0 + d.y * 3.0) * smoothstep(0.0, 0.3, el) * 0.6;

          col += aurora(d);
          col += vec3(0.04, 0.16, 0.12) * (1.0 - smoothstep(0.0, 0.35, el)) * 0.6; // aurora glow on horizon

          // moon, halo and craters
          float md = dot(d, uMoonDir);
          col += vec3(0.35, 0.45, 0.8) * pow(max(md, 0.0), 12.0) * 0.35;
          col += vec3(0.7, 0.8, 1.0) * pow(max(md, 0.0), 400.0) * 0.6;
          float r = 0.045;
          float ang = acos(clamp(md, -1.0, 1.0));
          if (ang < r * 1.05) {
            vec3 ux = normalize(cross(uMoonDir, vec3(0.0, 1.0, 0.0)));
            vec3 uy = cross(ux, uMoonDir);
            vec2 m = vec2(dot(d, ux), dot(d, uy)) / r;
            float craters = fbm(m * 3.2 + 7.0) * 0.55 + fbm(m * 9.0) * 0.25;
            float limb = sqrt(max(1.0 - dot(m, m), 0.0));
            vec3 moon = vec3(1.05, 1.03, 0.98) * (0.72 + 0.35 * limb) * (1.08 - craters * 0.5);
            col = mix(col, moon * 1.25, smoothstep(r * 1.02, r * 0.98, ang));
          }

          col += shootingStar(d);
          gl_FragColor = vec4(col, 1.0);
        }`,
      }),
    );
  ((t.renderOrder = -2), (t.frustumCulled = !1), i.add(t));
  const e = 4500,
    n = Qi(7),
    r = new Float32Array(e * 3),
    s = new Float32Array(e * 3),
    a = new Float32Array(e),
    o = [
      [1, 1, 1],
      [0.75, 0.85, 1],
      [1, 0.8, 0.92],
      [0.8, 1, 0.92],
    ];
  for (let u = 0; u < e; u++) {
    const h = 0.03 + Math.pow(n(), 0.8) * 0.97,
      f = n() * Math.PI * 2,
      m = Math.sqrt(1 - h * h);
    r.set([Math.cos(f) * m * 1200, h * 1200, Math.sin(f) * m * 1200], u * 3);
    const g = o[Math.floor(n() * o.length)];
    (s.set(g, u * 3), (a[u] = n() < 0.04 ? 3.2 + n() * 2 : 1.2 + n() * 1.6));
  }
  const l = new Me();
  (l.setAttribute("position", new he(r, 3)),
    l.setAttribute("color", new he(s, 3)),
    l.setAttribute("aSize", new he(a, 1)));
  const c = new kr(
    l,
    new ie({
      transparent: !0,
      depthWrite: !1,
      blending: Pn,
      uniforms: { uTime: ve.uTime, uPixelRatio: ve.uPixelRatio },
      vertexShader: `
        attribute float aSize; attribute vec3 color;
        uniform float uTime; uniform float uPixelRatio;
        varying vec3 vC; varying float vA;
        void main() {
          vC = color;
          vA = 0.55 + 0.45 * sin(uTime * (0.8 + fract(position.x * 0.13) * 2.5) + position.z);
          vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
          gl_Position = p.xyww;
          gl_PointSize = aSize * uPixelRatio * (0.8 + vA * 0.4);
        }`,
      fragmentShader: `
        varying vec3 vC; varying float vA;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(vC * a * vA * 1.4, 1.0);
        }`,
    }),
  );
  return ((c.renderOrder = -1), (c.frustumCulled = !1), i.add(c), i);
}
function nn(i, t) {
  const e = Math.abs(i),
    n = 24 * wr(24, 95, e) + 70 * wr(90, 280, e),
    r = 80 * wr(-110, -340, t) + 45 * wr(120, 330, t),
    s =
      (Math.sin(i * 0.021 + t * 0.013) * 0.5 + 0.5) *
      (Math.sin(t * 0.027 - i * 0.011) * 0.5 + 0.5);
  return (
    Math.sin(i * 0.07) * Math.cos(t * 0.05) * 1.3 +
    Math.sin(i * 0.19 + t * 0.11) * 0.4 +
    Math.sin(t * 0.03 + 1) * 1.5 +
    (n + r) * (0.7 + 0.6 * s)
  );
}
function ig() {
  const i = new Yn(1e3, 1e3, 260, 260);
  (i.rotateX(-Math.PI / 2), i.translate(0, 0, -80));
  const t = i.attributes.position;
  for (let r = 0; r < t.count; r++) t.setY(r, nn(t.getX(r), t.getZ(r)));
  i.computeVertexNormals();
  const e = new ie({
      uniforms: { ...ve },
      vertexShader: `
      varying vec3 vW; varying vec3 vN; varying float vD;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz; vN = normal;
        vec4 mv = viewMatrix * w; vD = length(mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
      fragmentShader: `
      uniform vec3 uLightDir;
      ${Wr}
      ${Gl}
      varying vec3 vW; varying vec3 vN; varying float vD;
      void main() {
        vec3 n = normalize(vN);
        float vr = fbm(vW.xz * 0.08);
        vec3 meadow = mix(vec3(0.02, 0.09, 0.08), vec3(0.04, 0.16, 0.12), vr);
        vec3 slope = mix(vec3(0.03, 0.06, 0.15), vec3(0.06, 0.1, 0.22), vr);
        vec3 col = mix(meadow, slope, smoothstep(6.0, 40.0, vW.y));
        col = mix(col, vec3(0.42, 0.5, 0.7), smoothstep(85.0, 130.0, vW.y + vr * 25.0) * smoothstep(0.55, 0.9, n.y));
        float diff = max(dot(n, uLightDir), 0.0);
        col *= 0.55 + diff * 0.9;
        col += vec3(0.02, 0.08, 0.06) * n.y; // aurora skylight
        gl_FragColor = vec4(applyFog(col, vD), 1.0);
      }`,
    }),
    n = new ge(i, e);
  return ((n.name = "terrain"), n);
}
const Nr = new D(0.1, 1, 0);
function kl() {
  const i = [],
    t = [],
    e = [],
    n = [],
    r = new D(),
    s = new Ze().setFromUnitVectors(
      new D(0, 1, 0),
      new D(0.5, 1, 0.05).normalize(),
    );
  function a(c, u, h, f, m = !1) {
    const g = i.length / 3;
    for (let _ = 0; _ <= c; _++)
      for (let p = 0; p <= u; p++) {
        const [d, b, T, S] = h(_ / c, p / u);
        (r.set(d, b, T),
          m && r.applyQuaternion(s).add(Nr),
          i.push(r.x, r.y, r.z),
          t.push(S),
          e.push(f));
      }
    for (let _ = 0; _ < c; _++)
      for (let p = 0; p < u; p++) {
        const d = g + _ * (u + 1) + p,
          b = d + u + 1;
        n.push(d, b, d + 1, b, b + 1, d + 1);
      }
  }
  a(
    3,
    3,
    (c, u) => {
      const h = u * Math.PI * 2,
        f = 0.024 * (1 - c * 0.35);
      return [
        Nr.x * c * c + Math.cos(h) * f,
        Nr.y * c - 0.02,
        Math.sin(h) * f,
        c,
      ];
    },
    1,
  );
  for (const [c, u] of [
    [0.7, 0.8],
    [3.4, 0.65],
  ]) {
    const h = [Math.cos(c), Math.sin(c)],
      f = [-Math.sin(c), Math.cos(c)];
    a(
      4,
      1,
      (m, g) => {
        const _ = g * 2 - 1,
          p =
            0.055 * Math.sin(Math.PI * Math.min(m * 1.15 + 0.05, 1)) +
            0.01 * (1 - m),
          d = m * u * 0.6,
          b = m * u * 0.85 - m * m * u * 0.4 + 0.01;
        return [h[0] * d + f[0] * _ * p, b, h[1] * d + f[1] * _ * p, m * 0.8];
      },
      1,
    );
  }
  const o = 5;
  for (let c = 0; c < 6; c++) {
    const u = c % 2 === 1,
      h = (c * Math.PI) / 3 + 0.2,
      f = u ? 0.5 : 0.58,
      m = u ? 0.14 : 0.115,
      g = [Math.cos(h), Math.sin(h)],
      _ = [-Math.sin(h), Math.cos(h)],
      p = [0],
      d = [0],
      b = [];
    for (let T = 0; T <= o; T++) {
      const S = 0.3 + 1.8 * Math.pow(T / o, 1.5);
      (b.push(S),
        T < o &&
          (p.push(p[T] + Math.sin(S) * (f / o)),
          d.push(d[T] + Math.cos(S) * (f / o))));
    }
    a(
      o,
      2,
      (T, S) => {
        const N = Math.round(T * o),
          A = S * 2 - 1,
          w = b[N],
          U =
            m *
              Math.pow(Math.sin(Math.PI * Math.min(T * 1.05 + 0.04, 1)), 0.7) +
            0.012 * (1 - T),
          E = A * A * U * 0.5,
          M = p[N] - Math.cos(w) * E + 0.015,
          R = d[N] + Math.sin(w) * E;
        return [g[0] * M + _[0] * A * U, R, g[1] * M + _[1] * A * U, T];
      },
      0,
      !0,
    );
  }
  for (let c = 0; c < 3; c++) {
    const u = (c * Math.PI * 2) / 3 + 0.7,
      h = [Math.cos(u), Math.sin(u)],
      f = [-Math.sin(u), Math.cos(u)];
    a(
      2,
      1,
      (m, g) => {
        const _ = g * 2 - 1,
          p = m > 0.9 ? 0.03 : 0.006,
          d = m * 0.16;
        return [h[0] * d + f[0] * _ * p, m * 0.36, h[1] * d + f[1] * _ * p, m];
      },
      2,
      !0,
    );
  }
  const l = new Me();
  return (
    l.setAttribute("position", new ae(i, 3)),
    l.setAttribute("aGrad", new ae(t, 1)),
    l.setAttribute("aPart", new ae(e, 1)),
    l.setIndex(n),
    l.computeVertexNormals(),
    l
  );
}
function Vl(i = 0) {
  return new ie({
    side: Ye,
    uniforms: { ...ve, uGlow: { value: i } },
    vertexShader: `
      attribute float aGrad; attribute float aPart;
      uniform float uTime;
      varying vec3 vN; varying vec3 vCol; varying float vGrad; varying float vPart; varying float vD;
      void main() {
        vec3 origin = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        float h = max(w.y - origin.y, 0.0);
        float wind = sin(uTime * 1.1 + origin.x * 0.17 + origin.z * 0.11) + 0.4 * sin(uTime * 2.3 + origin.z * 0.3);
        w.x += wind * 0.055 * h * h;
        w.z += wind * 0.025 * h * h;
        vN = normalize(mat3(modelMatrix) * mat3(instanceMatrix) * normal);
        #ifdef USE_INSTANCING_COLOR
          vCol = instanceColor;
        #else
          vCol = vec3(1.0, 0.6, 0.8);
        #endif
        vGrad = aGrad; vPart = aPart;
        vec4 mv = viewMatrix * w;
        vD = length(mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `
      uniform vec3 uLightDir; uniform float uGlow; uniform float uTime;
      ${Wr}
      varying vec3 vN; varying vec3 vCol; varying float vGrad; varying float vPart; varying float vD;
      void main() {
        vec3 n = normalize(vN);
        if (!gl_FrontFacing) n = -n;
        float diff = max(dot(n, uLightDir), 0.0);
        float isPetal = 1.0 - step(0.5, vPart);
        vec3 base;
        if (vPart < 0.5) {
          base = mix(vec3(1.0, 0.96, 0.97), vCol, smoothstep(0.08, 0.8, vGrad));
          base = mix(base, vec3(0.7, 1.0, 0.8), (1.0 - smoothstep(0.0, 0.2, vGrad)) * 0.5);
        } else if (vPart < 1.5) {
          base = mix(vec3(0.03, 0.16, 0.12), vec3(0.1, 0.4, 0.3), vGrad);
        } else {
          base = mix(vec3(0.85, 0.85, 0.55), vec3(1.0, 0.45, 0.25), smoothstep(0.75, 1.0, vGrad));
        }
        float translucency = max(dot(-n, uLightDir), 0.0) * 0.35 * isPetal;
        vec3 col = base * (0.32 + diff * 0.7 + translucency);
        float pulse = 0.85 + 0.15 * sin(uTime * 2.0);
        col += base * isPetal * (0.16 + uGlow * 0.9 * pulse);
        col += vec3(0.05, 0.22, 0.18) * max(n.y, 0.0) * 0.35;
        gl_FragColor = vec4(applyFog(col, vD), 1.0);
      }`,
  });
}
const Qo = [
  [[1, 0.52, 0.76], 0.17],
  [[1, 0.7, 0.86], 0.15],
  [[0.94, 0.4, 0.68], 0.12],
  [[0.52, 0.7, 1], 0.15],
  [[0.66, 0.8, 1], 0.13],
  [[0.42, 0.56, 1], 0.08],
  [[0.78, 0.64, 1], 0.1],
  [[0.95, 0.94, 1], 0.1],
].map(([i, t]) => [new Ot(...i), t]);
function Wl(i) {
  let t = i();
  for (const [e, n] of Qo) if ((t -= n) <= 0) return e;
  return Qo[0][0];
}
const Xl = (i, t) =>
  0.5 + 0.5 * Math.sin(i * 0.15 + 1.3) * Math.sin(t * 0.12 + 0.4);
function rg(i, t, e, { dense: n = 0.65 } = {}) {
  const r = [];
  let s = 0;
  for (; r.length < i && s++ < i * 20;) {
    const a = t() < n,
      o = a ? (t() * 2 - 1) * 42 : (t() * 2 - 1) * 80,
      l = a ? -75 + t() * 125 : -150 + t() * 220;
    if (
      t() > 0.45 + 0.55 * Xl(o, l) ||
      e.some((u) => (u.x - o) ** 2 + (u.z - l) ** 2 < 2.6)
    )
      continue;
    const c = nn(o, l);
    c > 34 || r.push(new D(o, c, l));
  }
  return r;
}
function sg({ count: i, avoid: t }) {
  const e = Qi(42),
    n = kl(),
    r = new wa(n, Vl(0), i),
    s = new $t(),
    a = new Ze(),
    o = new D(),
    l = new He(),
    c = rg(i, e, t);
  return (
    c.forEach((u, h) => {
      const f = 0.75 + e() * 0.75;
      (l.set((e() - 0.5) * 0.25, e() * Math.PI * 2, (e() - 0.5) * 0.25),
        a.setFromEuler(l),
        o.setScalar(f),
        s.compose(u, a, o),
        r.setMatrixAt(h, s),
        r.setColorAt(h, Wl(e)));
    }),
    (r.count = c.length),
    r.computeBoundingSphere(),
    r
  );
}
function ag({ count: i }) {
  const t = Qi(99),
    e = 4,
    n = [],
    r = [],
    s = [];
  for (let g = 0; g <= e; g++) {
    const _ = g / e,
      p = 0.05 * (1 - _);
    if ((n.push(-p, _, 0, p, _, 0), r.push(_, _), g < e)) {
      const d = g * 2;
      s.push(d, d + 2, d + 1, d + 1, d + 2, d + 3);
    }
  }
  const a = new Me();
  (a.setAttribute("position", new ae(n, 3)),
    a.setAttribute("aGrad", new ae(r, 1)),
    a.setIndex(s));
  const o = new ie({
      side: Ye,
      uniforms: { ...ve },
      vertexShader: `
      attribute float aGrad;
      uniform float uTime;
      varying float vG; varying float vD; varying float vTint;
      void main() {
        vec3 o = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vec4 w = modelMatrix * instanceMatrix * vec4(position, 1.0);
        float wind = sin(uTime * 1.4 + o.x * 0.2 + o.z * 0.15) * 0.6 + sin(uTime * 3.1 + o.x) * 0.15;
        w.x += wind * aGrad * aGrad * 0.35;
        w.z += wind * aGrad * aGrad * 0.15;
        vG = aGrad; vTint = fract(o.x * 0.37 + o.z * 0.71);
        vec4 mv = viewMatrix * w; vD = length(mv.xyz);
        gl_Position = projectionMatrix * mv;
      }`,
      fragmentShader: `
      ${Wr}
      varying float vG; varying float vD; varying float vTint;
      void main() {
        vec3 base = mix(vec3(0.01, 0.06, 0.06), vec3(0.06, 0.26, 0.2), vG);
        base = mix(base, vec3(0.08, 0.2, 0.32) * (0.4 + vG), vTint * 0.45);
        gl_FragColor = vec4(applyFog(base, vD), 1.0);
      }`,
    }),
    l = new wa(a, o, i),
    c = new $t(),
    u = new Ze(),
    h = new D(),
    f = new He(),
    m = new D();
  for (let g = 0; g < i; g++) {
    const _ = (t() * 2 - 1) * 50,
      p = -80 + t() * 135;
    (m.set(_, nn(_, p) - 0.02, p),
      f.set((t() - 0.5) * 0.5, t() * Math.PI, (t() - 0.5) * 0.5),
      u.setFromEuler(f),
      h.set(1, 0.35 + t() * 0.75, 1),
      c.compose(m, u, h),
      l.setMatrixAt(g, c));
  }
  return (l.computeBoundingSphere(), l);
}
function og({ count: i }) {
  const t = Qi(5),
    e = [],
    n = [];
  let r = 0;
  for (; e.length / 3 < i && r++ < i * 10;) {
    const o = (t() * 2 - 1) * 170,
      l = -280 + t() * 360;
    if (Math.abs(o) < 40 && l > -70 && l < 50 && t() < 0.85) continue;
    const u = nn(o, l);
    if (u > 60 || t() > 0.4 + 0.6 * Xl(o, l)) continue;
    e.push(o, u + 0.7 + t() * 0.5, l);
    const h = Wl(t);
    n.push(h.r, h.g, h.b);
  }
  const s = new Me();
  (s.setAttribute("position", new ae(e, 3)),
    s.setAttribute("color", new ae(n, 3)));
  const a = new ie({
    transparent: !0,
    depthWrite: !1,
    uniforms: { ...ve },
    vertexShader: `
      attribute vec3 color;
      uniform float uPixelRatio; uniform float uTime;
      varying vec3 vC; varying float vD;
      void main() {
        vC = color;
        vec3 p = position;
        p.x += sin(uTime * 1.1 + p.z * 0.1) * 0.08;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vD = length(mv.xyz);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(240.0 * uPixelRatio / -mv.z, 1.0, 14.0 * uPixelRatio);
      }`,
    fragmentShader: `
      ${Wr}
      varying vec3 vC; varying float vD;
      void main() {
        vec2 q = gl_PointCoord - 0.5;
        float ang = atan(q.y, q.x);
        float petal = 0.32 + 0.14 * cos(ang * 6.0);
        float d = length(q);
        float a = smoothstep(petal, petal - 0.12, d);
        vec3 c = mix(vec3(1.0, 0.97, 0.95), vC, smoothstep(0.05, 0.3, d)) * 0.95;
        if (a < 0.02) discard;
        gl_FragColor = vec4(applyFog(c, vD), a);
      }`,
  });
  return new kr(s, a);
}
const Li = 12,
  Yl = Array.from({ length: Li }, (i, t) => {
    const e = t * 2.39996 + 0.6,
      n = 5 + t * 2.4,
      r = Math.sin(e) * n,
      s = -8 - Math.cos(e) * n * 1.15;
    return new D(r, nn(r, s), s);
  }),
  tl = 2.1;
function lg() {
  const i = document.createElement("canvas");
  i.width = i.height = 512;
  const t = i.getContext("2d"),
    e = t.createRadialGradient(256, 220, 20, 256, 256, 300);
  return (
    e.addColorStop(0, "rgba(255,150,205,0.45)"),
    e.addColorStop(1, "rgba(30,50,120,0.35)"),
    (t.fillStyle = e),
    t.fillRect(0, 0, 512, 512),
    t.setLineDash([18, 14]),
    (t.lineWidth = 6),
    (t.strokeStyle = "rgba(255,210,235,0.9)"),
    t.strokeRect(40, 40, 432, 432),
    (t.fillStyle = "#fff"),
    (t.textAlign = "center"),
    (t.font = "200 150px Georgia"),
    t.fillText("+", 256, 270),
    (t.font = "italic 40px Georgia"),
    t.fillText("add a memory", 256, 360),
    new ym(i)
  );
}
function cg() {
  return new ie({
    transparent: !0,
    depthWrite: !1,
    uniforms: {
      uMap: { value: null },
      uPlaneAspect: { value: 1 },
      uHover: { value: 0 },
      uOpacity: { value: 0 },
      uTime: ve.uTime,
    },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform sampler2D uMap; uniform float uPlaneAspect; uniform float uHover; uniform float uOpacity; uniform float uTime;
      varying vec2 vUv;
      float rbox(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
      void main() {
        vec2 p = (vUv - 0.5) * vec2(uPlaneAspect, 1.0);
        vec2 inner = vec2(uPlaneAspect, 1.0) * 0.5 - 0.09;
        float d = rbox(p, inner, 0.06);
        // photo
        vec2 uv = p / (inner * 2.0) + 0.5;
        vec4 img = texture2D(uMap, clamp(uv, 0.0, 1.0));
        float inside = smoothstep(0.004, -0.004, d);
        // glowing frame
        float frame = smoothstep(0.06, 0.0, abs(d - 0.02));
        float halo = exp(-max(d, 0.0) * 14.0) * (1.0 - inside);
        vec3 glowCol = mix(vec3(1.0, 0.55, 0.82), vec3(0.5, 0.85, 1.0), 0.5 + 0.5 * sin(uTime * 0.8 + vUv.x * 3.0));
        vec3 col = img.rgb * 1.05 * inside + glowCol * (frame * (1.1 + uHover) + halo * (0.6 + uHover));
        float a = max(inside, max(frame, halo * 0.8));
        gl_FragColor = vec4(col, a * uOpacity);
      }`,
  });
}
function hg(i) {
  return new ie({
    transparent: !0,
    depthWrite: !1,
    blending: Pn,
    uniforms: {
      uTime: ve.uTime,
      uColor: { value: new Ot(...i) },
      uSeed: { value: Math.random() * 10 },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uColor; uniform float uSeed;
      varying vec2 vUv;
      void main() {
        float d = length(vUv - 0.5) * 2.0;
        float a = exp(-d * d * 5.0) * (0.75 + 0.25 * sin(uTime * 2.0 + uSeed));
        gl_FragColor = vec4(uColor * a, 1.0);
      }`,
  });
}
function ug() {
  const i = new Vn(),
    t = new wa(kl(), Vl(1), Li),
    e = new $t(),
    n = new Ze(),
    r = lg(),
    s = [];
  (Yl.forEach((h, f) => {
    (n.setFromEuler(new He(0, f * 1.7, 0)),
      e.compose(h, n, new D().setScalar(tl)),
      t.setMatrixAt(f, e),
      t.setColorAt(f, new Ot(...(f % 2 ? [1, 0.55, 0.8] : [0.6, 0.75, 1]))));
    const m = Nr.clone().multiplyScalar(tl).applyQuaternion(n).add(h);
    m.y += 0.4;
    const g = new ge(
      new Yn(4, 4),
      hg(f % 2 ? [1, 0.45, 0.75] : [0.45, 0.7, 1]),
    );
    (g.position.copy(m), i.add(g));
    const _ = new Vn();
    _.position.copy(m).add(new D(0, 2.2, 0));
    const p = new ge(new Yn(1, 1), cg());
    ((p.visible = !1), (p.userData.slot = f), _.add(p), i.add(_));
    const d = new ge(
      new Ra(0.015, 0.015, 1.6, 6, 1, !0),
      new ji({
        color: 16758492,
        transparent: !0,
        opacity: 0.35,
        blending: Pn,
        depthWrite: !1,
      }),
    );
    (d.position.copy(m).add(new D(0, 0.9, 0)), (d.visible = !1), i.add(d));
    const b = new ge(new Vr(1.4, 8, 6), new ji({ visible: !1 }));
    (b.position.copy(m),
      (b.userData.slot = f),
      i.add(b),
      s.push({
        index: f,
        anchor: _,
        frame: p,
        halo: g,
        beam: d,
        hit: b,
        head: m,
        texture: null,
        key: null,
        phase: Math.random() * 6,
      }));
  }),
    t.computeBoundingSphere(),
    i.add(t));
  const a = new Rm();
  function o(h, f, m) {
    const g = s[h],
      _ = f || (m ? "placeholder" : "");
    if (g.key !== _) {
      if (
        ((g.key = _),
        g.texture && g.texture !== r && g.texture.dispose(),
        (g.texture = null),
        !f)
      )
        return l(g, m ? r : null, 1);
      a.load(f, (p) => {
        if (g.key !== _) return p.dispose();
        ((p.anisotropy = 4), l(g, p, p.image.width / p.image.height));
      });
    }
  }
  function l(h, f, m) {
    if (((h.texture = f), (h.frame.visible = !!f), (h.beam.visible = !!f), !f))
      return;
    const g = h.frame.material;
    ((g.uniforms.uMap.value = f), (g.uniforms.uOpacity.value = 0));
    const _ = Math.min(Math.max(m, 0.6), 1.7),
      p = 2.3 / Math.max(_, 1);
    (h.frame.scale.set(p * _, p, 1),
      (g.uniforms.uPlaneAspect.value = _),
      (h.fadeIn = !0));
  }
  const c = s.flatMap((h) => [h.frame, h.hit]);
  function u(h, f, m) {
    for (const g of s) {
      ((g.anchor.position.y =
        g.head.y + 2.2 + Math.sin(f * 0.9 + g.phase) * 0.15),
        g.frame.quaternion.copy(h.quaternion),
        g.halo.quaternion.copy(h.quaternion));
      const _ = g.frame.material.uniforms;
      (g.fadeIn && (_.uOpacity.value = Math.min(_.uOpacity.value + 0.02, 1)),
        (_.uHover.value += ((m === g.index ? 1 : 0) - _.uHover.value) * 0.15));
    }
  }
  return { group: i, slots: s, targets: c, setPhoto: o, update: u };
}
function dg({ count: i }) {
  const t = Qi(11),
    e = new Float32Array(i * 3),
    n = new Float32Array(i * 3),
    r = new Float32Array(i),
    s = [
      [1, 0.55, 0.85],
      [0.45, 1, 0.75],
      [0.55, 0.75, 1],
      [1, 0.9, 0.6],
    ];
  for (let c = 0; c < i; c++) {
    const u = (t() * 2 - 1) * 45,
      h = -70 + t() * 115;
    (e.set([u, nn(u, h) + 0.6 + t() * 4.5, h], c * 3),
      n.set(s[c % s.length], c * 3),
      (r[c] = t() * 100));
  }
  const a = new Me();
  (a.setAttribute("position", new he(e, 3)),
    a.setAttribute("color", new he(n, 3)),
    a.setAttribute("aSeed", new he(r, 1)));
  const o = new ie({
      transparent: !0,
      depthWrite: !1,
      blending: Pn,
      uniforms: { uTime: ve.uTime, uPixelRatio: ve.uPixelRatio },
      vertexShader: `
      attribute vec3 color; attribute float aSeed;
      uniform float uTime; uniform float uPixelRatio;
      varying vec3 vC; varying float vA;
      void main() {
        vec3 p = position;
        float t = uTime * 0.4 + aSeed;
        p += vec3(sin(t * 1.3) * 1.2, sin(t * 1.7) * 0.6, cos(t * 1.1) * 1.2);
        vA = smoothstep(-0.2, 1.0, sin(uTime * 1.8 + aSeed * 3.0));
        vC = color;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(90.0 * uPixelRatio / -mv.z, 1.5, 40.0) * (0.6 + vA * 0.6);
      }`,
      fragmentShader: `
      varying vec3 vC; varying float vA;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float a = exp(-d * d * 28.0) + exp(-d * d * 260.0);
        gl_FragColor = vec4(vC * a * vA * 1.3, 1.0);
      }`,
    }),
    l = new kr(a, o);
  return ((l.frustumCulled = !1), l);
}
function fg() {
  const t = new Float32Array(1200),
    e = new Float32Array(400 * 3),
    n = new Float32Array(400),
    r = new Float32Array(400 * 3),
    s = new Me();
  (s.setAttribute("position", new he(t, 3)),
    s.setAttribute("aLife", new he(n, 1)),
    s.setAttribute("color", new he(r, 3)));
  const a = new ie({
      transparent: !0,
      depthWrite: !1,
      blending: Pn,
      uniforms: { uPixelRatio: ve.uPixelRatio },
      vertexShader: `
      attribute float aLife; attribute vec3 color;
      uniform float uPixelRatio;
      varying float vL; varying vec3 vC;
      void main() {
        vL = aLife; vC = color;
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = aLife > 0.0 ? clamp(160.0 * uPixelRatio / -mv.z, 2.0, 60.0) : 0.0;
      }`,
      fragmentShader: `
      varying float vL; varying vec3 vC;
      void main() {
        vec2 p = (gl_PointCoord - 0.5) * vec2(2.2, -2.2) + vec2(0.0, 0.25);
        float h = pow(p.x * p.x + p.y * p.y - 0.4, 3.0) - p.x * p.x * p.y * p.y * p.y;
        float a = smoothstep(0.02, -0.02, h);
        if (a < 0.01) discard;
        gl_FragColor = vec4(vC * a * min(vL * 2.0, 1.0), 1.0);
      }`,
    }),
    o = new kr(s, a);
  o.frustumCulled = !1;
  let l = 0;
  const c = [
    [1, 0.5, 0.8],
    [0.55, 0.75, 1],
    [0.5, 1, 0.75],
    [1, 0.75, 0.9],
  ];
  function u(f, m = 26) {
    for (let g = 0; g < m; g++) {
      const _ = l;
      ((l = (l + 1) % 400), t.set([f.x, f.y + 0.5, f.z], _ * 3));
      const p = Math.random() * Math.PI * 2,
        d = 0.6 + Math.random() * 1.6;
      (e.set(
        [Math.cos(p) * d, 1.5 + Math.random() * 2.2, Math.sin(p) * d],
        _ * 3,
      ),
        (n[_] = 1.4 + Math.random() * 1.2),
        r.set(c[g % c.length], _ * 3));
    }
    s.attributes.color.needsUpdate = !0;
  }
  function h(f) {
    let m = !1;
    for (let g = 0; g < 400; g++)
      n[g] <= 0 ||
        ((m = !0),
        (n[g] -= f),
        (e[g * 3 + 1] -= f * 0.9),
        (e[g * 3] *= 0.985),
        (e[g * 3 + 2] *= 0.985),
        (t[g * 3] += e[g * 3] * f),
        (t[g * 3 + 1] += e[g * 3 + 1] * f * 0.6),
        (t[g * 3 + 2] += e[g * 3 + 2] * f));
    m &&
      ((s.attributes.position.needsUpdate = !0),
      (s.attributes.aLife.needsUpdate = !0));
  }
  return { points: o, burst: u, update: h };
}
const di = { pos: new D(0, 9, 36), target: new D(0, 3, -8) };
function pg(i, { onPick: t }) {
  var ht;
  const e = navigator.userAgent,
    n =
      /iPhone|iPad|Android/.test(e) ||
      (navigator.maxTouchPoints > 1 && /Macintosh/.test(e));
  let r = Math.min(window.devicePixelRatio || 1, n ? 1.5 : 2);
  const s = new vm({
    canvas: i,
    antialias: !n,
    powerPreference: "high-performance",
  });
  ((s.outputColorSpace = qn),
    s.setPixelRatio(r),
    s.setClearColor(198166),
    (ve.uPixelRatio.value = r));
  const a = new xm(),
    o = new ze(55, 1, 0.1, 4e3);
  o.position.copy(di.pos);
  const l = ng();
  (a.add(l),
    a.add(ig()),
    a.add(ag({ count: n ? 18e3 : 32e3 })),
    a.add(sg({ count: n ? 7e3 : 11e3, avoid: Yl })),
    a.add(og({ count: n ? 16e3 : 26e3 })),
    a.add(dg({ count: n ? 280 : 480 })));
  const c = ug();
  a.add(c.group);
  const u = fg();
  a.add(u.points);
  const h = new Lm(o, i);
  (h.target.copy(di.target),
    (h.enableDamping = !0),
    (h.dampingFactor = 0.06),
    (h.rotateSpeed = 0.45),
    (h.zoomSpeed = 0.8),
    (h.panSpeed = 0.6),
    (h.screenSpacePanning = !1),
    (h.minDistance = 3.5),
    (h.maxDistance = 80),
    (h.minPolarAngle = 0.25),
    (h.maxPolarAngle = 1.5),
    (h.autoRotate = !0),
    (h.autoRotateSpeed = 0.22),
    (h.enabled = !1));
  let f;
  (h.addEventListener("start", () => {
    var Z;
    ((h.autoRotate = !1),
      clearTimeout(f),
      (Z = nt.onUserMove) == null || Z.call(nt));
  }),
    h.addEventListener("end", () => {
      (clearTimeout(f), (f = setTimeout(() => (h.autoRotate = !0), 18e3)));
    }));
  const m = new Zm(s);
  m.addPass(new $m(a, o));
  const g = new Ai(new Et(512, 512), 0.8, 0.55, 0.74);
  (m.addPass(g), m.addPass(new tg()));
  function _() {
    const Z = window.innerWidth,
      dt = window.innerHeight;
    ((o.aspect = Z / dt),
      (o.fov = Z / dt < 0.8 ? 68 : 55),
      o.updateProjectionMatrix(),
      s.setSize(Z, dt),
      m.setPixelRatio(r),
      m.setSize(Z, dt));
  }
  (_(),
    window.addEventListener("resize", _),
    (ht = window.visualViewport) == null || ht.addEventListener("resize", _));
  let p = null;
  function d(Z, dt, Ct, W) {
    ((p = {
      fromP: o.position.clone(),
      fromT: h.target.clone(),
      pos: Z,
      target: dt,
      t0: performance.now(),
      dur: Ct,
      done: W,
    }),
      (h.enabled = !1),
      (h.autoRotate = !1));
  }
  const b = (Z) => (Z < 0.5 ? 4 * Z * Z * Z : 1 - Math.pow(-2 * Z + 2, 3) / 2);
  function T(Z, dt) {
    const W = c.slots[Z].anchor.position.clone();
    W.y -= 0.6;
    const J = o.position.clone().sub(W);
    ((J.y = 0), J.lengthSq() < 0.01 && J.set(0, 0, 1), J.normalize());
    const pt = W.clone()
      .addScaledVector(J, 7)
      .add(new D(0, 1.2, 0));
    ((pt.y = Math.max(pt.y, nn(pt.x, pt.z) + 1.6)), d(pt, W, 1800, dt));
  }
  function S() {
    (o.position.set(0, 38, 60), h.target.set(0, 8, -10), o.lookAt(h.target));
  }
  function N(Z) {
    d(di.pos.clone(), di.target.clone(), 6500, () => {
      ((h.autoRotate = !0), Z == null || Z());
    });
  }
  function A() {
    d(di.pos.clone(), di.target.clone(), 2200, () => (h.autoRotate = !0));
  }
  const w = new Cm(),
    U = new Et();
  let E = -1,
    M = null;
  function R(Z) {
    (U.set(
      (Z.clientX / window.innerWidth) * 2 - 1,
      -(Z.clientY / window.innerHeight) * 2 + 1,
    ),
      w.setFromCamera(U, o));
    const dt = w.intersectObjects(c.targets.filter((Ct) => Ct.visible))[0];
    return dt ? dt.object.userData.slot : -1;
  }
  function H() {
    const Z = w.ray.origin.clone(),
      dt = w.ray.direction.clone().multiplyScalar(0.5);
    for (let Ct = 0; Ct < 400; Ct++)
      if ((Z.add(dt), Z.y < nn(Z.x, Z.z))) return Z;
    return null;
  }
  (i.addEventListener("pointerdown", (Z) => {
    M = { x: Z.clientX, y: Z.clientY, t: performance.now() };
  }),
    i.addEventListener("pointerup", (Z) => {
      if (!M || !h.enabled) return;
      const dt = Math.hypot(Z.clientX - M.x, Z.clientY - M.y),
        Ct = performance.now() - M.t < 600;
      if (((M = null), dt > 10 || !Ct)) return;
      const W = R(Z);
      if (W >= 0) return t(W);
      const J = H();
      J && u.burst(J);
    }),
    i.addEventListener("pointermove", (Z) => {
      Z.pointerType === "mouse" &&
        ((E = h.enabled ? R(Z) : -1),
        (i.style.cursor = E >= 0 ? "pointer" : "grab"));
    }));
  const O = new Bl();
  let V = 0,
    K = 0,
    X = 2;
  function tt(Z) {
    X === 0 ||
      V < 30 ||
      ((K = Z > 0.04 ? K + 1 : Math.max(K - 1, 0)),
      K > 60 &&
        ((K = 0),
        X--,
        X === 1
          ? ((r = Math.max(1, r * 0.75)),
            s.setPixelRatio(r),
            (ve.uPixelRatio.value = r),
            _())
          : ((g.strength = 0.5),
            (r = 1),
            s.setPixelRatio(1),
            (ve.uPixelRatio.value = 1),
            _())));
  }
  function G() {
    const Z = Math.min(O.getDelta(), 0.1);
    if ((V++, (ve.uTime.value += Z), tt(Z), p)) {
      const dt = Math.min((performance.now() - p.t0) / p.dur, 1),
        Ct = b(dt);
      if (
        (o.position.lerpVectors(p.fromP, p.pos, Ct),
        h.target.lerpVectors(p.fromT, p.target, Ct),
        o.lookAt(h.target),
        dt >= 1)
      ) {
        const W = p.done;
        ((p = null), (h.enabled = !0), W == null || W());
      }
    } else {
      h.update();
      const dt = h.target;
      ((dt.x = Ur.clamp(dt.x, -45, 45)),
        (dt.z = Ur.clamp(dt.z, -95, 50)),
        (dt.y = Ur.clamp(dt.y, nn(dt.x, dt.z) + 0.5, 14)));
      const Ct = nn(o.position.x, o.position.z) + 1.3;
      o.position.y < Ct && (o.position.y = Ct);
    }
    (l.position.copy(o.position),
      c.update(o, ve.uTime.value, E),
      u.update(Z),
      m.render(Z),
      requestAnimationFrame(G));
  }
  const nt = {
    start() {
      requestAnimationFrame(G);
    },
    setIntroView: S,
    introFly: N,
    flyTo: T,
    goHome: A,
    setPhoto: c.setPhoto,
    controls: h,
    onUserMove: null,
  };
  return nt;
}

export { pg as createValley, Li as LILY_COUNT }
