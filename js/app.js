/* Sept 2024 check-in — learner page.
 *
 * How saving works: a tap writes to localStorage FIRST and paints straight
 * away, then queues a write to Supabase. If the phone is offline or the tap
 * fails, the item stays in the queue and is retried on the next tap, on
 * reload, and whenever the browser says it is back online. Nothing is lost
 * and there is no big Submit button to forget.
 */
(function () {
  "use strict";

  var LEVELS = [
    { l: 0, en: "Got it",  af: "Snap dit", icon: "✓" },
    { l: 1, en: "eh",      af: "eh",       icon: "~" },
    { l: 2, en: "No idea", af: "Geen idee", icon: "✗" }
  ];

  var T = {
    title:    { en: "September 2024 check-in", af: "September 2024 inskrywing" },
    sub:      { en: "Mark how each question felt. It saves as you tap.",
                af: "Merk hoe elke vraag gevoel het. Dit stoor soos jy tik." },
    nameQ:    { en: "What is your name?", af: "Wat is jou naam?" },
    nameHint: { en: "First name and surname, so I know whose is whose.",
                af: "Naam en van, sodat ek weet wie sŉ een is." },
    start:    { en: "Start", af: "Begin" },
    notYou:   { en: "Not you?", af: "Nie jy nie?" },
    done:     { en: "answered", af: "beantwoord" },
    noteQ:    { en: "Anything else that confused you?",
                af: "Enigiets anders wat jou verwar het?" },
    noteHint: { en: "Optional. A sentence is plenty.",
                af: "Opsioneel. Een sin is genoeg." },
    saved:    { en: "Saved", af: "Gestoor" },
    saving:   { en: "Saving…", af: "Stoor…" },
    offline:  { en: "Saved on this phone — will sync",
                af: "Op hierdie foon gestoor — sal sinkroniseer" },
    allDone:  { en: "That is everything — thank you!",
                af: "Dis alles — dankie!" },
    marks:    { en: "marks", af: "punte" }
  };

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var lang = localStorage.getItem("s24_lang") || "af";
  var name = localStorage.getItem("s24_name") || "";
  var paperIdx = 0;
  var answers = {};          // "paper|qnum" -> level
  var queue = [];            // pending writes
  var syncing = false;
  var badgeTimer = null;

  function t(k) { return T[k][lang]; }
  function key(p, q) { return p + "|" + q; }
  function lsKey() { return "s24_ans_" + (window.exam_nameKey ? window.exam_nameKey(name) : name.toLowerCase().trim()); }

  function nameKey(s) { return s.toLowerCase().replace(/\s+/g, " ").trim(); }
  window.exam_nameKey = nameKey;

  /* ------------------------------------------------------------- storage */
  function loadLocal() {
    try { answers = JSON.parse(localStorage.getItem(lsKey()) || "{}"); }
    catch (e) { answers = {}; }
    try { queue = JSON.parse(localStorage.getItem("s24_queue") || "[]"); }
    catch (e) { queue = []; }
  }
  function saveLocal() {
    localStorage.setItem(lsKey(), JSON.stringify(answers));
    localStorage.setItem("s24_queue", JSON.stringify(queue));
  }

  /* ---------------------------------------------------------------- sync */
  function badge(cls, msg, fade) {
    var el = $("#sync");
    el.className = "sync " + cls;
    el.textContent = msg;
    clearTimeout(badgeTimer);
    if (fade) badgeTimer = setTimeout(function () { el.className = "sync gone"; }, 1600);
  }

  async function flush() {
    if (syncing || !queue.length) return;
    syncing = true;
    badge("busy", t("saving"));
    while (queue.length) {
      var job = queue[0];
      try {
        if (job.kind === "flag") {
          await window.rpc("exam_flag_set", {
            p_paper: job.paper, p_name: name, p_qnum: job.qnum, p_level: job.level
          });
        } else {
          await window.rpc("exam_note_set", {
            p_paper: job.paper, p_name: name, p_note: job.note
          });
        }
        queue.shift();
        saveLocal();
      } catch (e) {
        syncing = false;
        badge("bad", t("offline"));
        return;                       // keep the queue, try again later
      }
    }
    syncing = false;
    badge("ok", t("saved"), true);
  }

  function enqueue(job) {
    // one pending write per question / per note
    queue = queue.filter(function (j) {
      if (j.kind !== job.kind || j.paper !== job.paper) return true;
      if (job.kind === "flag") return j.qnum !== job.qnum;
      return false;
    });
    queue.push(job);
    saveLocal();
    flush();
  }

  /* --------------------------------------------------------------- paint */
  function paper() { return window.PAPERS[paperIdx]; }

  function countFor(p) {
    var got = 0, shaky = 0, stuck = 0, total = 0;
    p.questions.forEach(function (q) {
      q.subs.forEach(function (s) {
        total++;
        var v = answers[key(p.code, s.n)];
        if (v === 0) got++; else if (v === 1) shaky++; else if (v === 2) stuck++;
      });
    });
    return { got: got, shaky: shaky, stuck: stuck, total: total, done: got + shaky + stuck };
  }

  function paintProgress() {
    var p = paper(), c = countFor(p), pc = function (n) { return (n / c.total * 100).toFixed(2) + "%"; };
    $("#bar").innerHTML =
      '<i class="g" style="width:' + pc(c.got) + '"></i>' +
      '<i class="y" style="width:' + pc(c.shaky) + '"></i>' +
      '<i class="r" style="width:' + pc(c.stuck) + '"></i>';
    $("#progtext").textContent = c.done + " / " + c.total + " " + t("done");
    $("#progdone").textContent = c.done === c.total ? t("allDone") : "";
  }

  function paintPaper() {
    var p = paper();
    var html = "";
    p.questions.forEach(function (q) {
      html += '<section class="qgroup">';
      html += "<h3>" + esc(lang === "af" ? q.head_af : q.head_en) +
              "<span>" + q.marks + " " + t("marks") + "</span></h3>";
      html += '<div class="qlist">';
      q.subs.forEach(function (s) {
        var cur = answers[key(p.code, s.n)];
        html += '<div class="qrow">';
        html += '<div class="qtop"><span class="qn">' + esc(s.n) + '</span>' +
                '<span class="qt">' + esc(lang === "af" ? s.af : s.en) + "</span>" +
                '<span class="qm">(' + s.m + ")</span></div>";
        html += '<div class="levels" role="group">';
        LEVELS.forEach(function (L) {
          html += '<button type="button" data-q="' + esc(s.n) + '" data-l="' + L.l +
                  '" aria-pressed="' + (cur === L.l ? "true" : "false") + '">' +
                  '<span aria-hidden="true">' + L.icon + "</span> " +
                  esc(lang === "af" ? L.af : L.en) + "</button>";
        });
        html += "</div></div>";
      });
      html += "</div></section>";
    });
    $("#questions").innerHTML = html;
    paintProgress();
  }

  function paintTabs() {
    var b = $("#tabs").querySelectorAll("button");
    for (var i = 0; i < b.length; i++) {
      b[i].textContent = lang === "af" ? window.PAPERS[i].name_af : window.PAPERS[i].name_en;
      b[i].setAttribute("aria-selected", i === paperIdx ? "true" : "false");
    }
  }

  function paintChrome() {
    $("#h1").textContent = t("title");
    $("#hsub").textContent = t("sub");
    $("#whoami").textContent = name;
    $("#notyou").textContent = t("notYou");
    $("#noteLabel").textContent = t("noteQ");
    $("#noteHint").textContent = t("noteHint");
    $("#langbtn").textContent = lang === "af" ? "English" : "Afrikaans";
    document.documentElement.lang = lang;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  /* --------------------------------------------------------------- events */
  function onLevelTap(e) {
    var btn = e.target.closest("button[data-q]");
    if (!btn) return;
    var p = paper(), qn = btn.getAttribute("data-q"), lv = +btn.getAttribute("data-l");
    var k = key(p.code, qn);
    if (answers[k] === lv) return;          // already that
    answers[k] = lv;
    saveLocal();
    // repaint just this row
    var row = btn.parentNode.querySelectorAll("button");
    for (var i = 0; i < row.length; i++) {
      row[i].setAttribute("aria-pressed", +row[i].getAttribute("data-l") === lv ? "true" : "false");
    }
    paintProgress();
    enqueue({ kind: "flag", paper: p.code, qnum: qn, level: lv });
  }

  var noteTimer = null;
  function onNoteInput() {
    clearTimeout(noteTimer);
    var p = paper(), val = $("#note").value;
    localStorage.setItem("s24_note_" + nameKey(name) + "_" + p.code, val);
    noteTimer = setTimeout(function () {
      enqueue({ kind: "note", paper: p.code, note: val });
    }, 900);
  }

  function loadNote() {
    var p = paper();
    $("#note").value = localStorage.getItem("s24_note_" + nameKey(name) + "_" + p.code) || "";
  }

  async function pullFromServer() {
    // If she reloads on a different device, bring her answers back.
    for (var i = 0; i < window.PAPERS.length; i++) {
      var p = window.PAPERS[i];
      try {
        var rows = await window.rpc("exam_flags_mine", { p_paper: p.code, p_name: name });
        (rows || []).forEach(function (r) {
          var k = key(p.code, r.qnum);
          if (answers[k] === undefined) answers[k] = r.level;
        });
        var note = await window.rpc("exam_note_mine", { p_paper: p.code, p_name: name });
        var lk = "s24_note_" + nameKey(name) + "_" + p.code;
        if (note && !localStorage.getItem(lk)) localStorage.setItem(lk, note);
      } catch (e) { /* offline is fine */ }
    }
    saveLocal();
    paintPaper();
    loadNote();
  }

  function start() {
    $("#gate").classList.add("hide");
    $("#main").classList.remove("hide");
    loadLocal();
    paintChrome();
    paintTabs();
    paintPaper();
    loadNote();
    pullFromServer();
    flush();
  }

  /* ----------------------------------------------------------------- init */
  document.addEventListener("DOMContentLoaded", function () {
    $("#gateTitle").textContent = T.nameQ[lang];
    $("#gateHint").textContent = T.nameHint[lang];
    $("#gateBtn").textContent = T.start[lang];

    $("#gateForm").addEventListener("submit", function (e) {
      e.preventDefault();
      var v = $("#nameInput").value.trim().replace(/\s+/g, " ");
      if (v.length < 2) { $("#nameInput").focus(); return; }
      name = v;
      localStorage.setItem("s24_name", name);
      start();
    });

    $("#notyou").addEventListener("click", function () {
      localStorage.removeItem("s24_name");
      location.reload();
    });

    $("#langbtn").addEventListener("click", function () {
      lang = lang === "af" ? "en" : "af";
      localStorage.setItem("s24_lang", lang);
      paintChrome(); paintTabs(); paintPaper();
      $("#gateTitle").textContent = T.nameQ[lang];
      $("#gateHint").textContent = T.nameHint[lang];
      $("#gateBtn").textContent = T.start[lang];
    });

    $("#tabs").addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      paperIdx = +b.getAttribute("data-i");
      paintTabs(); paintPaper(); loadNote();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    $("#questions").addEventListener("click", onLevelTap);
    $("#note").addEventListener("input", onNoteInput);
    window.addEventListener("online", flush);

    if (name) { $("#nameInput").value = name; start(); }
  });
})();
