/* Sept 2024 check-in — teacher page.
 *
 * The point of this page is the TOPIC table at the top. What you need on
 * Monday is "9 of 14 are red on Euclidean geometry", not "9.2 was bad".
 * Question-by-question detail is below that, worst first.
 */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var pw = "";
  var summary = [];
  var learners = [];
  var notes = [];

  var PAPER_NAME = { "sept2024-p1": "Paper 1", "sept2024-p2": "Paper 2" };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c];
    });
  }

  // 0 = everyone fine, 100 = everyone stuck.
  function trouble(r) {
    var n = r.n_got + r.n_shaky + r.n_stuck;
    if (!n) return null;
    return Math.round((r.n_shaky + 2 * r.n_stuck) / (2 * n) * 100);
  }

  function barHTML(got, shaky, stuck) {
    var n = got + shaky + stuck;
    if (!n) return '<div class="tbar"></div>';
    var p = function (x) { return (x / n * 100).toFixed(2) + "%"; };
    return '<div class="tbar">' +
      '<i class="g" style="width:' + p(got) + '"></i>' +
      '<i class="y" style="width:' + p(shaky) + '"></i>' +
      '<i class="r" style="width:' + p(stuck) + '"></i></div>';
  }

  /* ------------------------------------------------------------- topics */
  function paintTopics() {
    var html = "";
    ["sept2024-p1", "sept2024-p2"].forEach(function (code) {
      var rows = summary.filter(function (r) { return r.paper_code === code; });
      var byTopic = {};
      rows.forEach(function (r) {
        var t = byTopic[r.topic] || (byTopic[r.topic] = { got: 0, shaky: 0, stuck: 0, marks: 0 });
        t.got += r.n_got; t.shaky += r.n_shaky; t.stuck += r.n_stuck; t.marks += r.marks;
      });
      var list = Object.keys(byTopic).map(function (k) {
        var t = byTopic[k];
        return {
          key: k,
          name: (window.TOPICS[k] || { en: k }).en,
          marks: t.marks,
          got: t.got, shaky: t.shaky, stuck: t.stuck,
          score: trouble({ n_got: t.got, n_shaky: t.shaky, n_stuck: t.stuck })
        };
      }).sort(function (a, b) { return (b.score === null ? -1 : b.score) - (a.score === null ? -1 : a.score); });

      html += '<div class="card"><h2>' + PAPER_NAME[code] + " — by topic</h2>";
      html += '<p class="small muted" style="margin-bottom:10px">Worst first. The number is how much trouble the class had, 0 = everyone fine, 100 = everyone stuck.</p>';
      if (!list.length || list.every(function (x) { return x.score === null; })) {
        html += '<p class="muted small">Nothing marked yet.</p>';
      } else {
        list.forEach(function (x) {
          html += '<div class="topicrow"><span class="nm">' + esc(x.name) +
                  ' <span class="small muted" style="font-weight:400">(' + x.marks + ' marks)</span></span>' +
                  barHTML(x.got, x.shaky, x.stuck) +
                  '<span class="pct">' + (x.score === null ? "—" : x.score + "%") + "</span></div>";
        });
      }
      html += "</div>";
    });
    $("#topics").innerHTML = html;
  }

  /* ----------------------------------------------------------- questions */
  function paintQuestions() {
    var mode = $("#qsort").value;
    var html = "";
    ["sept2024-p1", "sept2024-p2"].forEach(function (code) {
      var rows = summary.filter(function (r) { return r.paper_code === code; }).slice();
      if (mode === "worst") {
        rows.sort(function (a, b) {
          var x = trouble(a), y = trouble(b);
          if (x === null && y === null) return a.seq - b.seq;
          if (x === null) return 1;
          if (y === null) return -1;
          return y - x || a.seq - b.seq;
        });
      } else {
        rows.sort(function (a, b) { return a.seq - b.seq; });
      }
      html += '<div class="card"><h2>' + PAPER_NAME[code] +
              ' — every question</h2><div class="scroll"><table class="grid">';
      html += "<thead><tr><th>Q</th><th>What it asks</th><th class='num'>Marks</th>" +
              "<th style='min-width:130px'>Class</th><th class='num'>Trouble</th></tr></thead><tbody>";
      rows.forEach(function (r) {
        var sc = trouble(r);
        html += "<tr><td><b>" + esc(r.qnum) + "</b></td>" +
                "<td>" + esc(r.label_en) + "</td>" +
                "<td class='num'>" + r.marks + "</td>" +
                "<td>" + barHTML(r.n_got, r.n_shaky, r.n_stuck) + "</td>" +
                "<td class='num'><b>" + (sc === null ? "—" : sc + "%") + "</b></td></tr>";
      });
      html += "</tbody></table></div></div>";
    });
    $("#questions").innerHTML = html;
  }

  /* ------------------------------------------------------------ learners */
  function paintLearners() {
    if (!learners.length) {
      $("#learners").innerHTML = '<div class="card"><h2>Who has filled it in</h2><p class="muted small">Nobody yet.</p></div>';
      return;
    }
    var byName = {};
    learners.forEach(function (r) {
      var b = byName[r.learner_name] || (byName[r.learner_name] = {});
      b[r.paper_code] = r;
    });
    var html = '<div class="card"><h2>Who has filled it in</h2><div class="scroll"><table class="grid">';
    html += "<thead><tr><th>Name</th><th class='num'>P1</th><th class='num'>P2</th>" +
            "<th class='num'>Got it</th><th class='num'>eh</th><th class='num'>No idea</th><th>Last</th></tr></thead><tbody>";
    Object.keys(byName).sort().forEach(function (nm) {
      var a = byName[nm]["sept2024-p1"], b = byName[nm]["sept2024-p2"];
      var got = (a ? a.n_got : 0) + (b ? b.n_got : 0);
      var sh = (a ? a.n_shaky : 0) + (b ? b.n_shaky : 0);
      var st = (a ? a.n_stuck : 0) + (b ? b.n_stuck : 0);
      var last = [a && a.last_seen, b && b.last_seen].filter(Boolean).sort().pop();
      html += "<tr><td><b>" + esc(nm) + "</b></td>" +
              "<td class='num'>" + (a ? a.answered + "/51" : "—") + "</td>" +
              "<td class='num'>" + (b ? b.answered + "/50" : "—") + "</td>" +
              "<td class='num'>" + got + "</td><td class='num'>" + sh + "</td><td class='num'>" + st + "</td>" +
              "<td class='small muted'>" + (last ? new Date(last).toLocaleString("en-ZA", { dateStyle: "short", timeStyle: "short" }) : "—") + "</td></tr>";
    });
    html += "</tbody></table></div></div>";
    $("#learners").innerHTML = html;
  }

  /* --------------------------------------------------------------- notes */
  function paintNotes() {
    if (!notes.length) { $("#notes").innerHTML = ""; return; }
    var html = '<div class="card"><h2>What they wrote</h2>';
    notes.forEach(function (n) {
      html += '<p style="margin:10px 0"><b>' + esc(n.learner_name) + "</b> " +
              '<span class="small muted">(' + PAPER_NAME[n.paper_code] + ")</span><br>" +
              esc(n.note) + "</p>";
    });
    html += "</div>";
    $("#notes").innerHTML = html;
  }

  /* ---------------------------------------------------------------- load */
  async function load() {
    $("#err").textContent = "";
    $("#loadBtn").disabled = true;
    try {
      summary = await window.rpc("exam_teacher_summary", { p_password: pw });
      learners = await window.rpc("exam_teacher_learners", { p_password: pw });
      notes = await window.rpc("exam_teacher_notes", { p_password: pw });
    } catch (e) {
      $("#err").textContent = e.message;
      $("#loadBtn").disabled = false;
      return;
    }
    sessionStorage.setItem("s24_pw", pw);
    $("#gate").classList.add("hide");
    $("#main").classList.remove("hide");
    $("#loadBtn").disabled = false;
    var names = {};
    learners.forEach(function (r) { names[r.learner_name] = 1; });
    var n = Object.keys(names).length;
    $("#count").textContent = n === 0 ? "Nobody has filled it in yet."
                            : n === 1 ? "1 learner so far."
                            : n + " learners so far.";
    paintTopics(); paintQuestions(); paintLearners(); paintNotes();
  }

  document.addEventListener("DOMContentLoaded", function () {
    $("#gateForm").addEventListener("submit", function (e) {
      e.preventDefault();
      pw = $("#pwInput").value;
      load();
    });
    $("#qsort").addEventListener("change", paintQuestions);
    $("#refresh").addEventListener("click", load);

    var saved = sessionStorage.getItem("s24_pw");
    if (saved) { pw = saved; $("#pwInput").value = saved; load(); }
  });
})();
