(() => {
  const root = document.documentElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced) root.classList.add("no-motion");
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  /* ---------- fit text to its container width ---------- */
  const fit = () => {
    $$(".fit").forEach((el) => {
      const box = el.parentElement.classList.contains("contact__title") ? el.parentElement : el;
      el.style.fontSize = "100px";
      const range = document.createRange();
      range.selectNodeContents(el);
      const w = range.getBoundingClientRect().width;
      const target = box.clientWidth;
      if (w) el.style.fontSize = `${(100 * target) / w}px`;
    });
  };

  /* ---------- split manifesto into words ---------- */
  const words = [];
  $$("[data-words]").forEach((p) => {
    const parts = p.textContent.trim().split(/\s+/);
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
  let pending = reduced ? [] : $$(".sec-head > *, .row, .spec__row, .honours > div, .contact__grid > *, .toolkit__text, .circle__row, .quote, .cstat, .cta");
  pending.forEach((el, i) => { el.classList.add("rv"); el.style.transitionDelay = `${(i % 3) * 80}ms`; });
  const reveal = () => {
    if (!pending.length) return;
    const edge = innerHeight * 0.92;
    pending = pending.filter((el) => {
      if (el.getBoundingClientRect().top < edge) { el.classList.add("in"); return false; }
      return true;
    });
  };

  /* ---------- pinned chapters ---------- */
  const hero = $(".hero");
  const parallax = $$("[data-parallax]");
  const manifesto = $(".manifesto");
  const numbers = $(".numbers");
  const track = $(".numbers__track");
  const nbar = $(".numbers__bar span");
  const path = $(".path");
  const pline = $(".path__line span");
  const stages = $$(".stage");
  const wide = matchMedia("(min-width: 901px)");

  const progress = (el) => {
    const r = el.getBoundingClientRect();
    const run = r.height - innerHeight;
    return run > 0 ? clamp(-r.top / run) : 0;
  };

  let travel = 0;
  const layout = () => {
    fit();
    if (reduced) return;
    numbers.classList.add("is-pinned");
    travel = track.scrollWidth - innerWidth;
    numbers.style.height = `${innerHeight + travel}px`;
    path.classList.toggle("is-pinned", wide.matches);
    frame();
  };

  const frame = () => {
    if (reduced) return;
    reveal();
    const y = scrollY;

    if (y < hero.offsetHeight) {
      parallax.forEach((el) => {
        const k = +el.dataset.parallax;
        const base = el.classList.contains("hero__img") ? "translateX(-50%) " : "";
        el.style.transform = `${base}translate3d(0, ${y * k}px, 0)`;
      });
    }

    const pm = progress(manifesto);
    const lit = pm * 1.15 * words.length;
    words.forEach((w, i) => { w.style.opacity = 0.14 + 0.86 * clamp(lit - i); });

    const pn = progress(numbers);
    track.style.transform = `translate3d(${-pn * travel}px, 0, 0)`;
    nbar.style.transform = `scaleX(${pn})`;

    if (path.classList.contains("is-pinned")) {
      const pp = clamp(progress(path) * 1.25);
      pline.style.transform = `scaleX(${pp})`;
      stages.forEach((s, i) => s.classList.toggle("on", pp >= i / stages.length + 0.02));
    }
  };

  let ticking = false;
  addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { frame(); ticking = false; });
  }, { passive: true });

  let rt;
  addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(layout, 120); });
  wide.addEventListener?.("change", layout);

  layout();
  if (document.fonts?.ready) document.fonts.ready.then(layout);
  addEventListener("load", layout);

  /* ---------- footer ---------- */
  $("#yr").textContent = new Date().getFullYear();
  const fmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
  const tick = () => ($("#clock").textContent = fmt.format(new Date()));
  tick();
  setInterval(tick, 30000);
})();
