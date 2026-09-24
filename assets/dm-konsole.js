/* ======================================================================
   DEALMAKERS — Signal-Konsole (Verhalten)

   Vanilla, ES5, eigener IIFE. Keine Abhaengigkeit zu dm-effects.js,
   keine Bibliothek, kein Build.

   Grundgesetz H1: Das HTML und das CSS zeigen bereits den fertigen
   Zustand. Dieses Skript setzt erst zur Laufzeit die Startzustaende:

     data-dm-konsole="js"    -> JS ist aktiv (Takt-Hervorhebung, Klicks)
     data-dm-bewegung="an"   -> Bewegung erlaubt (Strahl, Ticker, Cursor)

   Bei prefers-reduced-motion: reduce wird "data-dm-bewegung" nie
   gesetzt, es wird nicht getippt und der Takt wechselt nicht von allein.
   Anklickbar bleiben die Takte trotzdem.

   Das Skript arbeitet je Instanz. Mehrere Konsolen auf einer Seite
   stoeren sich nicht, es gibt keine globalen Einzelvariablen.
   ====================================================================== */

(function () {
  "use strict";

  var TAKT_MS = 5500;     /* automatischer Taktwechsel */
  var PAUSE_MS = 15000;   /* Automatik-Pause nach einem Klick */
  var TIPP_MS = 45;       /* Pause zwischen zwei Tippschritten */
  var TIPP_ZEICHEN = 2;   /* Zeichen je Tippschritt */
  var TIPP_START_MS = 400;
  var VERSTECKT_MS = 400; /* Nachschauintervall, solange der Tab weg ist */

  function jetzt() {
    return (new Date()).getTime();
  }

  function bewegungAus() {
    if (!window.matchMedia) { return false; }
    var mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    return !!(mq && mq.matches);
  }

  function versteckt() {
    return document.hidden === true;
  }

  function initKonsole(block) {
    var takte = block.querySelectorAll(".dm-takt");
    var teile = block.querySelectorAll("[data-dm-teil]");
    var ziel = block.querySelector("[data-dm-tippen]");
    var ruhig = bewegungAus();

    var aktiv = 0;
    var taktTimer = null;
    var pauseBis = 0;

    var tippTimer = null;
    var tippText = "";
    var tippPos = 0;
    var tippGestartet = false;
    var tippBeginn = 0;  /* Zeitpunkt des ersten Zeichens */
    var tippRuhe = 0;    /* Summe der Zeit im Hintergrund */
    var tippPause = 0;   /* Beginn der laufenden Hintergrundpause */

    /* ---- Takt-Hervorhebung + Kopplung mit dem Instrument ------------- */

    function markiere(name) {
      var i;
      for (i = 0; i < teile.length; i++) {
        if (name && teile[i].getAttribute("data-dm-teil") === name) {
          if (teile[i].className.indexOf("is-markiert") < 0) {
            teile[i].className = teile[i].className + " is-markiert";
          }
        } else {
          teile[i].className = teile[i].className
            .replace(/\s*is-markiert/g, "");
        }
      }
    }

    function zeigeTakt(index) {
      var i, ist, kopplung;
      if (!takte.length) { return; }
      if (index < 0) { index = 0; }
      if (index >= takte.length) { index = 0; }
      aktiv = index;
      for (i = 0; i < takte.length; i++) {
        ist = (i === index);
        if (ist && takte[i].className.indexOf("is-aktiv") < 0) {
          takte[i].className = takte[i].className + " is-aktiv";
        } else if (!ist) {
          takte[i].className = takte[i].className.replace(/\s*is-aktiv/g, "");
        }
        takte[i].setAttribute("aria-pressed", ist ? "true" : "false");
      }
      kopplung = takte[index].getAttribute("data-dm-koppelt");
      markiere(kopplung);
    }

    /* ---- Automatiklauf ---------------------------------------------- */

    function planen(ms) {
      if (taktTimer) { window.clearTimeout(taktTimer); taktTimer = null; }
      if (ruhig || takte.length < 2) { return; }
      taktTimer = window.setTimeout(weiter, ms);
    }

    function weiter() {
      var rest;
      taktTimer = null;
      if (versteckt()) { planen(TAKT_MS); return; }
      rest = pauseBis - jetzt();
      if (rest > 0) { planen(rest); return; }
      zeigeTakt((aktiv + 1) % takte.length);
      planen(TAKT_MS);
    }

    function klick(index) {
      return function (ereignis) {
        if (ereignis && ereignis.preventDefault) { ereignis.preventDefault(); }
        pauseBis = jetzt() + PAUSE_MS;
        zeigeTakt(index);
        planen(PAUSE_MS);
      };
    }

    /* ---- Auswertung Zeichen fuer Zeichen ---------------------------- */

    /* Der Fortschritt haengt an der verstrichenen Zeit, nicht an der Zahl der
       Durchlaeufe. Ein setTimeout(45) kommt auf einer beschaeftigten Seite
       spaeter zurueck als bestellt; ohne diese Rechnung waere das Tippen
       langsamer als die vorgegebenen 2 Zeichen je 45 ms. Zeit, in der der
       Tab im Hintergrund lag, zaehlt nicht mit. */
    function tippSchritt() {
      var verstrichen, soll;
      tippTimer = null;
      if (versteckt()) {
        tippPause = jetzt();
        tippTimer = window.setTimeout(tippSchritt, VERSTECKT_MS);
        return;
      }
      if (tippPause) {
        tippRuhe = tippRuhe + (jetzt() - tippPause);
        tippPause = 0;
      }
      verstrichen = jetzt() - tippBeginn - tippRuhe;
      soll = Math.ceil(verstrichen / TIPP_MS) * TIPP_ZEICHEN;
      if (soll < tippPos + TIPP_ZEICHEN) { soll = tippPos + TIPP_ZEICHEN; }
      if (soll > tippText.length) { soll = tippText.length; }
      tippPos = soll;
      ziel.textContent = tippText.substring(0, tippPos);
      if (tippPos < tippText.length) {
        tippTimer = window.setTimeout(tippSchritt, TIPP_MS);
      }
    }

    function tippenStarten() {
      if (tippGestartet || ruhig || !ziel) { return; }
      tippGestartet = true;
      tippText = ziel.textContent;
      if (!tippText || tippText.length < 2) { return; }
      tippPos = 0;
      tippRuhe = 0;
      tippPause = 0;
      ziel.textContent = "";
      tippBeginn = jetzt() + TIPP_START_MS;
      tippTimer = window.setTimeout(tippSchritt, TIPP_START_MS);
    }

    function tippenBeobachten() {
      var kasten, beobachter;
      if (!ziel || ruhig) { return; }
      kasten = ziel.parentNode || ziel;
      if (!window.IntersectionObserver) { tippenStarten(); return; }
      beobachter = new window.IntersectionObserver(function (eintraege) {
        var i;
        for (i = 0; i < eintraege.length; i++) {
          if (eintraege[i].isIntersecting) {
            beobachter.disconnect();
            tippenStarten();
            return;
          }
        }
      }, { threshold: 0 });
      beobachter.observe(kasten);
    }

    /* ---- Aufbau ------------------------------------------------------ */

    var i;
    for (i = 0; i < takte.length; i++) {
      takte[i].setAttribute("aria-pressed", "false");
      takte[i].addEventListener("click", klick(i), false);
    }

    block.setAttribute("data-dm-konsole", "js");
    if (!ruhig) { block.setAttribute("data-dm-bewegung", "an"); }

    zeigeTakt(0);
    planen(TAKT_MS);
    tippenBeobachten();

    document.addEventListener("visibilitychange", function () {
      if (versteckt()) { return; }
      if (!taktTimer) { planen(TAKT_MS); }
    }, false);
  }

  function start() {
    var bloecke = document.querySelectorAll("[data-dm-konsole-block]");
    var i;
    for (i = 0; i < bloecke.length; i++) {
      initKonsole(bloecke[i]);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start, false);
  } else {
    start();
  }
})();
