/*!
 * DM Effects — Interaktionsbibliothek DEALMAKERS
 * Vanilla JS, keine Abhängigkeiten. Läuft auf jeder Seite gleich.
 *
 *   <script src="/js/dm-effects.js" defer></script>
 *
 * Startet selbst bei DOMContentLoaded. Für SPA-Routenwechsel:
 *   DMEffects.destroy(); DMEffects.init();
 *
 * Alle Effekte hängen an data-Attributen — ein Element ohne Attribut
 * wird nicht angefasst. Respektiert prefers-reduced-motion.
 */
(function (global) {
  "use strict";

  var ACCENT = "#B5A55E";
  var EASE = "cubic-bezier(.16,.86,.24,1)";

  /* --- Frühstart (Nachtrag 24.09.2026) -----------------------------
   * Diese paar Zeilen müssen laufen, BEVOR init() startet. Das Skript
   * ist mit defer eingebunden; document.readyState steht dann schon auf
   * "interactive", weshalb init() weiter unten sofort aufgerufen wird
   * und nicht erst bei DOMContentLoaded. Alles andere des Nachtrags
   * steht angehängt am Dateiende im Block "EFFEKTPAKET".
   *
   *   a) .dm-js am <html> blendet den Ladevorhang ein. Ohne JavaScript
   *      bleibt .dm-preloader auf display:none und verdeckt nichts mehr
   *      (Fehlerbehebung Ladevorhang).
   *   b) h1/h2 mit data-dm-split gehören Modul 21. Der Vermerk
   *      data-split-done hält Modul 10 davon ab, dieselbe Überschrift
   *      per textContent="" zu leeren — das würde das rotierende
   *      Goldwort im Hero zerstören. data-dm-reveal fällt weg, damit
   *      Modul 14 die Überschrift nicht ein zweites Mal aufdeckt; ohne
   *      das Attribut ist sie schlicht sichtbar, also im Grundzustand.
   * ---------------------------------------------------------------- */
  document.documentElement.classList.add("dm-js");
  if (document.body) {
    document.querySelectorAll("h1[data-dm-split], h2[data-dm-split]").forEach(function (el) {
      el.dataset.splitDone = "1";
      el.removeAttribute("data-dm-reveal");
      el.setAttribute("data-dm-claimed", "1");
    });
  }

  function DM() {
    this.cleanups = [];
    this.pointer = null;
    this.reduced = false;
    this.started = false;
  }

  DM.prototype.on = function (target, type, fn, opts) {
    target.addEventListener(type, fn, opts);
    this.cleanups.push(function () { target.removeEventListener(type, fn, opts); });
  };

  DM.prototype.every = function (ms, fn) {
    var id = setInterval(fn, ms);
    this.cleanups.push(function () { clearInterval(id); });
    return id;
  };

  DM.prototype.raf = function (fn) {
    var id = requestAnimationFrame(fn);
    this.cleanups.push(function () { cancelAnimationFrame(id); });
    return id;
  };

  /* Drosselt einen Scroll-Handler auf einen Frame */
  DM.prototype.framed = function (fn) {
    var tick = false;
    return function () {
      if (tick) return;
      tick = true;
      requestAnimationFrame(function () { tick = false; fn(); });
    };
  };

  DM.prototype.init = function (opts) {
    if (this.started) return this;
    this.started = true;
    opts = opts || {};
    this.accent = opts.accent || ACCENT;
    this.reduced = global.matchMedia("(prefers-reduced-motion: reduce)").matches;
    this.touch = global.matchMedia("(hover: none)").matches;

    this.preloader();
    this.progressBar();
    this.pointerFx();
    this.dotField();
    this.rotator();
    this.clock();
    this.marquee();
    this.scramble();
    this.odometers();
    this.splitLines();
    this.sweep();
    this.parallax();
    this.cursor();
    this.reveal();
    this.sectionWipes();
    this.phaseProgress();
    this.tiltCards();
    return this;
  };

  DM.prototype.destroy = function () {
    this.cleanups.forEach(function (fn) { try { fn(); } catch (e) {} });
    this.cleanups = [];
    this.started = false;
    return this;
  };

  /* ------------------------------------------------------------------
   * 1. Intro-Vorhang
   *    <div data-dm-preloader>
   *      <span data-dm-pre-num>00</span>
   *      <div><i data-dm-pre-bar></i></div>
   *    </div>
   *    Zählt 00→100, wischt dann nach oben weg. Inhalt liegt im DOM,
   *    also für Suchmaschinen unsichtbar verzögert — kein SEO-Nachteil.
   * ---------------------------------------------------------------- */
  DM.prototype.preloader = function () {
    var el = document.querySelector("[data-dm-preloader]");
    if (!el) return;
    var self = this;
    var num = el.querySelector("[data-dm-pre-num]");
    var bar = el.querySelector("[data-dm-pre-bar]");
    var dur = this.reduced ? 1 : 1250;
    var t0 = performance.now();

    function drop() {
      if (el.dataset.gone) return;
      el.dataset.gone = "1";
      var done = function () { el.style.display = "none"; };
      if (self.reduced || !el.animate) return done();
      var a = el.animate(
        [{ transform: "translateY(0)" }, { transform: "translateY(-101%)" }],
        { duration: 900, easing: "cubic-bezier(.76,0,.24,1)", fill: "forwards" }
      );
      a.onfinish = done;
      setTimeout(done, 1200);
    }

    (function step(now) {
      var p = Math.min(1, (now - t0) / dur);
      var e = 1 - Math.pow(1 - p, 2.2);
      var v = Math.round(e * 100);
      if (num) num.textContent = v < 10 ? "0" + v : String(v);
      if (bar) bar.style.width = (e * 100).toFixed(1) + "%";
      if (p < 1) requestAnimationFrame(step); else drop();
    })(performance.now());

    setTimeout(drop, dur + 700); // Sicherheitsnetz
  };

  /* ------------------------------------------------------------------
   * 2. Lesefortschritt
   *    <div style="position:fixed;top:0;left:0;right:0;height:2px">
   *      <div data-dm-progress></div>
   *    </div>
   * ---------------------------------------------------------------- */
  DM.prototype.progressBar = function () {
    var bar = document.querySelector("[data-dm-progress]");
    if (!bar) return;
    var run = this.framed(function () {
      var h = document.documentElement;
      var max = h.scrollHeight - h.clientHeight;
      var p = max > 0 ? Math.min(1, Math.max(0, h.scrollTop / max)) : 0;
      bar.style.width = (p * 100).toFixed(2) + "%";
    });
    this.on(global, "scroll", run, { passive: true });
    run();
  };

  /* ------------------------------------------------------------------
   * 3. Spotlight, das dem Zeiger nachläuft + magnetische Elemente
   *    <div data-dm-glow></div>            (position:fixed, radial-gradient)
   *    <a data-dm-magnetic>…</a>
   *    Magnetismus greift NUR, solange der Zeiger auf dem Element liegt —
   *    Anziehung aus der Ferne fühlt sich zäh an.
   * ---------------------------------------------------------------- */
  DM.prototype.pointerFx = function () {
    var self = this;
    var glow = document.querySelector("[data-dm-glow]");
    var gx = global.innerWidth / 2, gy = global.innerHeight * 0.4;
    var px = gx, py = gy, raf = null;

    function paint() {
      if (glow) glow.style.transform = "translate3d(" + px.toFixed(1) + "px," + py.toFixed(1) + "px,0)";
    }
    function loop() {
      px += (gx - px) * 0.12;
      py += (gy - py) * 0.12;
      paint();
      raf = (Math.abs(gx - px) > 0.5 || Math.abs(gy - py) > 0.5) ? requestAnimationFrame(loop) : null;
    }
    paint();
    if (glow) glow.style.opacity = "1";

    this.on(global, "pointermove", function (e) {
      self.pointer = { x: e.clientX, y: e.clientY };
      gx = e.clientX; gy = e.clientY;
      if (!raf) raf = requestAnimationFrame(loop);

      var list = document.querySelectorAll("[data-dm-magnetic]");
      for (var i = 0; i < list.length; i++) {
        var el = list[i];
        var r = el.getBoundingClientRect();
        var dx = e.clientX - (r.left + r.width / 2);
        var dy = e.clientY - (r.top + r.height / 2);
        var inside = Math.abs(dx) < r.width / 2 && Math.abs(dy) < r.height / 2;
        if (inside) {
          el.style.transform = "translate(" + (dx * 0.1).toFixed(1) + "px," + (dy * 0.12).toFixed(1) + "px)";
        } else if (el.style.transform) {
          el.style.transform = "";
        }
      }
    }, { passive: true });

    this.cleanups.push(function () {
      if (raf) cancelAnimationFrame(raf);
      document.querySelectorAll("[data-dm-magnetic]").forEach(function (el) { el.style.transform = ""; });
    });
  };

  /* ------------------------------------------------------------------
   * 4. Punkteraster auf Canvas — weicht dem Zeiger aus, Klick wirft Welle
   *    <canvas data-dm-dots></canvas>   (absolut über dem Hero, pointer-events:none)
   *    Canvas 2D statt WebGL: ~3 kB statt ~600 kB, 60 fps auch auf Mittelklasse.
   * ---------------------------------------------------------------- */
  DM.prototype.dotField = function () {
    var cv = document.querySelector("[data-dm-dots]");
    if (!cv || this.reduced) return;
    var self = this;
    var ctx = cv.getContext("2d");
    var w = 0, h = 0, dpr = Math.min(2, global.devicePixelRatio || 1);
    var GAP = 34, R = 1.15, REACH = 165;
    var accent = hexToRgb(this.accent);

    function size() {
      var r = cv.getBoundingClientRect();
      if (!r.width || !r.height) {
        var p = cv.parentElement;
        if (p) r = p.getBoundingClientRect();
      }
      if (!r.width || !r.height) return;
      w = r.width; h = r.height;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    size();
    requestAnimationFrame(size);
    setTimeout(size, 400);
    this.on(global, "resize", size);

    var visible = true;
    if (global.IntersectionObserver) {
      var io = new IntersectionObserver(function (es) { visible = es[0].isIntersecting; });
      io.observe(cv);
      this.cleanups.push(function () { io.disconnect(); });
    }

    var waves = [];
    this.on(global, "pointerdown", function (e) {
      var r = cv.getBoundingClientRect();
      var lx = e.clientX - r.left, ly = e.clientY - r.top;
      if (lx < 0 || ly < 0 || lx > r.width || ly > r.height) return;
      waves.push({ x: lx, y: ly, t0: performance.now() });
      if (waves.length > 4) waves.shift();
    }, { passive: true });

    var t = 0, raf;
    (function draw() {
      raf = requestAnimationFrame(draw);
      if (!visible || !w) return;
      t += 0.006;
      ctx.clearRect(0, 0, w, h);
      var rect = cv.getBoundingClientRect();
      var p = self.pointer;
      var mx = p ? p.x - rect.left : -9999;
      var my = p ? p.y - rect.top : -9999;
      var now = performance.now();

      for (var y = GAP / 2; y < h; y += GAP) {
        for (var x = GAP / 2; x < w; x += GAP) {
          var drift = Math.sin(t + x * 0.014 + y * 0.02) * 2.2;
          var ox = x, oy = y + drift, a = 0.16, rad = R;

          var dx = x - mx, dy = y - my;
          var d = Math.hypot(dx, dy);
          if (d < REACH) {
            var f = 1 - d / REACH;
            var push = f * f * 26;
            ox += (dx / (d || 1)) * push;
            oy += (dy / (d || 1)) * push;
            a = 0.16 + f * 0.75;
            rad = R + f * 1.5;
          }

          for (var wi = 0; wi < waves.length; wi++) {
            var wv = waves[wi];
            var age = (now - wv.t0) / 1000;
            if (age > 1.6) continue;
            var ring = age * 620;
            var dd = Math.hypot(x - wv.x, y - wv.y);
            var band = Math.abs(dd - ring);
            if (band < 70) {
              var k = (1 - band / 70) * (1 - age / 1.6);
              a = Math.min(1, a + k * 0.85);
              rad += k * 2.1;
              ox += ((x - wv.x) / (dd || 1)) * k * 14;
              oy += ((y - wv.y) / (dd || 1)) * k * 14;
            }
          }

          ctx.beginPath();
          ctx.arc(ox, oy, rad, 0, 6.2832);
          ctx.fillStyle = "rgba(" + accent + "," + a.toFixed(3) + ")";
          ctx.fill();
        }
      }
    })();
    this.cleanups.push(function () { cancelAnimationFrame(raf); });
  };

  /* ------------------------------------------------------------------
   * 5. Wechselndes Wort in der Headline
   *    <span data-dm-rotator='["Zufallsumsatz.","Bauchgefühl."]'>Zufallsumsatz.</span>
   *    Elternelement braucht overflow:hidden.
   *    Wichtig: alte Animationen vor jeder neuen abbrechen, sonst stapeln
   *    sich fill:forwards-Animationen und das Wort verschwindet irgendwann.
   * ---------------------------------------------------------------- */
  DM.prototype.rotator = function () {
    var el = document.querySelector("[data-dm-rotator]");
    if (!el) return;
    el.style.opacity = "1";
    el.style.transform = "none";
    if (this.reduced) return;

    var words;
    try { words = JSON.parse(el.getAttribute("data-dm-rotator")); } catch (e) { words = null; }
    if (!words || !words.length) return;

    var i = 0;
    function clear() { if (el.getAnimations) el.getAnimations().forEach(function (a) { a.cancel(); }); }
    function rest() { el.style.transform = "translateY(0)"; el.style.opacity = "1"; }
    rest();

    this.every(2900, function () {
      i = (i + 1) % words.length;
      if (!el.animate) { el.textContent = words[i]; return; }
      clear();
      var out = el.animate(
        [{ transform: "translateY(0)", opacity: 1 }, { transform: "translateY(-105%)", opacity: 0 }],
        { duration: 420, easing: "cubic-bezier(.7,0,.3,1)" }
      );
      out.onfinish = function () {
        clear();
        el.textContent = words[i];
        var inn = el.animate(
          [{ transform: "translateY(105%)", opacity: 0 }, { transform: "translateY(0)", opacity: 1 }],
          { duration: 560, easing: EASE }
        );
        inn.onfinish = function () { clear(); rest(); };
        setTimeout(function () { clear(); rest(); }, 700);
      };
      setTimeout(function () {
        if (el.textContent !== words[i]) { clear(); el.textContent = words[i]; rest(); }
      }, 900);
    });
  };

  /* ------------------------------------------------------------------
   * 6. Ortszeit — signalisiert „hier sitzt jemand"
   *    <span data-dm-clock data-tz="Europe/Berlin" data-city="München"
   *          data-suffix="Antwort < 1 Werktag"></span>
   * ---------------------------------------------------------------- */
  DM.prototype.clock = function () {
    var el = document.querySelector("[data-dm-clock]");
    if (!el) return;
    var tz = el.getAttribute("data-tz") || "Europe/Berlin";
    var city = el.getAttribute("data-city") || "München";
    var suffix = el.getAttribute("data-suffix") || "";
    function fmt() {
      var s = new Intl.DateTimeFormat("de-DE", {
        timeZone: tz, hour: "2-digit", minute: "2-digit"
      }).format(new Date());
      el.textContent = city + " " + s + (suffix ? " · " + suffix : "");
    }
    fmt();
    this.every(20000, fmt);
  };

  /* ------------------------------------------------------------------
   * 7. Laufband, dessen Tempo an der Scrollgeschwindigkeit hängt
   *    <div data-dm-marquee>…Inhalt ZWEIMAL hintereinander…</div>
   * ---------------------------------------------------------------- */
  DM.prototype.marquee = function () {
    var el = document.querySelector("[data-dm-marquee]");
    if (!el || this.reduced) return;
    var offset = 0, last = global.scrollY, vel = 0, raf;
    this.on(global, "scroll", function () {
      var y = global.scrollY;
      vel += (y - last) * 0.35;
      last = y;
    }, { passive: true });
    (function loop() {
      raf = requestAnimationFrame(loop);
      var half = el.scrollWidth / 2 || 1;
      offset -= 0.55 + vel * 0.02;
      vel *= 0.92;
      if (offset <= -half) offset += half;
      if (offset > 0) offset -= half;
      el.style.transform = "translate3d(" + offset.toFixed(2) + "px,0,0)";
    })();
    this.cleanups.push(function () { cancelAnimationFrame(raf); });
  };

  /* ------------------------------------------------------------------
   * 8. Buchstaben würfeln beim Hovern
   *    <a data-dm-scramble>Leistungen</a>   (Monospace-Schrift nötig,
   *    sonst springt die Breite)
   * ---------------------------------------------------------------- */
  DM.prototype.scramble = function () {
    if (this.reduced) return;
    var self = this;
    var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#%$&/0123456789";
    document.querySelectorAll("[data-dm-scramble]").forEach(function (el) {
      var orig = el.textContent;
      var raf = null;
      self.on(el, "pointerenter", function () {
        cancelAnimationFrame(raf);
        var t0 = performance.now(), dur = 420;
        (function tick(now) {
          var p = Math.min(1, (now - t0) / dur);
          var lock = Math.floor(orig.length * p);
          var out = "";
          for (var i = 0; i < orig.length; i++) {
            out += i < lock ? orig[i] : chars[(Math.random() * chars.length) | 0];
          }
          el.textContent = out;
          if (p < 1) raf = requestAnimationFrame(tick); else el.textContent = orig;
        })(performance.now());
      });
      self.cleanups.push(function () { cancelAnimationFrame(raf); el.textContent = orig; });
    });
  };

  /* ------------------------------------------------------------------
   * 9. Ziffernrollen für Kennzahlen
   *    <span data-dm-odometer="19"></span>
   *    Jede Ziffer ist eine eigene Walze 0–9, die auf ihren Wert fährt.
   *    Endzustand wird als Inline-Style festgeschrieben (kein fill:forwards).
   * ---------------------------------------------------------------- */
  DM.prototype.odometers = function () {
    var self = this;
    document.querySelectorAll("[data-dm-odometer]").forEach(function (host) {
      var target = String(parseInt(host.getAttribute("data-dm-odometer"), 10) || 0);
      if (host.dataset.odoVal === target && host.children.length) return;
      host.dataset.odoVal = target;
      host.textContent = "";
      host.style.display = "inline-flex";

      target.split("").forEach(function (d, idx) {
        var col = document.createElement("span");
        col.style.cssText = "display:block;overflow:hidden;height:1em;line-height:1";
        var reel = document.createElement("span");
        reel.style.cssText = "display:block;will-change:transform";
        for (var n = 0; n <= 9; n++) {
          var cell = document.createElement("span");
          cell.style.cssText = "display:block;height:1em;line-height:1;font-variant-numeric:tabular-nums";
          cell.textContent = String(n);
          reel.appendChild(cell);
        }
        col.appendChild(reel);
        host.appendChild(col);

        var to = "translateY(" + (-parseInt(d, 10)) + "em)";
        reel.style.transform = to;
        if (self.reduced || !reel.animate) return;
        var dur = 1100 + idx * 160, delay = 1700 + idx * 90;
        reel.animate([{ transform: "translateY(1em)" }, { transform: to }],
          { duration: dur, delay: delay, easing: EASE });
        setTimeout(function () { reel.style.transform = to; }, delay + dur + 150);
      });
    });
  };

  /* ------------------------------------------------------------------
   * 10. Headline buchstabenweise
   *     <span data-dm-split="1500">Planbarer</span>   (Wert = Startverzögerung ms)
   *     Elternelement braucht overflow:hidden.
   * ---------------------------------------------------------------- */
  DM.prototype.splitLines = function () {
    var self = this;
    document.querySelectorAll("[data-dm-split]").forEach(function (el) {
      if (el.dataset.splitDone) return;
      el.dataset.splitDone = "1";
      var base = parseInt(el.getAttribute("data-dm-split"), 10) || 0;
      var text = el.textContent;
      el.textContent = "";

      text.split("").forEach(function (ch, i) {
        var sp = document.createElement("span");
        sp.textContent = ch === " " ? "\u00A0" : ch;
        sp.style.cssText = "display:inline-block;will-change:transform";
        if (self.reduced) { el.appendChild(sp); return; }
        sp.style.transform = "translateY(110%) rotate(6deg)";
        sp.style.opacity = "0";
        el.appendChild(sp);
        var delay = base + i * 28;
        if (sp.animate) {
          sp.animate(
            [{ transform: "translateY(110%) rotate(6deg)", opacity: 0 },
             { transform: "translateY(0) rotate(0deg)", opacity: 1 }],
            { duration: 820, delay: delay, easing: EASE, fill: "forwards" }
          );
        }
        // Endzustand hart setzen, damit nichts hängen bleibt
        setTimeout(function () { sp.style.transform = "none"; sp.style.opacity = "1"; }, delay + 900);
      });
    });
  };

  /* ------------------------------------------------------------------
   * 11. Lichtstreif über die Headline
   *     <span data-dm-sweep></span>  (absolut in der H1, mix-blend-mode:overlay)
   * ---------------------------------------------------------------- */
  DM.prototype.sweep = function () {
    var el = document.querySelector("[data-dm-sweep]");
    if (!el || this.reduced || !el.animate) return;
    function run() {
      el.getAnimations().forEach(function (a) { a.cancel(); });
      var a = el.animate(
        [{ transform: "translateX(-60%) skewX(-14deg)", opacity: 0 },
         { transform: "translateX(60%) skewX(-14deg)", opacity: 0.85, offset: 0.5 },
         { transform: "translateX(230%) skewX(-14deg)", opacity: 0 }],
        { duration: 1500, easing: "cubic-bezier(.4,0,.2,1)" }
      );
      a.onfinish = function () { el.style.opacity = "0"; a.cancel(); };
    }
    setTimeout(run, 2500);
    this.every(9000, run);
  };

  /* ------------------------------------------------------------------
   * 12. Parallax im Hero
   *     <div data-dm-ghost>…großes Umrisswort…</div>   horizontal
   *     <div data-dm-hero-inner>…Inhalt…</div>          vertikal + Ausblenden
   * ---------------------------------------------------------------- */
  DM.prototype.parallax = function () {
    if (this.reduced) return;
    var ghost = document.querySelector("[data-dm-ghost]");
    var inner = document.querySelector("[data-dm-hero-inner]");
    if (!ghost && !inner) return;
    var run = this.framed(function () {
      var y = global.scrollY;
      if (y > global.innerHeight * 1.3) return;
      if (ghost) ghost.style.transform = "translate3d(" + (-y * 0.5 - 40).toFixed(1) + "px,0,0)";
      if (inner) {
        inner.style.transform = "translate3d(0," + (y * 0.16).toFixed(1) + "px,0)";
        inner.style.opacity = String(Math.max(0, 1 - y / (global.innerHeight * 0.85)));
      }
    });
    this.on(global, "scroll", run, { passive: true });
    run();
  };

  /* ------------------------------------------------------------------
   * 13. Eigener Zeigerring
   *     <div data-dm-cursor></div>  (fixed, 36px, border, pointer-events:none)
   *     Der Systemcursor bleibt sichtbar — Ring nur als Ergänzung.
   * ---------------------------------------------------------------- */
  DM.prototype.cursor = function () {
    var cur = document.querySelector("[data-dm-cursor]");
    if (!cur || this.reduced || this.touch) return;
    var x = 0, y = 0, cx = 0, cy = 0, scale = 1, raf;
    (function loop() {
      cx += (x - cx) * 0.22;
      cy += (y - cy) * 0.22;
      cur.style.transform = "translate3d(" + cx.toFixed(1) + "px," + cy.toFixed(1) + "px,0) scale(" + scale + ")";
      raf = requestAnimationFrame(loop);
    })();
    this.cleanups.push(function () { cancelAnimationFrame(raf); });
    this.on(global, "pointermove", function (e) {
      x = e.clientX; y = e.clientY;
      cur.style.opacity = "1";
      var t = e.target.closest("a,button,input,[data-dm-magnetic]");
      scale = t ? 1.9 : 1;
      cur.style.background = t ? "rgba(181,165,94,0.16)" : "transparent";
    }, { passive: true });
    this.on(document, "pointerleave", function () { cur.style.opacity = "0"; });
  };

  /* ------------------------------------------------------------------
   * 14. Enthüllung beim Scrollen
   *     <h2 data-dm-reveal="head">…</h2>     zeilenweise per clip-path
   *     <div data-dm-reveal>…</div>          steigt von unten auf
   *     data-dm-stagger="2" staffelt innerhalb einer Gruppe.
   *
   *     WICHTIG: Sichtbarkeit nie allein vom Observer abhängig machen.
   *     Ein Intervall-Wächter deckt alles auf, was im Viewport steht —
   *     sonst bleiben Inhalte nach Hot-Reload oder Resize für immer weg.
   * ---------------------------------------------------------------- */
  DM.prototype.reveal = function () {
    var nodes = document.querySelectorAll("[data-dm-reveal]");
    if (!nodes.length) return;

    function show(el) {
      el.dataset.revDone = "1";
      el.style.opacity = "1";
      el.style.transform = "none";
      el.style.clipPath = "none";
    }
    if (this.reduced || !global.IntersectionObserver) {
      nodes.forEach(show);
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        var el = en.target;
        el.style.transitionDelay = (el.dataset.revDelay || "0") + "ms";
        el.dataset.revDone = "1";
        el.style.opacity = "1";
        el.style.transform = "none";
        el.style.clipPath = "inset(0 0 -10% 0)";
        setTimeout(function () { if (el.dataset.revDone) el.style.clipPath = "none"; }, 1100);
        io.unobserve(el);
      });
    }, { threshold: 0.15, rootMargin: "0px 0px -6% 0px" });
    this.cleanups.push(function () { io.disconnect(); });

    nodes.forEach(function (el) {
      var stagger = parseInt(el.getAttribute("data-dm-stagger") || "0", 10);
      el.dataset.revDelay = String(Math.min(stagger, 6) * 80);
      el.style.willChange = "transform,opacity";
      el.style.transition =
        "opacity .85s " + EASE + ",transform .85s " + EASE + ",clip-path .95s " + EASE;

      var r = el.getBoundingClientRect();
      if (r.top < global.innerHeight && r.bottom > 0) { show(el); return; }

      if (el.getAttribute("data-dm-reveal") === "head") {
        el.style.opacity = "0";
        el.style.clipPath = "inset(0 0 100% 0)";
        el.style.transform = "translateY(26px)";
      } else {
        el.style.opacity = "0";
        el.style.transform = "translateY(30px)";
      }
      io.observe(el);
    });

    var guardSweep = function () {
      nodes.forEach(function (el) {
        if (el.dataset.revDone) return;
        var r = el.getBoundingClientRect();
        if (r.top < global.innerHeight * 1.05 && r.bottom > -50) show(el);
      });
    };
    this.on(global, "scroll", guardSweep, { passive: true });
    this.every(1200, guardSweep);
    this.cleanups.push(function () { nodes.forEach(show); });
  };

  /* ------------------------------------------------------------------
   * 15. Sektionen schieben sich übereinander statt hart zu schneiden
   *     <section data-dm-wipe>…</section>   (nutzen für Farbwechsel
   *     dunkel → hell; clip-path von oben)
   * ---------------------------------------------------------------- */
  DM.prototype.sectionWipes = function () {
    if (this.reduced) return;
    var list = document.querySelectorAll("[data-dm-wipe]");
    if (!list.length) return;
    list.forEach(function (sec) {
      sec.style.willChange = "clip-path";
      sec.style.clipPath = "inset(0 0 0 0)";
    });
    var run = this.framed(function () {
      var vh = global.innerHeight;
      list.forEach(function (sec) {
        var r = sec.getBoundingClientRect();
        if (r.top > vh || r.bottom < 0) return;
        var enter = Math.min(1, Math.max(0, (vh - r.top) / (vh * 0.42)));
        var e = 1 - Math.pow(1 - enter, 3);
        sec.style.clipPath = "inset(" + ((1 - e) * 22).toFixed(2) + "% 0 0 0)";
      });
    });
    this.on(global, "scroll", run, { passive: true });
    run();
  };

  /* ------------------------------------------------------------------
   * 16. Fortschrittslinie auf Karten
   *     <article data-dm-phase-card>
   *       <span data-dm-phase-line></span>   position:absolute;top:0;left:0;height:2px;width:0
   *     </article>
   *     Die Linie MUSS im Markup stehen, nicht per JS eingehängt —
   *     sonst überlebt sie kein Re-Render eines Frameworks.
   * ---------------------------------------------------------------- */
  DM.prototype.phaseProgress = function () {
    if (this.reduced) return;
    var cards = document.querySelectorAll("[data-dm-phase-card]");
    if (!cards.length) return;
    var run = this.framed(function () {
      var mid = global.innerHeight * 0.62;
      cards.forEach(function (c) {
        var line = c.querySelector("[data-dm-phase-line]");
        if (!line) return;
        var r = c.getBoundingClientRect();
        line.style.width = (r.top < mid && r.bottom > 0) ? "100%" : "0%";
      });
    });
    this.on(global, "scroll", run, { passive: true });
    this.on(global, "resize", run);
    run();
    this.every(1000, run);
  };

  /* ------------------------------------------------------------------
   * 17. Karten neigen sich zum Zeiger
   *     <section data-dm-tilt-scope>
   *       <article data-dm-phase-card>…</article>
   *     </section>
   *     Delegierter Listener auf dem Container — überlebt Re-Renders.
   * ---------------------------------------------------------------- */
  DM.prototype.tiltCards = function () {
    if (this.reduced || this.touch) return;
    var self = this;
    document.querySelectorAll("[data-dm-tilt-scope]").forEach(function (scope) {
      var current = null;
      function reset(card) {
        if (!card) return;
        card.style.transition = "transform .5s " + EASE + ",background .35s ease,border-color .35s ease";
        card.style.transform = "none";
      }
      self.on(scope, "pointermove", function (e) {
        var card = e.target.closest("[data-dm-phase-card]");
        if (!card) { reset(current); current = null; return; }
        if (card !== current) { reset(current); current = card; }
        var r = card.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5;
        var py = (e.clientY - r.top) / r.height - 0.5;
        card.style.transition = "transform .12s linear,background .35s ease,border-color .35s ease";
        card.style.transform =
          "perspective(900px) rotateY(" + (px * 5).toFixed(2) + "deg) rotateX(" +
          (-py * 5).toFixed(2) + "deg) translateZ(6px)";
      }, { passive: true });
      self.on(scope, "pointerleave", function () { reset(current); current = null; });
    });
  };

  /* Hilfsfunktion */
  function hexToRgb(hex) {
    var m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex || "");
    return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)].join(",") : "181,165,94";
  }

  var instance = new DM();
  global.DMEffects = instance;

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { instance.init(); });
  } else {
    instance.init();
  }
})(window);

