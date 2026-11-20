/**
 * "Raw to ready" — a scroll-driven particle scene.
 *
 * Every particle has three anchor points computed once on the CPU:
 *   aStart – a noisy cluster (one of five source systems)
 *   aPipe  – a point inside a narrow ingestion "pipe"
 *   aEnd   – a slot in one of three ordered layers (bronze / silver / gold)
 * The vertex shader blends between them from a single uniform, uProgress,
 * so scrolling costs one uniform write per frame no matter the particle count.
 */
import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  Group,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  WebGLRenderer,
} from "three";

export interface FlowScene {
  setProgress(p: number): void;
  setActive(active: boolean): void;
  resize(): void;
  dispose(): void;
}

const SOURCES = 5;
const LAYERS = 3;
const SLAB = 3.4; // width/depth of each layer
const LAYER_GAP = 1.15;
const END_X = 3.7;
const START_X = -6.2;

const vertexShader = /* glsl */ `
  uniform float uProgress;
  uniform float uTime;
  uniform float uSize;
  uniform float uPixelRatio;
  attribute vec3 aStart;
  attribute vec3 aPipe;
  attribute vec3 aEnd;
  attribute float aDelay;
  attribute float aSeed;
  varying float vT;

  float easeInOut(float x) {
    return x < 0.5 ? 4.0 * x * x * x : 1.0 - pow(-2.0 * x + 2.0, 3.0) / 2.0;
  }

  void main() {
    float t = clamp((uProgress * 1.9 - aDelay) / 0.9, 0.0, 1.0);

    // Raw data never sits still.
    vec3 drift = vec3(
      sin(uTime * 0.6 + aSeed * 6.2831),
      cos(uTime * 0.5 + aSeed * 12.0),
      sin(uTime * 0.4 + aSeed * 3.0)
    ) * 0.14 * (1.0 - t);

    vec3 pos;
    if (t < 0.5) {
      pos = mix(aStart + drift, aPipe, easeInOut(t * 2.0));
    } else {
      pos = mix(aPipe, aEnd, easeInOut(t * 2.0 - 1.0));
    }
    // Settled data breathes, very slightly.
    pos.y += step(0.999, t) * sin(uTime * 1.4 + aEnd.x * 2.5 + aEnd.z * 1.7) * 0.012;

    vec4 mv = modelViewMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mv;
    float transit = 1.0 - abs(t * 2.0 - 1.0);
    gl_PointSize = uSize * uPixelRatio * (1.0 + 0.5 * transit) / -mv.z;
    vT = t;
  }
`;

const fragmentShader = /* glsl */ `
  uniform vec3 uRaw;
  uniform vec3 uReady;
  varying float vT;

  void main() {
    vec2 c = gl_PointCoord - 0.5;
    float d = length(c);
    if (d > 0.5) discard;
    float a = smoothstep(0.5, 0.05, d);
    gl_FragColor = vec4(mix(uRaw, uReady, vT), a * (0.6 + 0.35 * vT));
  }
`;

