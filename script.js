(() => {
  const C = window.NINE;
  const $ = (id) => document.getElementById(id);
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const heartPath = "M12 21s-7.5-4.6-9.5-9.2C1.2 8.6 3 5.5 6.2 5.5c2 0 3.4 1.1 4.3 2.5.3.4.9.4 1.2 0 .9-1.4 2.3-2.5 4.3-2.5 3.2 0 5 3.1 3.7 6.3C19.5 16.4 12 21 12 21z";

  /* ── Fill text from content.js ── */
  $("herName").textContent = C.herName;
  $("tagline").textContent = C.heroTagline;
  $("greeting").textContent = C.letterGreeting;
  $("signoff").textContent = C.letterSignoff;
  $("signature").textContent = C.letterSignature;
  $("closing").textContent = C.closingLine;
  $("yourName").textContent = C.yourName;
  document.title = `Nine Months · ${C.herName}`;

  const body = $("letterBody");
  C.letter.forEach((t) => {
    const p = document.createElement("p");
    p.className = "para";
    p.textContent = t;
    body.appendChild(p);
  });

  /* ── Counter ── */
  const start = new Date(C.startDate + "T00:00:00");
  const pad = (n) => String(n);
  const tick = () => {
    let s = Math.max(0, Math.floor((Date.now() - start) / 1000));
    $("cDays").textContent = pad(Math.floor(s / 86400));
    $("cHours").textContent = pad(Math.floor((s % 86400) / 3600));
    $("cMin").textContent = pad(Math.floor((s % 3600) / 60));
    $("cSec").textContent = pad(s % 60);
  };
  tick();
  setInterval(tick, 1000);

  /* ── Timeline ── */
  const tl = $("timeline");
  C.months.forEach((m) => {
    const li = document.createElement("li");
    li.innerHTML = '<div class="tl-card"><h3></h3><p></p></div>';
    li.querySelector("h3").textContent = m.title;
    li.querySelector("p").textContent = m.text;
    tl.appendChild(li);
  });

  /* ── Gallery ── */
  const grid = $("galleryGrid");
  C.gallery.forEach((g, i) => {
    const b = document.createElement("button");
    b.className = "tile";
    b.style.setProperty("--r", ((i % 5) - 2) * 1.1 + "deg");
    b.style.setProperty("--tr", ((i % 3) - 1) * 4 + "deg");
    b.setAttribute("aria-label", `${g.type === "video" ? "Play video" : "View photo"}: ${g.caption}`);
    const thumb = g.type === "video" ? g.poster : g.src;
    b.innerHTML =
      '<span class="tape" aria-hidden="true"></span><div class="frame"><img loading="lazy" decoding="async" alt=""></div><div class="cap"></div>';
    const img = b.querySelector("img");
    img.src = thumb;
    img.alt = g.caption;
    b.querySelector(".cap").textContent = g.caption;
    if (g.type === "video") {
      b.querySelector(".frame").insertAdjacentHTML(
        "beforeend",
        '<div class="play"><span><svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg></span></div>'
      );
    }
    b.addEventListener("click", () => openLb(i));
    grid.appendChild(b);
  });

  /* ── Lightbox ── */
  const lb = $("lightbox"), stage = $("lbStage");
  let cur = 0, lastFocus = null;
  const show = (i) => {
    cur = (i + C.gallery.length) % C.gallery.length;
    const g = C.gallery[cur];
    stage.innerHTML = "";
    let el;
    if (g.type === "video") {
      el = document.createElement("video");
      el.src = g.src; el.poster = g.poster;
      el.controls = true; el.autoplay = true; el.playsInline = true;
    } else {
      el = document.createElement("img");
      el.src = g.src; el.alt = g.caption;
    }
    const cap = document.createElement("figcaption");
    cap.textContent = g.caption;
    stage.append(el, cap);
  };
  function openLb(i) {
    lastFocus = document.activeElement;
    lb.hidden = false;
    document.body.style.overflow = "hidden";
    show(i);
    $("lbClose").focus();
  }
  function closeLb() {
    lb.hidden = true;
    stage.innerHTML = "";
    document.body.style.overflow = "";
    lastFocus && lastFocus.focus();
  }
  $("lbClose").onclick = closeLb;
  $("lbPrev").onclick = () => show(cur - 1);
  $("lbNext").onclick = () => show(cur + 1);
  lb.addEventListener("click", (e) => { if (e.target === lb) closeLb(); });
  addEventListener("keydown", (e) => {
    if (lb.hidden) return;
    if (e.key === "Escape") closeLb();
    if (e.key === "ArrowLeft") show(cur - 1);
    if (e.key === "ArrowRight") show(cur + 1);
  });
  let sx = 0;
  lb.addEventListener("touchstart", (e) => (sx = e.touches[0].clientX), { passive: true });
  lb.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - sx;
    if (Math.abs(dx) > 60) show(cur + (dx < 0 ? 1 : -1));
  });

  /* ── Scroll reveal ── */
  const io = new IntersectionObserver(
    (entries) => entries.forEach((en) => {
      if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
    }),
    { threshold: 0.15, rootMargin: "0px 0px -6% 0px" }
  );
  document.querySelectorAll(".reveal, .timeline li, .tile").forEach((el, i) => {
    if (el.classList.contains("tile")) el.style.transitionDelay = (i % 4) * 90 + "ms";
    io.observe(el);
  });

  /* ── Envelope → letter ── */
  const env = $("envelope"), paper = $("paper");
  env.addEventListener("click", () => {
    if (env.classList.contains("open")) return;
    env.classList.add("open");
    env.setAttribute("aria-expanded", "true");
    burst(innerWidth / 2, env.getBoundingClientRect().top + 60, 26);
    setTimeout(() => {
      paper.hidden = false;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        paper.classList.add("show");
        paper.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
        const parts = paper.querySelectorAll(".para, .signoff, .signature");
        parts.forEach((p, i) => setTimeout(() => p.classList.add("in"), reduce ? 0 : 700 + i * 650));
      }));
    }, reduce ? 0 : 900);
  });

  /* ── Falling petals + hearts (canvas) ── */
  const cv = $("petals"), ctx = cv.getContext("2d");
  let W, H, dpr;
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    W = innerWidth; H = innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  resize(); addEventListener("resize", resize);

  const heart = new Path2D(heartPath);
  const colors = ["#f9a8d4", "#f472b6", "#fbcfe8", "#ec4899", "#fda4af"];
  const mk = (initial) => ({
    x: Math.random() * W, y: initial ? Math.random() * H : -30,
    s: 8 + Math.random() * 16, vy: 0.4 + Math.random() * 0.9, vx: 0,
    sw: Math.random() * Math.PI * 2, sws: 0.008 + Math.random() * 0.015,
    r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.03,
    c: colors[(Math.random() * colors.length) | 0], a: 0.35 + Math.random() * 0.5,
    kind: Math.random() < 0.45 ? "heart" : "petal",
  });
  const N = Math.min(34, Math.round(W / 40));
  const parts = reduce ? [] : Array.from({ length: N }, () => mk(true));
  const bursts = [];

  function burst(x, y, n = 40) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, v = 3 + Math.random() * 7;
      bursts.push({
        x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 4, s: 10 + Math.random() * 16,
        r: Math.random() * 6.28, vr: (Math.random() - 0.5) * 0.2,
        c: colors[(Math.random() * colors.length) | 0], a: 1,
      });
    }
  }
  $("confettiBtn").addEventListener("click", (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    burst(r.left + r.width / 2, r.top, 70);
  });

  const drawHeart = (p, scale) => {
    ctx.save();
    ctx.translate(p.x, p.y); ctx.rotate(p.r); ctx.scale(scale, scale); ctx.translate(-12, -12);
    ctx.fill(heart);
    ctx.restore();
  };
  function frame() {
    ctx.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.sw += p.sws; p.x += Math.sin(p.sw) * 0.6; p.y += p.vy; p.r += p.vr;
      if (p.y > H + 30) Object.assign(p, mk(false), { x: Math.random() * W });
      ctx.globalAlpha = p.a; ctx.fillStyle = p.c;
      if (p.kind === "heart") drawHeart(p, p.s / 24);
      else {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.beginPath(); ctx.ellipse(0, 0, p.s * 0.5, p.s * 0.3, 0, 0, 6.28); ctx.fill();
        ctx.restore();
      }
    }
    for (let i = bursts.length - 1; i >= 0; i--) {
      const p = bursts[i];
      p.vy += 0.22; p.x += p.vx; p.y += p.vy; p.vx *= 0.985; p.r += p.vr; p.a -= 0.008;
      if (p.a <= 0) { bursts.splice(i, 1); continue; }
      ctx.globalAlpha = p.a; ctx.fillStyle = p.c;
      drawHeart(p, p.s / 24);
    }
    ctx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }
  frame();
})();
