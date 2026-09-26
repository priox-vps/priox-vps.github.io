/* ============================================================================
   dm-module.js — Verhalten der Rhythmusbrecher auf deal-makers.de
   ----------------------------------------------------------------------------
   Inhalt

     0  Werkzeug + Grundschalter (--dm-vw)
     1  Zahlen-Band          zählt einmal hoch
     2  Gesprächsverlauf     Blasen erscheinen nacheinander, mit Tippindikator
     3  Vorher/Nachher       Schieber steuert clip-path
     4  Haftender Ablauf     Schritt in Bildmitte wird hervorgehoben
     5  Zitatband            Goldlinie wächst von oben nach unten
     6  CTA-Leiste           erscheint ab 40 %, verschwindet am Abschluss-CTA

   OBERSTES GESETZ
   ---------------
   Der CSS-Grundzustand ist der fertige Zustand. Alle Startwerte für
   Bewegungen setzt ausschließlich diese Datei zur Laufzeit als Inline-Style
   und nimmt sie danach wieder zurück. Ohne JavaScript bleibt jeder Baustein
   vollständig lesbar.

   Stil: ES5. var, function, keine Pfeilfunktionen, kein let/const.
   Keine Abhängigkeit zu dm-effects.js — beide Dateien laufen unabhängig.
   ========================================================================= */

