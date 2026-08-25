/* Sept 2024 check-in — learner page.
 *
 * Everything starts on "Got it". The learner only changes the ones they
 * struggled with, so a paper is a handful of taps, not 51.
 *
 * Because of that default, nothing is written until they actually engage.
 * The first change to a paper — or pressing "Done" — commits the WHOLE paper
 * in one request (the ones they left alone go in as "got it"). That keeps
 * Megan's percentages honest: a question flagged by one learner should not
 * read as 100% trouble just because the other thirteen never wrote a row.
 *
 * Saving: a tap paints instantly and writes to localStorage, then syncs. If
 * the phone is offline the writes merge into one queued payload per paper and
 * go out on the next tap, on reload, or when the browser comes back online.
 */
(function () {
  "use strict";

  var LEVELS = [
    { l: 0, en: "Got it",  af: "Snap dit",  icon: "✓" },
    { l: 1, en: "eh",      af: "eh",        icon: "~" },
    { l: 2, en: "No idea", af: "Geen idee", icon: "✗" }
  ];

  var T = {
    title:    { en: "September 2024 check-in", af: "September 2024 inskrywing" },
    sub:      { en: "Everything starts on “Got it”. Only change the ones you struggled with.",
                af: "Alles begin op “Snap dit”. Verander net die vrae waarmee jy gesukkel het." },
    nameQ:    { en: "What is your name?", af: "Wat is jou naam?" },
    nameHint: { en: "First name and surname, so I know whose is whose.",
                af: "Naam en van, sodat ek weet wie sŉ een is." },
    start:    { en: "Start", af: "Begin" },
    notYou:   { en: "Not you?", af: "Nie jy nie?" },
    none:     { en: "Nothing flagged yet", af: "Nog niks gemerk nie" },
    flagged:  { en: "flagged", af: "gemerk" },
    notSent:  { en: "not sent yet", af: "nog nie ingestuur nie" },
    sent:     { en: "sent ✓", af: "ingestuur ✓" },
    doneBtn:  { en: "Done with this paper", af: "Klaar met hierdie vraestel" },
    doneNote: { en: "Press this even if you struggled with nothing — it tells me you did the paper.",
                af: "Druk dit selfs al het jy met niks gesukkel nie — dit wys my jy het die vraestel gedoen." },
    noteQ:    { en: "Anything else that confused you?",
                af: "Enigiets anders wat jou verwar het?" },
    noteHint: { en: "Optional. A sentence is plenty.",
                af: "Opsioneel. Een sin is genoeg." },
    saved:    { en: "Saved", af: "Gestoor" },
    saving:   { en: "Saving…", af: "Stoor…" },
    offline:  { en: "Saved on this phone — will sync",
                af: "Op hierdie foon gestoor — sal sinkroniseer" },
    marks:    { en: "marks", af: "punte" }
  };

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var lang = localStorage.getItem("s24_lang") || "af";
  var name = localStorage.getItem("s24_name") || "";
  var paperIdx = 0;
  var answers = {};          // "paper|qnum" -> level  (absent means 0)
  var committed = {};        // paper code -> true once the paper has been written
  var queue = [];            // pending writes
  var syncing = false;
  var badgeTimer = null;

  function t(k) { return T[k][lang]; }
  function key(p, q) { return p + "|" + q; }
  function nameKey(s) { return String(s).toLowerCase().replace(/\s+/g, " ").trim(); }
  function levelOf(p, q) { var v = answers[key(p, q)]; return v === undefined ? 0 : v; }

  function lsAns()  { return "s24_ans_" + nameKey(name); }
  function lsDone() { return "s24_done_" + nameKey(name); }
  function lsNote(code) { return "s24_note_" + nameKey(name) + "_" + code; }

  /* ------------------------------------------------------------- storage */
  function loadLocal() {
    try { answers = JSON.parse(localStorage.getItem(lsAns()) || "{}"); }
    catch (e) { answers = {}; }
    try { committed = JSON.parse(localStorage.getItem(lsDone()) || "{}"); }
    catch (e) { committed = {}; }
    try { queue = JSON.parse(localStorage.getItem("s24_queue") || "[]"); }
    catch (e) { queue = []; }
  }
  function saveLocal() {
    localStorage.setItem(lsAns(), JSON.stringify(answers));
    localStorage.setItem(lsDone(), JSON.stringify(committed));
    localStorage.setItem("s24_queue", JSON.stringify(queue));
  }

  /* ---------------------------------------------------------------- sync */
  function badge(cls, msg, fade) {
    var el = $("#sync");
    el.className = "sync " + cls;
    el.textContent = msg;
    clearTimeout(badgeTimer);
    if (fade) badgeTimer = setTimeout(function () { el.className = "sync gone"; }, 1800);
  }

  async function flush() {
    if (syncing || !queue.length) return;
    syncing = true;
    badge("busy", t("saving"));
    while (queue.length) {
      var job = queue[0];
      // Taps can land WHILE the request below is in flight. So take what we
      // are sending out of the job first, and only drop the job if nothing
      // new arrived meanwhile — otherwise those taps would be thrown away.
      var sending = job.kind === "flags" ? job.map : job.note;
      if (job.kind === "flags") job.map = {}; else job.dirty = false;
      try {
        if (job.kind === "flags") {
          var rows = Object.keys(sending).map(function (q) {
            return { qnum: q, level: sending[q] };
          });
          await window.rpc("exam_flags_set_many", {
            p_paper: job.paper, p_name: name, p_rows: rows
          });
        } else {
          await window.rpc("exam_note_set", {
            p_paper: job.paper, p_name: name, p_note: sending
          });
        }
        var stillPending = job.kind === "flags"
          ? Object.keys(job.map).length > 0
          : job.dirty;
        if (!stillPending) {
          var at = queue.indexOf(job);
          if (at >= 0) queue.splice(at, 1);
        }
        saveLocal();
      } catch (e) {
        // put back whatever did not go out, without clobbering newer taps
        if (job.kind === "flags") {
          Object.keys(sending).forEach(function (q) {
            if (job.map[q] === undefined) job.map[q] = sending[q];
          });
        } else if (!job.dirty) {
          job.note = sending;
        }
        syncing = false;
        saveLocal();
        badge("bad", t("offline"));
        return;                       // keep the queue, try again later
      }
    }
    syncing = false;
    badge("ok", t("saved"), true);
    paintProgress();
  }

  // Merge flag writes so offline taps become ONE payload per paper.
  function enqueueFlags(code, map) {
    var job = null;
    for (var i = 0; i < queue.length; i++) {
      if (queue[i].kind === "flags" && queue[i].paper === code) { job = queue[i]; break; }
    }
    if (!job) { job = { kind: "flags", paper: code, map: {} }; queue.push(job); }
    Object.keys(map).forEach(function (q) { job.map[q] = map[q]; });
    saveLocal();
    flush();
  }

  // Mutate in place — replacing the queue array mid-flush would make flush
  // remove the wrong job.
  function enqueueNote(code, note) {
    var job = null;
    for (var i = 0; i < queue.length; i++) {
      if (queue[i].kind === "note" && queue[i].paper === code) { job = queue[i]; break; }
    }
    if (!job) { job = { kind: "note", paper: code, note: note, dirty: true }; queue.push(job); }
    else { job.note = note; job.dirty = true; }
    saveLocal();
    flush();
  }

  // Write the whole paper — the untouched ones go in as "got it".
  function commitPaper(p) {
    var map = {};
    p.questions.forEach(function (q) {
      q.subs.forEach(function (s) { map[s.n] = levelOf(p.code, s.n); });
    });
    committed[p.code] = true;
    saveLocal();
    enqueueFlags(p.code, map);
  }

  /* --------------------------------------------------------------- paint */
  function paper() { return window.PAPERS[paperIdx]; }

  function countFor(p) {
    var c = { got: 0, eh: 0, no: 0, total: 0 };
    p.questions.forEach(function (q) {
      q.subs.forEach(function (s) {
        c.total++;
        var v = levelOf(p.code, s.n);
        if (v === 1) c.eh++; else if (v === 2) c.no++; else c.got++;
      });
    });
    c.flagged = c.eh + c.no;
    return c;
  }

  function paintProgress() {
    var p = paper(), c = countFor(p);
    var pc = function (n) { return (n / c.total * 100).toFixed(2) + "%"; };
    $("#bar").innerHTML =
      '<i class="g" style="width:' + pc(c.got) + '"></i>' +
      '<i class="y" style="width:' + pc(c.eh) + '"></i>' +
      '<i class="r" style="width:' + pc(c.no) + '"></i>';
    $("#progtext").textContent = c.flagged === 0
      ? t("none")
      : c.flagged + " / " + c.total + " " + t("flagged");
    var sentEl = $("#progdone");
    var pending = queue.some(function (j) { return j.kind === "flags" && j.paper === p.code; });
    if (committed[p.code] && !pending) {
      sentEl.textContent = t("sent");
      sentEl.style.color = "var(--s3)";
    } else if (committed[p.code]) {
      sentEl.textContent = t("saving");
      sentEl.style.color = "var(--ink-soft)";
    } else {
      sentEl.textContent = t("notSent");
      sentEl.style.color = "var(--ink-soft)";
    }
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
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
        var cur = levelOf(p.code, s.n);
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
    $("#doneBtn").textContent = t("doneBtn");
    $("#doneNote").textContent = t("doneNote");
    $("#noteLabel").textContent = t("noteQ");
    $("#noteHint").textContent = t("noteHint");
    $("#langbtn").textContent = lang === "af" ? "English" : "Afrikaans";
    document.documentElement.lang = lang;
  }

  function paintGate() {
    $("#gateTitle").textContent = T.nameQ[lang];
    $("#gateHint").textContent = T.nameHint[lang];
    $("#gateBtn").textContent = T.start[lang];
  }

  /* --------------------------------------------------------------- events */
  function onLevelTap(e) {
    var btn = e.target.closest("button[data-q]");
    if (!btn) return;
    var p = paper(), qn = btn.getAttribute("data-q"), lv = +btn.getAttribute("data-l");
    if (levelOf(p.code, qn) === lv && committed[p.code]) return;

    answers[key(p.code, qn)] = lv;
    saveLocal();

    var row = btn.parentNode.querySelectorAll("button");
    for (var i = 0; i < row.length; i++) {
      row[i].setAttribute("aria-pressed", +row[i].getAttribute("data-l") === lv ? "true" : "false");
    }

    // First real interaction with this paper writes the whole thing.
    if (!committed[p.code]) {
      commitPaper(p);
    } else {
      var one = {}; one[qn] = lv;
      enqueueFlags(p.code, one);
    }
    paintProgress();
  }

  function onDone() {
    commitPaper(paper());
    paintProgress();
  }

  var noteTimer = null;
  function onNoteInput() {
    clearTimeout(noteTimer);
    var p = paper(), val = $("#note").value;
    localStorage.setItem(lsNote(p.code), val);
    noteTimer = setTimeout(function () { enqueueNote(p.code, val); }, 900);
  }

  function loadNote() {
    $("#note").value = localStorage.getItem(lsNote(paper().code)) || "";
  }

  async function pullFromServer() {
    for (var i = 0; i < window.PAPERS.length; i++) {
      var p = window.PAPERS[i];
      try {
        var rows = await window.rpc("exam_flags_mine", { p_paper: p.code, p_name: name });
        if (rows && rows.length) {
          committed[p.code] = true;
          rows.forEach(function (r) {
            var k = key(p.code, r.qnum);
            if (answers[k] === undefined) answers[k] = r.level;
          });
        }
        var note = await window.rpc("exam_note_mine", { p_paper: p.code, p_name: name });
        if (note && !localStorage.getItem(lsNote(p.code))) localStorage.setItem(lsNote(p.code), note);
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
    paintGate();

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
      paintChrome(); paintTabs(); paintPaper(); paintGate();
    });

    $("#tabs").addEventListener("click", function (e) {
      var b = e.target.closest("button");
      if (!b) return;
      paperIdx = +b.getAttribute("data-i");
      paintTabs(); paintPaper(); loadNote();
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    $("#questions").addEventListener("click", onLevelTap);
    $("#doneBtn").addEventListener("click", onDone);
    $("#note").addEventListener("input", onNoteInput);
    window.addEventListener("online", flush);

    if (name) { $("#nameInput").value = name; start(); }
  });
})();