/* ======================================================================
 * 18 — Schaustück: scrollgekoppelte Zeitachse "So läuft der Start."
 *
 * Eigenständiges Modul, hängt an keiner Funktion oben drüber. Es setzt
 * am Wurzelelement [data-dm-timeline] zur Laufzeit data-dm-timeline="on";
 * erst dadurch greifen die Bewegungsregeln in dm-effects.css. Ohne
 * JavaScript passiert nichts — die Zeitachse steht dann fertig gezeichnet
 * und in voller Deckkraft da.
 *
 * Kopplung: Der Fortschritt wird in jedem Frame neu aus
 * getBoundingClientRect() berechnet (nie aufsummiert, deshalb driftet
 * nichts und Sprünge per Ankerlink stimmen sofort). Ein Wert zwischen 0
 * und 1 wird auf die drei Streckenabschnitte verteilt und je Abschnitt als
 * CSS-Variable --dm-tl-f geschrieben; CSS macht daraus scaleX bzw. scaleY.
 * Kein Pinning, kein Eingriff ins Scrollen, nur transform und opacity.
 * ====================================================================== */
(function (global) {
  "use strict";

  var ATTR = "data-dm-timeline";
  var START_AT = 0.90;   /* Elementoberkante bei 90 % Fensterhöhe: Start */
  var END_AT = 0.62;     /* Elementunterkante bei 62 % Fensterhöhe: Ende  */
  var MAX_OVER = 0.45;   /* Deckel für sehr hohe Elemente (Handy)         */
  var LEAD = 0.92;       /* Ziffernkreis leuchtet kurz vor Abschnittsende */

  function boot() {
    var root = document.querySelector("[" + ATTR + "]");
    if (!root) return;

    /* Ältere Browser oder Bewegungsreduktion: Endzustand stehen lassen. */
    if (!global.requestAnimationFrame || !global.matchMedia) return;
    if (!global.CSS || !global.CSS.supports || !global.CSS.supports("--dm-tl-f", "0")) return;
    if (global.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    var steps = [].slice.call(root.querySelectorAll("[data-dm-tl-step]"));
    if (steps.length < 2) return;

    var fills = [].slice.call(root.querySelectorAll(".dm-tl__fill"));
    var segs = Math.max(1, steps.length - 1);
    var seg = 1 / segs;

    var from = 0, to = 1, last = -1, lastOn = -1;

    function clamp(v) { return v < 0 ? 0 : (v > 1 ? 1 : v); }

    function measure() {
      var r = root.getBoundingClientRect();
      var vh = global.innerHeight || document.documentElement.clientHeight || 800;
      from = vh * START_AT;
      to = Math.max(vh * END_AT - r.height, vh * -MAX_OVER);
      if (to >= from) to = from - 1;
      last = -1;
      lastOn = -1;
      update();
    }

    function apply(p) {
      if (p !== last) {
        last = p;
        for (var i = 0; i < fills.length; i++) {
          var f = clamp((p - i * seg) / seg);
          fills[i].style.setProperty("--dm-tl-f", f.toFixed(3));
        }
      }
      /* Zahl der erreichten Schritte */
      var n = 1;
      for (var k = 1; k < steps.length; k++) {
        if (p >= k * seg * LEAD) n = k + 1;
      }
      if (n === lastOn) return;
      lastOn = n;
      for (var s = 0; s < steps.length; s++) {
        steps[s].classList.toggle("is-on", s < n);
      }
    }

    function update() {
      var top = root.getBoundingClientRect().top;
      apply(clamp((from - top) / (from - to)));
    }

    var framed = (function () {
      var tick = false;
      return function () {
        if (tick) return;
        tick = true;
        global.requestAnimationFrame(function () { tick = false; update(); });
      };
    })();

    root.setAttribute(ATTR, "on");
    measure();

    var onScroll = framed;
    var onResize = function () { measure(); };
    global.addEventListener("scroll", onScroll, { passive: true });
    global.addEventListener("resize", onResize, { passive: true });
    global.addEventListener("orientationchange", onResize, { passive: true });

    /* Schriften laden nach — danach stimmt die Höhe erst wirklich. */
    var t1 = global.setTimeout(measure, 300);
    var t2 = global.setTimeout(measure, 1500);
    if (document.fonts && document.fonts.ready && document.fonts.ready.then) {
      document.fonts.ready.then(measure).catch(function () {});
    }

    /* An den vorhandenen Aufräummechanismus anhängen, falls vorhanden. */
    if (global.DMEffects && global.DMEffects.cleanups) {
      global.DMEffects.cleanups.push(function () {
        global.removeEventListener("scroll", onScroll);
        global.removeEventListener("resize", onResize);
        global.removeEventListener("orientationchange", onResize);
        global.clearTimeout(t1);
        global.clearTimeout(t2);
        root.setAttribute(ATTR, "");
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window);

/* ======================================================================
 * EFFEKTPAKET 24.09.2026 — Module 19–22
 *
 *   19  Grundschalter .dm-js + Anspruch auf die Überschriften
 *   20  Partikelfeld hinter der Seite (A)
 *   21  Überschriften ziehen zeichenweise ein (B)
 *   22  Magnetische Schaltflächen + Lichtkante auf Karten (D)
 *
 * Eigene Kapselung, damit der Block oben nichts anfasst. Vanilla JS,
 * keine Abhängigkeit, keine externe Ressource, kein fetch.
 *
 * GRUNDSATZ: Ohne dieses Skript ist die Seite fertig und vollständig
 * sichtbar. Jeder Startzustand einer Animation (opacity 0, Versatz,
 * Drehung) wird hier zur Laufzeit gesetzt — nie im Stylesheet.
 * ==================================================================== */
(function (global) {
  "use strict";

  var doc = global.document;
  var root = doc.documentElement;
  var EASE_OUT = "cubic-bezier(0.16, 1, 0.3, 1)";
  var GOLD = "201, 186, 119";

  function reducedMotion() {
    return !!(global.matchMedia && global.matchMedia("(prefers-reduced-motion: reduce)").matches);
  }
  function finePointer() {
    return !!(global.matchMedia && global.matchMedia("(pointer: fine)").matches) &&
           !(global.matchMedia && global.matchMedia("(hover: none)").matches);
  }
  function addCleanup(fn) {
    if (global.DMEffects && global.DMEffects.cleanups) global.DMEffects.cleanups.push(fn);
  }
  /* rAF-Drossel: mehrere Zeigerereignisse pro Bild ergeben eine Rechnung. */
  function framed(fn) {
    var tick = false;
    return function () {
      if (tick) return;
      tick = true;
      global.requestAnimationFrame(function () { tick = false; fn(); });
    };
  }

  /* ------------------------------------------------------------------
   * 19. Liste der beanspruchten Überschriften
   *
   * Der eigentliche Anspruch wird ganz oben im Frühstart angemeldet —
   * er muss vor init() stehen, sonst kommt Modul 10 zuerst an die
   * Überschrift. Hier wird nur eingesammelt, was dort vermerkt wurde;
   * der zweite Durchlauf ist die Rückfallebene, falls das Skript einmal
   * ohne defer eingebunden wird.
   * ---------------------------------------------------------------- */
  var claimed = [];
  (function collect() {
    root.classList.add("dm-js");
    if (!doc.body) return;
    var heads = doc.querySelectorAll("h1[data-dm-split], h2[data-dm-split]");
    for (var i = 0; i < heads.length; i++) {
      heads[i].dataset.splitDone = "1";
      heads[i].removeAttribute("data-dm-reveal");
      claimed.push(heads[i]);
    }
  })();

  /* ------------------------------------------------------------------
   * 20. Partikelfeld (Aufgabe A)
   *
   * Ein festes Canvas hinter der ganzen Seite: feiner Staub aus weißen
   * und goldenen Punkten, langsame Drift, Zeiger-Parallaxe (max 12 px)
   * und ein weicher Goldschein am Zeiger.
   *
   * Sparsamkeit: 90 Punkte ab 1024 px, sonst 40. Nur eine Zeichnung pro
   * Bild, Pixelverhältnis bei 2 gedeckelt, Pause sobald der Reiter in
   * den Hintergrund geht. Grobe Zeiger (Touch) bekommen keine Reaktion.
   * ---------------------------------------------------------------- */
  function field() {
    if (reducedMotion()) return;
    if (!doc.body || doc.querySelector(".dm-field")) return;

    var cv = doc.createElement("canvas");
    cv.className = "dm-field";
    cv.setAttribute("aria-hidden", "true");
    var ctx = cv.getContext && cv.getContext("2d");
    if (!ctx) return;
    doc.body.insertBefore(cv, doc.body.firstChild);

    var fine = finePointer();
    var w = 0, h = 0, dpr = 1, dots = [], raf = 0, running = false;
    var t0 = global.performance && global.performance.now ? global.performance.now() : Date.now();

    /* Zeigerzustand: Ziel (px/py) und gedämpfter Istwert (cx/cy). */
    var px = 0, py = 0, cx = 0, cy = 0, glow = 0, glowTo = 0;

    function build() {
      var r = Math.max(1, Math.min(2, global.devicePixelRatio || 1));
      w = global.innerWidth;
      h = global.innerHeight;
      dpr = r;
      cv.width = Math.round(w * r);
      cv.height = Math.round(h * r);
      ctx.setTransform(r, 0, 0, r, 0, 0);

      var n = w >= 1024 ? 90 : 40;
      dots = [];
      for (var i = 0; i < n; i++) {
        var gold = Math.random() < 0.32;
        dots.push({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 0.5 + Math.random() * 1.3,                 /* 0,5–1,8 px   */
          a: 0.15 + Math.random() * 0.5,                /* 0,15–0,65    */
          vx: (Math.random() - 0.5) * 0.10,             /* träge Drift  */
          vy: -0.04 - Math.random() * 0.12,             /* leicht nach oben */
          ph: Math.random() * 6.283,                    /* Flimmerphase */
          fq: 0.0004 + Math.random() * 0.0008,
          d: 0.35 + Math.random() * 0.65,               /* Parallaxentiefe */
          c: gold ? GOLD : "255, 255, 255"
        });
      }
    }

    function draw(now) {
      raf = 0;
      var t = (now || 0) - t0;

      /* Dämpfung 0,06 — der Versatz läuft dem Zeiger weich hinterher. */
      cx += (px - cx) * 0.06;
      cy += (py - cy) * 0.06;
      glow += (glowTo - glow) * 0.06;

      ctx.clearRect(0, 0, w, h);

      for (var i = 0; i < dots.length; i++) {
        var p = dots[i];
        p.x += p.vx;
        p.y += p.vy;
        if (p.y < -4) { p.y = h + 4; p.x = Math.random() * w; }
        if (p.x < -4) p.x = w + 4;
        else if (p.x > w + 4) p.x = -4;

        var a = p.a * (0.72 + 0.28 * Math.sin(t * p.fq + p.ph));
        ctx.globalAlpha = a < 0 ? 0 : a;
        ctx.fillStyle = "rgb(" + p.c + ")";
        ctx.beginPath();
        ctx.arc(p.x + cx * p.d, p.y + cy * p.d, p.r, 0, 6.283185);
        ctx.fill();
      }

      /* Goldschein am Zeiger — Spitzenwert 0,10, Radius 320 px. */
      if (fine && glow > 0.01) {
        var gx = px + w / 2, gy = py + h / 2;
        var g = ctx.createRadialGradient(gx, gy, 0, gx, gy, 320);
        g.addColorStop(0, "rgba(" + GOLD + ", " + (0.10 * glow).toFixed(3) + ")");
        g.addColorStop(0.55, "rgba(" + GOLD + ", " + (0.035 * glow).toFixed(3) + ")");
        g.addColorStop(1, "rgba(" + GOLD + ", 0)");
        ctx.globalAlpha = 1;
        ctx.fillStyle = g;
        ctx.fillRect(gx - 320, gy - 320, 640, 640);
      }

      ctx.globalAlpha = 1;
      if (running) raf = global.requestAnimationFrame(draw);
    }

    function start() {
      if (running) return;
      running = true;
      if (!raf) raf = global.requestAnimationFrame(draw);
    }
    function stop() {
      running = false;
      if (raf) { global.cancelAnimationFrame(raf); raf = 0; }
    }

    var onMove = null, onLeave = null;
    if (fine) {
      /* Rohwerte im Ereignis, Rechnung im Bild — so bleibt die Drossel. */
      var rawX = 0, rawY = 0;
      var apply = framed(function () {
        var mx = (rawX / global.innerWidth - 0.5) * 2;   /* -1 … 1 */
        var my = (rawY / global.innerHeight - 0.5) * 2;
        px = mx * 12;                                    /* max 12 px */
        py = my * 12;
        glowTo = 1;
      });
      onMove = function (e) { rawX = e.clientX; rawY = e.clientY; apply(); };
      onLeave = function () { glowTo = 0; px = 0; py = 0; };
      doc.addEventListener("pointermove", onMove, { passive: true });
      doc.addEventListener("pointerleave", onLeave, { passive: true });
    }

    var onResize = (function () {
      var id = 0;
      return function () {
        global.clearTimeout(id);
        id = global.setTimeout(build, 180);
      };
    })();
    var onVis = function () { if (doc.hidden) stop(); else start(); };

    global.addEventListener("resize", onResize, { passive: true });
    global.addEventListener("orientationchange", onResize, { passive: true });
    doc.addEventListener("visibilitychange", onVis);

    build();
    if (!doc.hidden) start();

    addCleanup(function () {
      stop();
      global.removeEventListener("resize", onResize);
      global.removeEventListener("orientationchange", onResize);
      doc.removeEventListener("visibilitychange", onVis);
      if (onMove) doc.removeEventListener("pointermove", onMove);
      if (onLeave) doc.removeEventListener("pointerleave", onLeave);
      if (cv.parentNode) cv.parentNode.removeChild(cv);
    });
  }

  /* ------------------------------------------------------------------
   * 21. Überschriften ziehen zeichenweise ein (Aufgabe B)
   *
   * Zerlegung erst zur Laufzeit: im Quelltext steht der normale Satz.
   * Wörter bleiben als Einheit zusammen (.dm-word, nowrap), damit der
   * Zeilenumbruch stimmt. Vorhandene Kindelemente — etwa die Maske mit
   * dem rotierenden Goldwort — werden NICHT zerlegt, sondern als ein
   * Stück mitanimiert.
   *
   * Zugänglichkeit: die Überschrift bekommt ihren ursprünglichen Satz
   * als aria-label, damit Vorlesewerkzeuge nicht Buchstabe für
   * Buchstabe stolpern.
   * ---------------------------------------------------------------- */
  function splitHeads() {
    if (!claimed.length) return;

    /* Kein IntersectionObserver oder Bewegung reduziert: alles bleibt
       so, wie es im Quelltext steht. Der Anspruch aus Modul 19 gilt
       weiter, das alte Modul 14 deckt die h2 wie bisher auf. */
    if (reducedMotion() || !global.IntersectionObserver) return;

    var io = new global.IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        io.unobserve(en.target);
        run(en.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -6% 0px" });

    claimed.forEach(function (el) {
      /* Sicherung gegen abgeschnittene Überschriften: Der Urzustand wird
         gemerkt. Ragt die zerlegte Fassung aus ihrem Kasten - das kann bei
         langen Wörtern auf schmalen Bildschirmen passieren -, wird die
         Zerlegung vollständig zurückgenommen. Eine lesbare Überschrift ist
         mehr wert als ihre Animation. */
      var urzustand = el.innerHTML;
      var hatteLabel = el.hasAttribute("aria-label");
      var parts = carve(el);
      if (!parts.length) return;
      if (el.scrollWidth > el.clientWidth + 1) {
        el.innerHTML = urzustand;
        if (!hatteLabel) el.removeAttribute("aria-label");
        return;
      }
      /* Startzustand — ausschließlich hier, zur Laufzeit. */
      parts.forEach(function (n) {
        n.style.opacity = "0";
        n.style.transform = "translateY(20px) rotateX(-40deg)";
      });
      el.setAttribute("data-dm-split", "on");
      el._dmParts = parts;
      io.observe(el);
    });

    function carve(el) {
      var label = (el.textContent || "").replace(/\s+/g, " ").trim();
      var parts = [];
      var kids = [].slice.call(el.childNodes);

      kids.forEach(function (node) {
        if (node.nodeType === 3) {
          var words = node.nodeValue.split(/(\s+)/);
          var frag = doc.createDocumentFragment();
          words.forEach(function (word) {
            if (!word) return;
            if (/^\s+$/.test(word)) { frag.appendChild(doc.createTextNode(" ")); return; }
            /* Deutsche Komposita brechen am Bindestrich um. Eine Worteinheit
               ist nowrap, also muss dort getrennt werden - sonst steht
               "Neukundenakquise-Agentur:" auf 360 px als ein einziger Block
               und ragt aus dem Kasten. Der Bindestrich bleibt links. */
            var stuecke = [], rest = word, k;
            while (true) {
              k = rest.indexOf("-");
              if (k < 0 || k === rest.length - 1) { stuecke.push(rest); break; }
              stuecke.push(rest.slice(0, k + 1));
              rest = rest.slice(k + 1);
            }
            stuecke.forEach(function (st) {
              if (!st) return;
              /* Sehr lange Wörter gar nicht zerlegen: einzeln gesetzte
                 Buchstaben werden spürbar breiter und haben keine
                 Umbruchstelle mehr, der Rand schneidet sie dann ab.
                 Lesbarkeit geht vor Animation. */
              if (st.length > 14) { frag.appendChild(doc.createTextNode(st)); return; }
              var wrap = doc.createElement("span");
              wrap.className = "dm-word";
              for (var i = 0; i < st.length; i++) {
                var ch = doc.createElement("span");
                ch.className = "dm-char";
                ch.textContent = st.charAt(i);
                wrap.appendChild(ch);
                parts.push(ch);
              }
              frag.appendChild(wrap);
            });
          });
          el.replaceChild(frag, node);
        } else if (node.nodeType === 1) {
          /* Leere Hilfselemente (Lichtstreif) nicht animieren. */
          if (!(node.textContent || "").trim()) return;
          node.classList.add("dm-piece");
          parts.push(node);
        }
      });

      if (parts.length && label) el.setAttribute("aria-label", label);
      return parts;
    }

    function run(el) {
      var parts = el._dmParts || [];
      parts.forEach(function (n, i) {
        var delay = i * 15;
        var from = { opacity: 0, transform: "translateY(20px) rotateX(-40deg)" };
        var to = { opacity: 1, transform: "translateY(0) rotateX(0deg)" };
        if (n.animate) {
          n.animate([from, to], { duration: 600, delay: delay, easing: EASE_OUT, fill: "both" });
        }
        /* Endzustand hart nachziehen — nichts darf unsichtbar hängen. */
        global.setTimeout(function () {
          n.style.opacity = "1";
          n.style.transform = "none";
          n.style.willChange = "auto";
        }, delay + 660);
      });
    }

    addCleanup(function () {
      io.disconnect();
      claimed.forEach(function (el) {
        (el._dmParts || []).forEach(function (n) {
          n.style.opacity = "1";
          n.style.transform = "none";
        });
      });
    });
  }

  /* ------------------------------------------------------------------
   * 22. Magnet und Lichtkante (Aufgabe D)
   *
   * Schaltflächen mit data-dm-magnet ziehen den Zeiger im Umkreis von
   * 90 px an, höchstens 8 px weit, und federn danach zurück. Der
   * Versatz wandert über zwei Rechenwerte (--dm-mx/--dm-my) ins
   * Stylesheet, damit die vorhandene Hover-Anhebung erhalten bleibt.
   *
   * Karten bekommen die vorhandene Glanzfläche .dm-sweep (Modul 11) in
   * einer zweiten Füllung: ein goldener Lichtfleck, der dem Zeiger
   * folgt. Kein neues Bauteil, nur ein Modifikator.
   *
   * Beides nur bei feinem Zeiger und nur ohne Bewegungsreduktion.
   * ---------------------------------------------------------------- */
  function pointerPlay() {
    if (reducedMotion() || !finePointer() || !doc.body) return;

    /* --- Magnet ---------------------------------------------------- */
    var mags = [].slice.call(doc.querySelectorAll("[data-dm-magnet]"));
    var boxes = [];
    var RADIUS = 90, MAX = 8;
    var mx = -9999, my = -9999;

    function measure() {
      boxes = mags.map(function (el) {
        var r = el.getBoundingClientRect();
        return { el: el, x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height };
      });
    }

    var pull = framed(function () {
      for (var i = 0; i < boxes.length; i++) {
        var b = boxes[i];
        var dx = mx - b.x, dy = my - b.y;
        /* Umkreis = halbe Schaltfläche plus 90 px Fangbereich. */
        var reach = RADIUS + Math.max(b.w, b.h) / 2;
        var dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < reach) {
          var k = (1 - dist / reach) * MAX;
          var len = dist || 1;
          b.el.style.setProperty("--dm-mx", (dx / len * k).toFixed(2) + "px");
          b.el.style.setProperty("--dm-my", (dy / len * k).toFixed(2) + "px");
          b.el.setAttribute("data-dm-magnet", "on");
        } else if (b.el.getAttribute("data-dm-magnet") === "on") {
          b.el.setAttribute("data-dm-magnet", "");
          b.el.style.setProperty("--dm-mx", "0px");
          b.el.style.setProperty("--dm-my", "0px");
        }
      }
    });

    var onMove = function (e) { mx = e.clientX; my = e.clientY; pull(); };
    var onScroll = framed(measure);

    if (mags.length) {
      measure();
      doc.addEventListener("pointermove", onMove, { passive: true });
      global.addEventListener("scroll", onScroll, { passive: true });
      global.addEventListener("resize", onScroll, { passive: true });
    }

    /* --- Lichtkante auf Karten ------------------------------------- */
    var cards = [].slice.call(doc.querySelectorAll("[data-dm-phase-card]"));
    var cardCleanups = [];

    cards.forEach(function (card) {
      if (card.querySelector(".dm-sweep--pointer")) return;
      var shine = doc.createElement("i");
      shine.className = "dm-sweep dm-sweep--pointer";
      shine.setAttribute("aria-hidden", "true");
      card.appendChild(shine);

      var sx = 50, sy = 50;
      var paint = framed(function () {
        shine.style.setProperty("--dm-sx", sx.toFixed(1) + "%");
        shine.style.setProperty("--dm-sy", sy.toFixed(1) + "%");
      });
      var move = function (e) {
        var r = card.getBoundingClientRect();
        if (!r.width || !r.height) return;
        sx = ((e.clientX - r.left) / r.width) * 100;
        sy = ((e.clientY - r.top) / r.height) * 100;
        paint();
      };
      var enter = function (e) { move(e); shine.style.opacity = "1"; };
      var leave = function () { shine.style.opacity = "0"; };

      card.addEventListener("pointerenter", enter);
      card.addEventListener("pointermove", move, { passive: true });
      card.addEventListener("pointerleave", leave);
      cardCleanups.push(function () {
        card.removeEventListener("pointerenter", enter);
        card.removeEventListener("pointermove", move);
        card.removeEventListener("pointerleave", leave);
        if (shine.parentNode) shine.parentNode.removeChild(shine);
      });
    });

    addCleanup(function () {
      doc.removeEventListener("pointermove", onMove);
      global.removeEventListener("scroll", onScroll);
      global.removeEventListener("resize", onScroll);
      mags.forEach(function (el) {
        el.setAttribute("data-dm-magnet", "");
        el.style.removeProperty("--dm-mx");
        el.style.removeProperty("--dm-my");
      });
      cardCleanups.forEach(function (fn) { fn(); });
    });
  }

  function boot() {
    try { field(); } catch (e) {}
    try { splitHeads(); } catch (e) {}
    try { pointerPlay(); } catch (e) {}
  }

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window);
