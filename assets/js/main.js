(() => {
  const root = document.documentElement;
  root.classList.add("js");
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* nav border on scroll */
  const nav = document.querySelector(".nav");
  const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 8);
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* count-up */
  const countUp = (el) => {
    const end = +el.dataset.count;
    if (reduced || !end) return;
    const dur = 1400;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / dur);
      el.textContent = Math.round(end * (1 - Math.pow(1 - p, 3)));
      if (p < 1) requestAnimationFrame(tick);
    };
    el.textContent = "0";
    requestAnimationFrame(tick);
  };

  /* reveal on scroll */
  const io = "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          e.target.classList.add("is-in");
          e.target.querySelectorAll("[data-count]").forEach(countUp);
          io.unobserve(e.target);
        });
      }, { threshold: 0.15, rootMargin: "0px 0px -40px 0px" })
    : null;
  document.querySelectorAll(".reveal").forEach((el, i) => {
    el.style.transitionDelay = `${(i % 4) * 70}ms`;
    io ? io.observe(el) : el.classList.add("is-in");
  });

  /* footer bits */
  document.getElementById("yr").textContent = new Date().getFullYear();
  const clock = document.getElementById("clock");
  const fmt = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" });
  const setClock = () => (clock.textContent = fmt.format(new Date()));
  setClock();
  setInterval(setClock, 30000);

  /* pipeline diagram */
  const mount = document.getElementById("pipeline");
  if (!mount) return;
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs = {}, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  };
  const text = (parent, x, y, str, cls) => {
    const t = el("text", { x, y, "text-anchor": "middle", "dominant-baseline": "middle", class: cls || "" }, parent);
    t.textContent = str;
    return t;
  };
  const curve = (x1, y1, x2, y2) => {
    const mx = (x1 + x2) / 2;
    return `M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2}`;
  };

  const svg = el("svg", { viewBox: "0 0 1200 420", "aria-hidden": "true" });
  const wires = el("g", {}, svg);
  const flows = el("g", {}, svg);
  const nodes = el("g", {}, svg);

  const sources = ["SAP HANA", "Oracle", "SQL Server", "PostgreSQL", "IBM Db2"];
  const sinks = ["Snowflake", "Databricks", "BigQuery", "Redshift"];
  const hub = { x: 410, y: 150, w: 220, h: 120 };
  const ai = { x: 1010, y: 160, w: 170, h: 100 };
  const cy = 210;

  [["SOURCES", 130], ["INGEST", 520], ["PLATFORM", 850], ["AI LAYER", 1095]].forEach(([s, x]) => text(svg, x, 22, s, "col"));

  const box = (x, y, w, h, label, cls, sub) => {
    const g = el("g", { class: `node ${cls || ""}` }, nodes);
    el("rect", { x, y, width: w, height: h, rx: 10 }, g);
    text(g, x + w / 2, y + h / 2 - (sub ? 10 : 0), label);
    if (sub) text(g, x + w / 2, y + h / 2 + 14, sub, "sub");
  };

  const paths = [];
  const addWire = (d) => {
    el("path", { d, class: "wire" }, wires);
    const p = el("path", { d, class: "flowline" }, flows);
    paths.push(p);
  };

  sources.forEach((s, i) => {
    const y = 50 + i * 70;
    box(40, y, 180, 40, s);
    addWire(curve(220, y + 20, hub.x, cy));
  });
  sinks.forEach((s, i) => {
    const y = 64 + i * 84;
    box(760, y, 180, 40, s);
    addWire(curve(hub.x + hub.w, cy, 760, y + 20));
    addWire(curve(940, y + 20, ai.x, cy));
  });
  box(hub.x, hub.y, hub.w, hub.h, "Connector SDK · CDC", "node--hub", "ELT · dbt · data quality");
  box(ai.x, ai.y, ai.w, ai.h, "LLMs · MCP", "node--ai", "");
  text(nodes, ai.x + ai.w / 2, ai.y + ai.h + 22, "ask your data anything", "col");

  if (!reduced) {
    paths.forEach((p, i) => {
      p.id = `fp${i}`;
      const c = el("circle", { r: 3.5, class: "packet" }, flows);
      const m = el("animateMotion", { dur: `${2.2 + ((i * 7) % 9) * 0.2}s`, repeatCount: "indefinite" }, c);
      el("mpath", { href: `#fp${i}` }, m);
    });
  }

  mount.appendChild(svg);
})();