(function (win) {
  "use strict";

  var doc = win.document;
  if (!doc) return;

  /* ------------------------------------------------------------------ 0 */

  var EASE = "cubic-bezier(.16,.86,.24,1)";

  function slowDown() {
    if (!win.matchMedia) return false;
    var mq = win.matchMedia("(prefers-reduced-motion: reduce)");
    return !!(mq && mq.matches);
  }

  var SLOW = slowDown();
  var HAS_IO = typeof win.IntersectionObserver === "function";

  function list(sel, root) {
    var nodes = (root || doc).querySelectorAll(sel);
    var out = [];
    for (var i = 0; i < nodes.length; i++) out.push(nodes[i]);
    return out;
  }

  /* Klassen immer über classList schalten: bei SVG-Elementen ist className
     nur lesbar, eine Zuweisung würde im strict mode werfen. */
  function hasClass(el, name) {
    if (el.classList) return el.classList.contains(name);
    return (" " + el.className + " ").indexOf(" " + name + " ") > -1;
  }

  function addClass(el, name) {
    if (el.classList) { el.classList.add(name); return; }
    if (!hasClass(el, name)) el.className = (el.className + " " + name).replace(/^\s+/, "");
  }

  function dropClass(el, name) {
    if (el.classList) { el.classList.remove(name); return; }
    el.className = (" " + el.className + " ").replace(" " + name + " ", " ").replace(/^\s+|\s+$/g, "");
  }

  /* Einmal-Beobachter: feuert je Element genau einmal. Liegt der Baustein
     beim Laden schon im Bild, feuert er sofort. Ohne IntersectionObserver
     läuft der Ablauf direkt los. */
  function once(el, fn, margin) {
    if (!HAS_IO) { fn(el); return; }
    var io = new win.IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) continue;
        io.unobserve(entries[i].target);
        io.disconnect();
        fn(entries[i].target);
      }
    }, { threshold: 0, rootMargin: margin || "0px 0px -18% 0px" });
    io.observe(el);
  }

  /* Echte Fensterbreite ohne Scrollleiste. 100vw rechnet die Leiste mit und
     würde das randabfallende Zahlen-Band überlaufen lassen. */
  function fullWidth() {
    function apply() {
      var w = doc.documentElement.clientWidth;
      if (w > 0) doc.documentElement.style.setProperty("--dm-vw", w + "px");
    }
    apply();
    var tick = null;
    win.addEventListener("resize", function () {
      if (tick) win.clearTimeout(tick);
      tick = win.setTimeout(apply, 80);
    });
    win.addEventListener("orientationchange", apply);
  }

  /* ------------------------------------------------------------------ 1
     Zahlen-Band. Die Zahl steht im HTML bereits auf ihrem Endwert und
     trägt ihn zusätzlich in data-dm-to. Ohne JS bleibt sie einfach stehen. */

  function bands() {
    var nodes = list("[data-dm-band]");
    if (!nodes.length || SLOW) return;

    for (var i = 0; i < nodes.length; i++) {
      once(nodes[i], runBand);
    }
  }

  function runBand(band) {
    var cells = list(".dm-band__count", band);
    for (var i = 0; i < cells.length; i++) {
      countUp(cells[i], parseInt(cells[i].getAttribute("data-dm-to"), 10), 900, i * 90);
    }
  }

  function countUp(el, target, dur, wait) {
    if (isNaN(target)) return;
    var end = String(target);
    var t0 = null;

    function frame(now) {
      if (t0 === null) t0 = now;
      var p = (now - t0) / dur;
      if (p > 1) p = 1;
      var eased = 1 - Math.pow(1 - p, 3);
      el.textContent = String(Math.round(target * eased));
      if (p < 1) win.requestAnimationFrame(frame);
      else el.textContent = end;
    }

    win.setTimeout(function () {
      el.textContent = "0";
      win.requestAnimationFrame(frame);
    }, wait || 0);
  }

  /* ------------------------------------------------------------------ 2
     Gesprächsverlauf. Beide Spalten laufen gleichzeitig los. Vor jeder
     Blase des Gegenübers steht 700 ms ein Tippindikator. */

  function talks() {
    var nodes = list("[data-dm-talk]");
    if (!nodes.length || SLOW) return;

    for (var i = 0; i < nodes.length; i++) {
      prepTalk(nodes[i]);
      once(nodes[i], runTalk, "0px 0px -12% 0px");
    }
  }

  function prepTalk(talk) {
    var items = list(".dm-talk__b, .dm-talk__end", talk);
    for (var i = 0; i < items.length; i++) {
      items[i].style.opacity = "0";
      items[i].style.transform = "translateY(14px)";
    }
  }

  function showBubble(el) {
    el.style.transition = "opacity 420ms " + EASE + ", transform 420ms " + EASE;
    el.style.opacity = "1";
    el.style.transform = "translateY(0px)";
    win.setTimeout(function () {
      el.style.removeProperty("transition");
      el.style.removeProperty("opacity");
      el.style.removeProperty("transform");
    }, 520);
  }

  function typingDots(warm) {
    var box = doc.createElement("div");
    box.className = "dm-talk__typing";
    box.setAttribute("aria-hidden", "true");
    for (var i = 0; i < 3; i++) box.appendChild(doc.createElement("i"));
    if (warm) box.setAttribute("data-warm", "1");
    return box;
  }

  function runTalk(talk) {
    var cols = list(".dm-talk__col", talk);
    for (var c = 0; c < cols.length; c++) runTalkCol(cols[c]);
  }

  function runTalkCol(col) {
    var items = list(".dm-talk__b", col);
    var endLine = col.querySelector(".dm-talk__end");
    var warm = hasClass(col, "dm-talk__col--warm");
    var t = 120;

    for (var i = 0; i < items.length; i++) {
      var el = items[i];
      if (hasClass(el, "dm-talk__b--them")) {
        planTyping(el, col, warm, t);
        t += 700 + 240;
      } else {
        planPlain(el, t);
        t += 240;
      }
    }

    if (endLine) planPlain(endLine, t + 120);
  }

  function planPlain(el, at) {
    win.setTimeout(function () { showBubble(el); }, at);
  }

  function planTyping(el, col, warm, at) {
    win.setTimeout(function () {
      var dots = typingDots(warm);
      if (el.parentNode) el.parentNode.insertBefore(dots, el);
      win.setTimeout(function () {
        if (dots.parentNode) dots.parentNode.removeChild(dots);
        showBubble(el);
      }, 700);
    }, at);
  }

  /* ------------------------------------------------------------------ 3
     Vorher/Nachher-Schieber. Der Griff ist ein echtes <input type="range">
     mit step="5" — damit bewegen die Pfeiltasten ihn um 5 Prozent. */

  function sliders() {
    var nodes = list("[data-dm-vgl]");
    for (var i = 0; i < nodes.length; i++) wireSlider(nodes[i]);
  }

  function wireSlider(fig) {
    var range = fig.querySelector(".dm-vgl__range");
    if (!range) return;

    function apply() {
      fig.style.setProperty("--dm-vgl", range.value + "%");
      range.setAttribute("aria-valuetext", range.value + " Prozent Liste, " + (100 - range.value) + " Prozent nach Anlass");
    }

    range.addEventListener("input", apply);
    range.addEventListener("change", apply);
    apply();

    /* Am Handy reagiert ein natives <input type="range"> nur, wenn der Finger
       genau den Griff trifft — auf iPhones springt es beim Tippen daneben gar
       nicht. Deshalb bedienen wir den Schieber zusaetzlich selbst: ueberall
       auf der Buehne wischen oder tippen. Senkrechtes Wischen bleibt Scrollen,
       darum entscheidet die erste Bewegungsrichtung, wer die Geste bekommt. */
    var stage = fig.querySelector(".dm-vgl__stage");
    if (!stage || !win.PointerEvent) return;

    // Ab hier bedienen wir Maus und Finger selbst; das Eingabefeld bleibt
    // nur noch fuer Tabulator und Pfeiltasten zustaendig.
    addClass(fig, "dm-vgl--zeiger");

    var pid = null, sx = 0, sy = 0, aktiv = false;

    function setzeAusX(x) {
      var r = stage.getBoundingClientRect();
      if (!r.width) return;
      var p = Math.round(((x - r.left) / r.width) * 100);
      if (p < 0) p = 0;
      if (p > 100) p = 100;
      if (String(p) === String(range.value)) return;
      range.value = p;
      apply();
    }

    stage.addEventListener("pointerdown", function (e) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      pid = e.pointerId; sx = e.clientX; sy = e.clientY; aktiv = false;
    });

    stage.addEventListener("pointermove", function (e) {
      if (e.pointerId !== pid) return;
      if (!aktiv) {
        var dx = Math.abs(e.clientX - sx), dy = Math.abs(e.clientY - sy);
        if (dx < 5) return;            // Richtung noch nicht erkennbar
        if (dy > dx) { pid = null; return; }   // der Finger scrollt, nicht schiebt
        aktiv = true;
        try { stage.setPointerCapture(pid); } catch (err) {}
      }
      setzeAusX(e.clientX);
      if (e.cancelable) e.preventDefault();
    });

    function ende(e) {
      if (e.pointerId !== pid) return;
      var getippt = !aktiv && e.type === "pointerup" &&
        Math.abs(e.clientX - sx) < 5 && Math.abs(e.clientY - sy) < 5;
      if (getippt) setzeAusX(e.clientX);   // kurzes Antippen springt an die Stelle
      if (aktiv) { try { stage.releasePointerCapture(pid); } catch (err) {} }
      // Wer eben geschoben hat, soll direkt mit den Pfeiltasten feinjustieren
      // koennen. Nach einer Zeigergeste zeigt der Browser keinen Fokusrahmen.
      if (aktiv || getippt) { try { range.focus({ preventScroll: true }); } catch (err) {} }
      pid = null; aktiv = false;
    }

    stage.addEventListener("pointerup", ende);
    stage.addEventListener("pointercancel", ende);
  }

  /* ------------------------------------------------------------------ 4
     Haftender Ablauf. Der Schritt in der Bildmitte wird hell, die Grafik
     hebt gleichzeitig ihr passendes Teil hervor. Ohne JS bleibt alles hell. */

  function pins() {
    var nodes = list("[data-dm-pin]");
    if (!nodes.length || SLOW || !HAS_IO) return;

    for (var i = 0; i < nodes.length; i++) wirePin(nodes[i]);
  }

  function wirePin(pin) {
    var steps = list("[data-dm-pin-step]", pin);
    if (steps.length < 2) return;

    addClass(pin, "dm-pin--on");
    markStep(pin, steps, steps[0]);

    var io = new win.IntersectionObserver(function (entries) {
      for (var i = 0; i < entries.length; i++) {
        if (!entries[i].isIntersecting) continue;
        markStep(pin, steps, entries[i].target);
      }
    }, { rootMargin: "-45% 0px -45% 0px", threshold: 0 });

    for (var s = 0; s < steps.length; s++) io.observe(steps[s]);
  }

  function markStep(pin, steps, active) {
    for (var i = 0; i < steps.length; i++) {
      if (steps[i] === active) addClass(steps[i], "is-on");
      else dropClass(steps[i], "is-on");
    }

    var want = active.getAttribute("data-dm-pin-step");
    var parts = list("[data-dm-pin-part]", pin);
    for (var p = 0; p < parts.length; p++) {
      var key = parts[p].getAttribute("data-dm-pin-part");
      if (want === "all" || key === want) addClass(parts[p], "is-on");
      else dropClass(parts[p], "is-on");
    }
  }

  /* ------------------------------------------------------------------ 5
     Zitatband. Die Goldlinie wächst von oben nach unten. */

  function quotes() {
    var nodes = list("[data-dm-zitat]");
    if (!nodes.length || SLOW) return;

    for (var i = 0; i < nodes.length; i++) {
      var bar = nodes[i].querySelector(".dm-zitat__bar");
      if (!bar) continue;
      bar.style.transform = "scaleY(0.001)";
      once(nodes[i], growBar, "0px 0px -10% 0px");
    }
  }

  function growBar(zitat) {
    var bar = zitat.querySelector(".dm-zitat__bar");
    if (!bar) return;
    bar.style.transition = "transform 700ms " + EASE;
    bar.style.transform = "scaleY(1)";
    win.setTimeout(function () {
      bar.style.removeProperty("transition");
      bar.style.removeProperty("transform");
    }, 820);
  }

  /* ------------------------------------------------------------------ 6
     CTA-Leiste. Erscheint ab 40 % Scrolltiefe, verschwindet sobald der
     echte Abschluss-CTA der Seite im Bild ist, und bleibt nach dem
     Schließen für die Sitzung weg. Kein Cookie, kein localStorage,
     keine Zählung. */

  function stickyCta() {
    var body = doc.body;
    if (!body) return;

    var line = body.getAttribute("data-dm-cta");
    var href = body.getAttribute("data-dm-cta-href");
    var label = body.getAttribute("data-dm-cta-label");
    var endSel = body.getAttribute("data-dm-cta-end");
    if (!line || !href || !label) return;

    if (readClosed()) return;

    /* Auf sehr kurzen Seiten gibt es nichts zu begleiten. */
    if (doc.documentElement.scrollHeight < win.innerHeight * 1.8) return;

    var bar = doc.createElement("div");
    bar.className = "dm-cta";
    bar.setAttribute("role", "complementary");
    bar.setAttribute("aria-label", "Kurzer Weg zum Erstgespräch");

    var txt = doc.createElement("p");
    txt.className = "dm-cta__text";
    txt.appendChild(doc.createTextNode(line));

    var btn = doc.createElement("a");
    btn.className = "dm-cta__btn";
    btn.setAttribute("href", href);
    btn.appendChild(doc.createTextNode(label));

    var close = doc.createElement("button");
    close.className = "dm-cta__close";
    close.setAttribute("type", "button");
    close.setAttribute("aria-label", "Leiste schließen");
    close.appendChild(doc.createTextNode("×"));

    bar.appendChild(txt);
    bar.appendChild(btn);
    bar.appendChild(close);

    /* Startzustand: unten aus dem Bild geschoben. Wird hier gesetzt, nicht
       im Stylesheet — ohne JS existiert die Leiste gar nicht. */
    bar.style.opacity = "0";
    bar.style.transform = "translateY(150%)";
    bar.setAttribute("aria-hidden", "true");
    body.appendChild(bar);

    var shown = false;
    var closed = false;
    var atEnd = false;
    var queued = false;

    function liftOverBanner() {
      var cc = doc.getElementById("cookie-hinweis");
      var h = 0;
      if (cc && !cc.hasAttribute("hidden")) {
        var r = cc.getBoundingClientRect();
        if (r.height > 1) h = Math.round(r.height);
      }
      doc.documentElement.style.setProperty("--dm-cta-bottom", h + "px");
    }

    function show() {
      if (shown) return;
      shown = true;
      liftOverBanner();
      bar.removeAttribute("aria-hidden");
      bar.style.transform = "translateY(0px)";
      bar.style.opacity = "1";
    }

    function hide() {
      if (!shown) return;
      shown = false;
      bar.setAttribute("aria-hidden", "true");
      bar.style.transform = "translateY(150%)";
      bar.style.opacity = "0";
    }

    function depth() {
      var h = doc.documentElement.scrollHeight - win.innerHeight;
      if (h <= 0) return 0;
      var y = win.pageYOffset || doc.documentElement.scrollTop || 0;
      return y / h;
    }

    function judge() {
      queued = false;
      if (closed) return;
      if (!atEnd && depth() >= 0.4) show();
      else hide();
    }

    function onScroll() {
      if (queued) return;
      queued = true;
      win.requestAnimationFrame(judge);
    }

    close.addEventListener("click", function () {
      closed = true;
      hide();
      writeClosed();
      win.setTimeout(function () {
        if (bar.parentNode) bar.parentNode.removeChild(bar);
      }, 400);
    });

    win.addEventListener("scroll", onScroll, false);
    win.addEventListener("resize", function () { liftOverBanner(); onScroll(); }, false);

    var endEl = endSel ? doc.querySelector(endSel) : null;
    if (endEl && HAS_IO) {
      var io = new win.IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i++) {
          /* War der echte Abschluss-CTA einmal im Bild, bleibt die Leiste weg.
             Sonst käme sie über dem Fußbereich noch einmal hoch. */
          if (entries[i].isIntersecting) atEnd = true;
        }
        onScroll();
      }, { threshold: 0, rootMargin: "0px 0px -10% 0px" });
      io.observe(endEl);
    }

    /* Der Cookie-Hinweis hat Vorrang: solange er offen ist, sitzt die
       Leiste über ihm. Wird er geschlossen, rutscht sie nach unten. */
    var cc = doc.getElementById("cookie-hinweis");
    if (cc && typeof win.MutationObserver === "function") {
      var mo = new win.MutationObserver(function () {
        liftOverBanner();
        /* Der Hinweis fährt ein und ändert dabei noch seine Höhe. */
        win.setTimeout(liftOverBanner, 350);
      });
      mo.observe(cc, { attributes: true, attributeFilter: ["hidden"] });
    }

    liftOverBanner();
    onScroll();
  }

  function readClosed() {
    try {
      return win.sessionStorage && win.sessionStorage.getItem("dmCtaZu") === "1";
    } catch (e) {
      return false;
    }
  }

  function writeClosed() {
    try {
      if (win.sessionStorage) win.sessionStorage.setItem("dmCtaZu", "1");
    } catch (e) {}
  }

  /* ------------------------------------------------------------------ */

  function boot() {
    try { fullWidth(); } catch (e) {}
    try { bands(); } catch (e) {}
    try { talks(); } catch (e) {}
    try { sliders(); } catch (e) {}
    try { pins(); } catch (e) {}
    try { quotes(); } catch (e) {}
    try { stickyCta(); } catch (e) {}
  }

  if (doc.readyState === "loading") {
    doc.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})(window);