/** Standard normal sample (Box–Muller). */
const gauss = (): number => {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

function buildGeometry(count: number): BufferGeometry {
  const start = new Float32Array(count * 3);
  const pipe = new Float32Array(count * 3);
  const end = new Float32Array(count * 3);
  const delay = new Float32Array(count);
  const seed = new Float32Array(count);

  const perLayer = Math.ceil(count / LAYERS);
  const side = Math.ceil(Math.sqrt(perLayer));
  const step = SLAB / (side - 1);

  for (let i = 0; i < count; i++) {
    const src = i % SOURCES;
    const i3 = i * 3;

    // Five lopsided source clusters, stacked down the left.
    const cy = (src - (SOURCES - 1) / 2) * 1.05;
    start[i3] = START_X + gauss() * 0.42 + (src % 2 ? 0.5 : -0.3);
    start[i3 + 1] = cy + gauss() * 0.16;
    start[i3 + 2] = gauss() * 0.5;

    // A tight pipe at the centre.
    const ang = Math.random() * Math.PI * 2;
    const rad = Math.sqrt(Math.random()) * 0.14;
    pipe[i3] = (Math.random() - 0.5) * 1.4;
    pipe[i3 + 1] = Math.cos(ang) * rad;
    pipe[i3 + 2] = Math.sin(ang) * rad;

    // Three perfectly ordered layers on the right.
    const layer = Math.floor(i / perLayer);
    const j = i - layer * perLayer;
    const gx = j % side;
    const gz = Math.floor(j / side);
    // A touch of jitter keeps the grid crisp without moiré.
    end[i3] = END_X + gx * step - SLAB / 2 + (Math.random() - 0.5) * step * 0.3;
    end[i3 + 1] = (layer - (LAYERS - 1) / 2) * LAYER_GAP;
    end[i3 + 2] = gz * step - SLAB / 2 + (Math.random() - 0.5) * step * 0.3;

    // Sources arrive in waves, not all at once.
    delay[i] = src * 0.11 + Math.random() * 0.4;
    seed[i] = Math.random();
  }

  const g = new BufferGeometry();
  // three needs a `position` attribute for bounds; the shader ignores it.
  g.setAttribute("position", new BufferAttribute(end.slice(), 3));
  g.setAttribute("aStart", new BufferAttribute(start, 3));
  g.setAttribute("aPipe", new BufferAttribute(pipe, 3));
  g.setAttribute("aEnd", new BufferAttribute(end, 3));
  g.setAttribute("aDelay", new BufferAttribute(delay, 1));
  g.setAttribute("aSeed", new BufferAttribute(seed, 1));
  return g;
}

export function createFlowScene(host: HTMLElement): FlowScene {
  const small = innerWidth < 700 || (navigator.hardwareConcurrency ?? 8) <= 4;
  const count = small ? 4500 : 10000;

  const renderer = new WebGLRenderer({ antialias: false, alpha: true, powerPreference: "high-performance" });
  renderer.setClearColor(0x000000, 0);
  host.appendChild(renderer.domElement);

  const scene = new Scene();
  const camera = new PerspectiveCamera(35, 1, 0.1, 200);
  const orient = new Group(); // portrait vs landscape
  const tilt = new Group(); // mouse + base tilt
  orient.add(tilt);
  scene.add(orient);

  const material = new ShaderMaterial({
    vertexShader,
    fragmentShader,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    uniforms: {
      uProgress: { value: 0 },
      uTime: { value: 0 },
      uSize: { value: 64 },
      uPixelRatio: { value: 1 },
      uRaw: { value: new Color("#8d8a85") },
      uReady: { value: new Color("#f2efe9") },
    },
  });
  const points = new Points(buildGeometry(count), material);
  points.frustumCulled = false;
  tilt.add(points);

  // Mouse parallax, eased.
  const target = { x: 0, y: 0 };
  const onMove = (e: PointerEvent): void => {
    target.x = e.clientX / innerWidth - 0.5;
    target.y = e.clientY / innerHeight - 0.5;
  };
  addEventListener("pointermove", onMove, { passive: true });

  let goal = 0; // scroll progress we're easing towards
  let shown = 0;
  let running = false;
  let last = performance.now();

  const resize = (): void => {
    const w = host.clientWidth || innerWidth;
    const h = host.clientHeight || innerHeight;
    const pr = Math.min(devicePixelRatio || 1, 2);
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);
    material.uniforms.uPixelRatio.value = pr;
    camera.aspect = w / h;

    const portrait = w / h < 0.9;
    orient.rotation.z = portrait ? -Math.PI / 2 : 0;
    // Landscape: nudge the scene right, clear of the title and captions.
    orient.position.set(portrait ? 0 : 1.1, portrait ? -0.6 : 0, 0);
    // Fit ~16 world units along the flow direction.
    const halfSpan = 8.2;
    const tanHalf = Math.tan((camera.fov * Math.PI) / 360);
    const dist = portrait ? halfSpan / tanHalf : halfSpan / (tanHalf * camera.aspect);
    camera.position.set(0, 0, Math.max(dist, 12));
    camera.updateProjectionMatrix();
  };

  const render = (now: number): void => {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    shown += (goal - shown) * Math.min(1, dt * 6);
    material.uniforms.uProgress.value = shown;
    material.uniforms.uTime.value = now / 1000;
    tilt.rotation.y += (target.x * 0.5 - 0.38 - tilt.rotation.y) * Math.min(1, dt * 3);
    tilt.rotation.x += (0.48 + target.y * 0.25 - tilt.rotation.x) * Math.min(1, dt * 3);
    renderer.render(scene, camera);
  };

  const setActive = (active: boolean): void => {
    if (active === running) return;
    running = active;
    last = performance.now();
    renderer.setAnimationLoop(active ? render : null);
  };

  resize();
  render(performance.now());

  return {
    setProgress: (p) => {
      goal = p;
    },
    setActive,
    resize,
    dispose: () => {
      setActive(false);
      removeEventListener("pointermove", onMove);
      points.geometry.dispose();
      material.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
