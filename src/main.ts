import type { FlowScene } from "./flow3d";

const root = document.documentElement;
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
if (reduced) root.classList.add("no-motion");

const clamp = (v: number, a = 0, b = 1): number => Math.min(b, Math.max(a, v));
const $ = <T extends Element = HTMLElement>(s: string, c: ParentNode = document) => c.querySelector<T>(s);
const $$ = <T extends Element = HTMLElement>(s: string, c: ParentNode = document) => [...c.querySelectorAll<T>(s)];

/* ---------- fit text to its container width ---------- */
const fit = (): void => {
  $$(".fit").forEach((el) => {
    const parent = el.parentElement;
    const box = parent?.classList.contains("contact__title") ? parent : el;
    el.style.fontSize = "100px";
    const range = document.createRange();
    range.selectNodeContents(el);
    const w = range.getBoundingClientRect().width;
    if (w) el.style.fontSize = `${(100 * box.clientWidth) / w}px`;
  });
};

/* ---------- split manifesto into words ---------- */
const words: HTMLSpanElement[] = [];
$$("[data-words]").forEach((p) => {
  const parts = (p.textContent ?? "").trim().split(/\s+/);
  p.textContent = "";
  parts.forEach((t, i) => {
    const s = document.createElement("span");
    s.className = "w";
    s.textContent = t;
    p.append(s, i < parts.length - 1 ? " " : "");
    words.push(s);
  });
});

/* ---------- reveal on enter ---------- */
const REVEAL =
  ".sec-head > *, .row, .spec__row, .honours > div, .contact__grid > *, .toolkit__text, .circle__row, .quote, .cstat, .cta, .offer, .steps li, .proof__cell, .oss__list li";
let pending: HTMLElement[] = reduced ? [] : $$(REVEAL);
pending.forEach((el, i) => {
  el.classList.add("rv");
  el.style.transitionDelay = `${(i % 3) * 80}ms`;
});
const reveal = (): void => {
  if (!pending.length) return;
  const edge = innerHeight * 0.92;
  pending = pending.filter((el) => {
    if (el.getBoundingClientRect().top < edge) {
      el.classList.add("in");
      return false;
    }
    return true;
  });
};

/* ---------- elements ---------- */
const hero = $(".hero");
const parallax = $$("[data-parallax]");
const manifesto = $(".manifesto");
const numbers = $(".numbers");
const track = $(".numbers__track");
const nbar = $(".numbers__bar span");
const path = $(".path");
const pline = $(".path__line span");
const stages = $$(".stage");
const flow = $(".flow");
const flowStage = $(".flow__stage");
const flowCaps = $$(".flow__cap");
const wide = matchMedia("(min-width: 901px)");

/** 0 → 1 as a tall pinned section scrolls past. */
const progress = (el: HTMLElement): number => {
  const r = el.getBoundingClientRect();
  const run = r.height - innerHeight;
  return run > 0 ? clamp(-r.top / run) : 0;
};

/* ---------- 3D flow (lazy) ---------- */
const webgl = (() => {
  try {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  } catch {
    return false;
  }
})();
const use3D = !!(flow && flowStage && webgl && !reduced);
if (use3D) flow!.classList.add("is-3d");

let scene: FlowScene | null = null;
let loading = false;
const ensureScene = (): void => {
  if (!use3D || scene || loading) return;
  const r = flow!.getBoundingClientRect();
  if (r.top > innerHeight * 1.6 || r.bottom < -innerHeight) return;
  loading = true;
  import("./flow3d")
    .then(({ createFlowScene }) => {
      scene = createFlowScene(flowStage!);
      if (import.meta.env.DEV) (window as unknown as { __flow: FlowScene }).__flow = scene;
      flow!.classList.add("is-ready");
      frame();
    })
    .catch(() => flow!.classList.remove("is-3d"));
};

/* ---------- layout + frame ---------- */
let travel = 0;
const layout = (): void => {
  fit();
  if (reduced) return;
  if (numbers && track) {
    numbers.classList.add("is-pinned");
    travel = track.scrollWidth - innerWidth;
    numbers.style.height = `${innerHeight + travel}px`;
  }
  path?.classList.toggle("is-pinned", wide.matches);
  scene?.resize();
  frame();
};

function frame(): void {
  if (reduced) return;
  reveal();
  const y = scrollY;

  if (hero && y < hero.offsetHeight) {
    parallax.forEach((el) => {
      const k = Number(el.dataset.parallax);
      const base = el.classList.contains("hero__img") ? "translateX(-50%) " : "";
      el.style.transform = `${base}translate3d(0, ${y * k}px, 0)`;
    });
  }

  if (manifesto) {
    const lit = progress(manifesto) * 1.15 * words.length;
    words.forEach((w, i) => (w.style.opacity = String(0.14 + 0.86 * clamp(lit - i))));
  }

  if (numbers && track && nbar) {
    const pn = progress(numbers);
    track.style.transform = `translate3d(${-pn * travel}px, 0, 0)`;
    nbar.style.transform = `scaleX(${pn})`;
  }

  if (flow && use3D) {
    ensureScene();
    const pf = progress(flow);
    const r = flow.getBoundingClientRect();
    scene?.setActive(r.bottom > 0 && r.top < innerHeight);
    scene?.setProgress(pf);
    flowCaps.forEach((c) => {
      const from = Number(c.dataset.from);
      const to = Number(c.dataset.to);
      c.classList.toggle("on", pf >= from && pf < to);
    });
  }

  if (path && pline && path.classList.contains("is-pinned")) {
    const pp = clamp(progress(path) * 1.25);
    pline.style.transform = `scaleX(${pp})`;
    stages.forEach((s, i) => s.classList.toggle("on", pp >= i / stages.length + 0.02));
  }
}

let ticking = false;
addEventListener(
  "scroll",
  () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      frame();
      ticking = false;
    });
  },
  { passive: true },
);

let rt: number | undefined;
addEventListener("resize", () => {
  clearTimeout(rt);
  rt = window.setTimeout(layout, 120);
});
wide.addEventListener("change", layout);

layout();
document.fonts?.ready.then(layout);
addEventListener("load", layout);

/* ---------- footer ---------- */
const yr = $("#yr");
if (yr) yr.textContent = String(new Date().getFullYear());
const fmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
const clockEl = $("#clock");
const tick = (): void => {
  if (clockEl) clockEl.textContent = fmt.format(new Date());
};
tick();
setInterval(tick, 30_000);
