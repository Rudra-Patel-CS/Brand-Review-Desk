/* Brand Review Desk - UI controller. Team 24CS073, CodeNexus India 2026 Round 2.
   No build step, no framework: open index.html and it runs. */
(function () {
"use strict";
var E = window.BRDEngine;
var LS = { rules: "brd.ruleset", draft: "brd.draft", history: "brd.history" };

var DEMO_CAPTION = "This festive season, we're obsessed with bringing your family together over sweets that taste like home. Six handmade mithai classics, vegan-friendly options included. Order before 18 October for guaranteed Diwali delivery.";
var DEMO_NAME = "arka-diwali-poster-v2.png";

var state = {
  view: "review",
  ruleset: null,
  draft: null,          // {kind, name, imageUrl, caption, ocr:{status,words,meanConfidence,scale}}
  flags: [],
  manualReview: [],
  decisions: {},        // fingerprint -> {decision, flag, reason}
  seen: {},             // every distinct flag fingerprint seen this session
  expanded: {},
  captionEditing: false,
  showText: false
};

/* ---------- persistence ---------- */
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function load(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }

function fingerprint(f) { return f.ruleId + "|" + f.sourceType + "|" + f.matched.toLowerCase(); }

/* ---------- boot ---------- */
function init() {
  state.ruleset = load(LS.rules) || window.DEFAULT_RULESET;
  var savedDraft = load(LS.draft);
  state.draft = savedDraft || { kind: "image", name: DEMO_NAME, imageUrl: "assets/arka-poster.png", caption: DEMO_CAPTION, ocr: { status: "idle" } };
  document.querySelectorAll(".ni").forEach(function (b) {
    b.addEventListener("click", function () { state.view = b.dataset.view; render(); });
  });
  render();
  if (state.draft.kind === "image") runOcrIfNeeded();
  else runChecksNow();
}

/* ---------- OCR (on-device, vendored Tesseract.js) ---------- */
function runOcrIfNeeded() {
  if (state.draft.ocr && state.draft.ocr.status === "done") { runChecksNow(); return; }
  state.draft.ocr = { status: "running", progress: 0 };
  renderDraftCard();
  var img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = function () {
    var scale = img.naturalWidth < 1600 ? 2 : 1;   // upscale helps OCR on stylized type
    var c = document.createElement("canvas");
    c.width = img.naturalWidth * scale; c.height = img.naturalHeight * scale;
    c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
    var worker;
    Tesseract.createWorker("eng", 1, {
      workerPath: "vendor/worker.min.js",
      corePath: "vendor/core/",
      langPath: "vendor/lang/",
      logger: function (m) {
        if (m.status === "recognizing text") {
          state.draft.ocr.progress = Math.round(m.progress * 100);
          var el = document.getElementById("ocrprog");
          if (el) el.textContent = state.draft.ocr.progress + "%";
        }
      }
    }).then(function (w) {
      worker = w;
      return worker.setParameters({ tessedit_pageseg_mode: "11" });  // sparse text suits posters
    }).then(function () {
      return worker.recognize(c.toDataURL("image/png"));
    }).then(function (res) {
      var words = res.data.words.filter(function (w) { return w.confidence > 30; }).map(function (w) {
        return { text: w.text, confidence: w.confidence,
          bbox: { x0: w.bbox.x0 / scale, y0: w.bbox.y0 / scale, x1: w.bbox.x1 / scale, y1: w.bbox.y1 / scale } };
      });
      var mean = words.length ? words.reduce(function (a, w) { return a + w.confidence; }, 0) / words.length : 0;
      state.draft.ocr = { status: "done", words: words, meanConfidence: mean, text: res.data.text };
      persistDraft();
      return worker.terminate();
    }).then(runChecksNow).catch(ocrFailed);
  };
  img.onerror = function () { ocrFailed(new Error("image load failed")); };
  img.src = state.draft.imageUrl;
}
function ocrFailed(err) {
  state.draft.ocr = { status: "failed", error: String(err && err.message || err) };
  runChecksNow();
}

/* ---------- checks ---------- */
function runChecksNow() {
  var ocr = state.draft.ocr || { status: "idle" };
  var res = E.runChecks(
    { caption: state.draft.caption, ocr: { ran: ocr.status === "done", words: ocr.words || [], meanConfidence: ocr.meanConfidence || 0 } },
    state.ruleset.rules);
  state.flags = res.flags;
  state.manualReview = res.manualReview;
  // remember every distinct flag seen so the resolved counter stays coherent
  state.flags.forEach(function (f) { state.seen[fingerprint(f)] = true; });
  if (state.draft.ocr && state.draft.ocr.status === "failed") {
    state.manualReview.push({ kind: "ocr-blocked", message: "Creative text scan could not run in this browser context (" + state.draft.ocr.error + "). Caption and text checks still ran. Serve the folder over a local web server (see README) to enable the on-device creative scan. The creative itself is NOT auto-passed - treat it as manual review." });
  }
  render();
}

/* ---------- decisions ---------- */
function decidedCount() { return Object.keys(state.decisions).length; }
function undecided() { return state.flags.filter(function (f) { return !state.decisions[fingerprint(f)]; }); }

function applyFlag(f) {
  if (f.sourceType === "caption") {
    state.draft.caption = E.applyToCaption(state.draft.caption, f);
    state.decisions[fingerprint(f)] = { decision: "applied", flag: f };
    persistDraft();
    toast("Suggestion applied to caption.");
    runChecksNow();
  } else {
    state.decisions[fingerprint(f)] = { decision: "copy-change", flag: f };
    toast("Copy change queued for the design re-export. Poster pixels are not edited here.");
    render();
  }
}
function dismissFlag(f) {
  var reason = prompt("Why is this flag dismissed? (logged to the audit trail)", "Reviewed - acceptable as is");
  if (reason === null) return;
  state.decisions[fingerprint(f)] = { decision: "dismissed", flag: f, reason: reason };
  toast("Flag dismissed and logged.");
  render();
}
function undoDecision(f) {
  delete state.decisions[fingerprint(f)];
  toast("Decision reverted.");
  render();
}
function manualKey(i) { return "manual-" + i; }
function markReviewed(i) {
  state.decisions[manualKey(i)] = { decision: "manual-reviewed", flag: null, reason: state.manualReview[i].kind };
  render();
}

/* ---------- export ---------- */
function approveExport() {
  var copyChanges = Object.keys(state.decisions).map(function (k) { return state.decisions[k]; })
    .filter(function (d) { return d.decision === "copy-change"; })
    .map(function (d) { return { from: d.flag.matched, to: d.flag.suggestion.text }; });
  var session = {
    brand: state.ruleset.brand, rulesetName: state.ruleset.rulesetName, rulesVersion: state.ruleset.version,
    contentName: state.draft.name, timestamp: new Date().toLocaleString("en-IN"),
    decisions: Object.keys(state.decisions).filter(function (k) { return state.decisions[k].flag; }).map(function (k) {
      var d = state.decisions[k];
      return { decision: d.decision, ruleId: d.flag.ruleId, name: d.flag.name, matched: d.flag.matched,
        sourceType: d.flag.sourceType, suggestionText: d.flag.suggestion ? d.flag.suggestion.text : null,
        reason: d.reason || null, sourceRef: d.flag.sourceRef };
    }),
    copyChanges: copyChanges, finalCaption: state.draft.caption
  };
  var out = E.buildExport(session);
  download("review-report.txt", out.text, "text/plain");
  download("review-report.json", JSON.stringify(out.json, null, 2), "application/json");
  var hist = load(LS.history) || [];
  hist.unshift({ ts: Date.now(), content: state.draft.name, decisions: session.decisions.length, applied: session.decisions.filter(function (d) { return d.decision === "applied"; }).length, dismissed: session.decisions.filter(function (d) { return d.decision === "dismissed"; }).length, copyChanges: copyChanges.length, caption: state.draft.caption.slice(0, 140) });
  save(LS.history, hist);
  state.decisions = {}; state.seen = {};
  toast("Approved. Review report downloaded and saved to History.");
  render();
}
function download(name, content, type) {
  var a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: type }));
  a.download = name; a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
}

/* ---------- draft ---------- */
function persistDraft() {
  var d = { kind: state.draft.kind, name: state.draft.name, caption: state.draft.caption, ocr: state.draft.ocr };
  if (state.draft.imageUrl && state.draft.imageUrl.length < 2500000) d.imageUrl = state.draft.imageUrl; // keep localStorage sane
  save(LS.draft, d);
}
function uploadImage(file) {
  var r = new FileReader();
  r.onload = function () {
    state.draft = { kind: "image", name: file.name, imageUrl: r.result, caption: state.draft.caption || "", ocr: { status: "idle" } };
    state.decisions = {}; state.seen = {};
    persistDraft(); render(); runOcrIfNeeded();
  };
  r.readAsDataURL(file);
}
function useDemo() {
  state.draft = { kind: "image", name: DEMO_NAME, imageUrl: "assets/arka-poster.png", caption: DEMO_CAPTION, ocr: { status: "idle" } };
  state.decisions = {}; state.seen = {};
  localStorage.removeItem(LS.draft);
  render(); runOcrIfNeeded();
}

/* ---------- helpers ---------- */
function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function sevClass(s) { return s === "high" ? "high" : s === "low" ? "low" : "med"; }
function toast(msg) {
  var t = document.getElementById("toast");
  t.textContent = msg; t.classList.add("show");
  clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove("show"); }, 3200);
}
function captionHTML() {
  var text = state.draft.caption;
  var marks = state.flags.filter(function (f) { return f.sourceType === "caption" && !state.decisions[fingerprint(f)]; })
    .map(function (f) { return { s: f.span.start, e: f.span.end, sev: sevClass(f.severity) }; })
    .sort(function (a, b) { return a.s - b.s; });
  var out = "", pos = 0;
  marks.forEach(function (m) {
    if (m.s < pos) return;
    out += esc(text.slice(pos, m.s)) + '<mark class="' + m.sev + '">' + esc(text.slice(m.s, m.e)) + "</mark>";
    pos = m.e;
  });
  out += esc(text.slice(pos));
  return out;
}

/* ---------- render ---------- */
function render() {
  document.querySelectorAll(".ni").forEach(function (b) { b.classList.toggle("active", b.dataset.view === state.view); });
  var m = document.getElementById("main");
  if (state.view === "rules") m.innerHTML = rulesView();
  else if (state.view === "history") m.innerHTML = historyView();
  else if (state.view === "insights") m.innerHTML = insightsView();
  else m.innerHTML = reviewView();
  wire(m);
  if (state.view === "review") positionOverlays();
}

function reviewView() {
  var undec = undecided().length;
  var total = Object.keys(state.seen).length;
  var resolved = decidedCount();
  var manualPending = state.manualReview.filter(function (mr, i) { return !state.decisions[manualKey(i)]; }).length;
  var canApprove = undec === 0 && manualPending === 0 && (state.flags.length > 0 || resolved > 0);
  return '' +
  '<div class="head"><div><div class="h1 serif">Review. Align. Approve.</div>' +
  '<div class="sub">Check every piece of content against the approved brand rules before it goes live.</div></div>' +
  '<div class="avatar">PP</div></div>' +
  '<div class="stepper">' +
    '<button class="step" data-goto="rules"><div class="stnum">' + (state.ruleset.rules.length ? "&#10003;" : "1") + '</div><div class="stlabel">Brand Rules</div></button><span class="stsep">&rarr;</span>' +
    '<button class="step" id="stepUpload"><div class="stnum">2</div><div class="stlabel">Content Draft</div></button><span class="stsep">&rarr;</span>' +
    '<div class="step active"><div class="stnum">3</div><div class="stlabel" style="cursor:default">Review &amp; Approve</div></div>' +
  '</div>' +
  '<div class="cols">' +
    '<div class="card draftcard" id="draftcard">' + draftCardHTML() + '</div>' +
    '<div class="card results">' + resultsHTML(canApprove) + '</div>' +
  '</div>' +
  '<div class="foot">' +
    '<span class="rescount">' + resolved + ' of ' + total + ' issues resolved &middot; every decision is logged</span>' +
    '<div style="margin-left:auto;display:flex;gap:10px;flex-wrap:wrap">' +
      '<button class="savelater" id="saveBtn">Save for Later</button>' +
      '<button class="approve" id="approveBtn" ' + (canApprove ? "" : "disabled") + '>&#10003; Approve &amp; Export</button>' +
    '</div></div>';
}

function draftCardHTML() {
  var d = state.draft, ocr = d.ocr || { status: "idle" };
  var h = '<div class="cardhead"><span style="color:#5f6a5c">&#9703;</span><span class="cardtitle">Content Draft</span>' +
    '<span class="cardmeta">' + esc(state.ruleset.brand) + ' &middot; ' + (d.kind === "image" ? "poster / creative" : "text draft") + '</span>' +
    (d.kind === "image" ? '<div class="toggle"><button class="tog ' + (!state.showText ? "on" : "") + '" data-tog="visual">Visual</button><button class="tog ' + (state.showText ? "on" : "") + '" data-tog="text">Text</button></div>' : "") +
    '</div>';
  if (d.kind === "image" && !state.showText) {
    h += '<div class="postwrap"><img id="posterimg" src="' + esc(d.imageUrl) + '" alt="creative"><div id="overlays"></div></div>';
  }
  if (d.kind === "image" && state.showText) {
    var t = ocr.status === "done" ? (ocr.text || "(no text detected)") :
      ocr.status === "running" ? "Scanning creative text..." :
      ocr.status === "failed" ? "Creative text scan unavailable in this context (see note below)." : "Not scanned yet.";
    h += '<div class="captionblock"><div class="caplabels"><span class="caplabel">TEXT DETECTED ON CREATIVE (ON-DEVICE OCR)</span></div>' +
      '<div class="captiontext" style="font-family:inherit;white-space:pre-wrap">' + esc(t.trim()) + '</div></div>';
  }
  // OCR status line
  if (d.kind === "image") {
    if (ocr.status === "running") h += '<div class="ocrstatus"><div class="spinner"></div><div>Reading text on the creative with on-device OCR&hellip; <b id="ocrprog">' + (ocr.progress || 0) + '%</b><br><span style="font-size:11px;color:#7a8272">Runs fully in your browser - the image never leaves this device.</span></div></div>';
    else if (ocr.status === "done") h += '<div class="ocrstatus">&#10003;&nbsp;Creative scan complete: <b>' + ocr.words.length + ' words</b> detected, average confidence <b>' + Math.round(ocr.meanConfidence) + '%</b>. <button class="linkbtn" id="rescanBtn">Re-scan</button></div>';
    else if (ocr.status === "failed") h += '<div class="ocrstatus">&#9888;&nbsp;Creative scan unavailable here. Text checks below still ran; the creative goes to manual review (never auto-passed).</div>';
  }
  h += '<div class="filebar"><b>' + esc(d.name) + '</b><span>&middot; ' + esc(state.ruleset.rulesetName) + ' ' + esc(state.ruleset.version) + ' loaded</span>' +
    '<span style="margin-left:auto"></span>' +
    '<button class="linkbtn" id="uploadBtn">Upload creative</button>' +
    '<button class="linkbtn" id="demoBtn">Use demo draft</button></div>' +
    '<input type="file" id="fileInput" accept="image/*" class="hidden">';
  // caption
  var capFlags = state.flags.filter(function (f) { return f.sourceType === "caption" && !state.decisions[fingerprint(f)]; });
  var chips = {};
  capFlags.forEach(function (f) { chips[f.ruleId + "|" + f.severity] = true; });
  h += '<div class="captionblock"><div class="caplabels"><span class="caplabel">LINKED CAPTION &middot; CHECKED AS TEXT</span>' +
    Object.keys(chips).map(function (k) { var p = k.split("|"); return '<span class="chip ' + sevClass(p[1]) + '">' + esc(p[0]) + '</span>'; }).join("") + '</div>';
  if (state.captionEditing) {
    h += '<textarea class="captionedit" id="captionEdit">' + esc(d.caption) + '</textarea>' +
      '<div class="capbtns"><button class="btn" id="capSave">Save &amp; re-check</button><button class="btn ghost" id="capCancel">Cancel</button></div>';
  } else {
    h += '<div class="captiontext serif">' + captionHTML() + '</div>' +
      '<div class="capbtns"><button class="linkbtn" id="capEditBtn">Edit caption</button></div>';
  }
  h += '</div>';
  return h;
}

function resultsHTML(canApprove) {
  var flags = state.flags;
  var open = undecided().length;
  var done = decidedCount();
  var h = '<div class="rhead"><span style="color:#1e5c40">&#10022;</span><span class="cardtitle">Review Results</span>' +
    '<span class="issuespill ' + (open === 0 ? "ok" : "") + '">' + (open === 0 ? "No Open Issues" + (done ? " &middot; " + done + " resolved" : "") : open + " Open" + (done ? " &middot; " + done + " resolved" : "")) + '</span></div>';
  if (!flags.length && !state.manualReview.length) {
    h += '<div class="allclear">No rule violations found in the current draft with the loaded ruleset. Add or enable rules on the Brand Rules page, or approve below.</div>';
  }
  flags.forEach(function (f) {
    var dec = state.decisions[fingerprint(f)];
    var open1 = state.expanded[f.id] !== false; // expanded by default
    var icon = dec ? "&#10003;" : f.severity === "high" ? "!" : f.severity === "low" ? "+" : "&#9651;";
    if (!open1) {
      h += '<div class="issuec' + (dec ? " resolved" : "") + '" data-expand="' + f.id + '"><div class="ixicon' + (dec ? " resolved" : "") + '">' + icon + '</div>' +
        '<span class="ixtitle">' + esc(f.name) + '</span><span class="ixsub">' + esc(f.ruleId) + ' &middot; "' + esc(f.matched) + '" in ' + (f.sourceType === "caption" ? "caption" : "creative") + '</span>' +
        (dec ? '<span class="resolvedtag">' + decLabel(dec) + '</span>' : '<span class="sev ' + sevClass(f.severity) + '">' + cap(f.severity) + '</span>') +
        '<button class="chev" data-expand="' + f.id + '">&#8970;</button></div>';
    } else {
      h += '<div class="issuex' + (dec ? " resolved" : "") + '"><div class="ixhead"><div class="ixicon' + (dec ? " resolved" : "") + '">' + icon + '</div>' +
        '<span class="ixtitle">' + esc(f.name) + '</span>' +
        (dec ? '<span class="resolvedtag">' + decLabel(dec) + '</span>' : '<span class="sev ' + sevClass(f.severity) + '">' + cap(f.severity) + '</span>') +
        '<button class="chev" data-expand="' + f.id + '">&#8963;</button></div>' +
        '<div class="ixsec"><div class="ixlabel">&#8850; ISSUE</div><div class="ixbody">"' + esc(f.matched) + '" found in the <b>' + (f.sourceType === "caption" ? "linked caption" : "creative text") + '</b>' + (f.ocrConfidence ? ' (OCR confidence ' + f.ocrConfidence + '%)' : "") + '.</div></div>' +
        '<div class="ixsec"><div class="ixlabel why">&#9674; WHY IT MATTERS</div><div class="ixbody">' + esc(f.why) + '</div></div>' +
        (f.suggestion ? '<div class="ixsec"><div class="ixlabel fix">&#9874; SUGGESTED FIX</div><div class="fixbox">' +
          (f.suggestion.kind === "copy-change"
            ? 'Queue copy change for the design re-export: <b>"' + esc(f.suggestion.text) + '"</b> &mdash; ' + esc(f.suggestion.note) + '<br><span style="font-size:11.5px;color:#5f6a5c">This app does not edit poster pixels; the approved wording is handed to design in the export report.</span>'
            : 'Replace with: <b>"' + esc(f.suggestion.text) + '"</b> &mdash; ' + esc(f.suggestion.note)) + '</div></div>' : "") +
        '<div class="ixsec"><div class="ixlabel src">&#9713; RULE SOURCE</div><div class="ixbody" style="font-size:11.8px;color:#5f6a5c">' + esc(f.sourceRef.doc) + ' ' + esc(f.sourceRef.version) + ' &mdash; "' + esc(f.sourceRef.quote) + '"</div></div>' +
        '<div class="ixbtns">' +
        (dec ? '<button class="undo" data-undo="' + f.id + '">Undo decision</button>'
             : (f.suggestion ? '<button class="apply" data-apply="' + f.id + '">' + (f.suggestion.kind === "copy-change" ? "&#10003; Queue Copy Change" : "&#10003; Apply Suggestion") + '</button>' : "") +
               '<button class="dismiss" data-dismiss="' + f.id + '">&#10007; Dismiss</button>') +
        '</div></div>';
    }
  });
  state.manualReview.forEach(function (mr, i) {
    var done = state.decisions[manualKey(i)];
    h += '<div class="manualcard">&#9888;&nbsp;<b>Manual review</b> &mdash; ' + esc(mr.message) +
      (done ? ' <span class="resolvedtag">reviewed</span>' : ' <div style="margin-top:8px"><button class="mini" data-manual="' + i + '">Mark as reviewed</button></div>') + '</div>';
  });
  h += '<div class="scopenote"><b>What gets checked:</b> caption text and text detected on the creative, against the loaded rules (claims, tone, terminology). ' +
    '<b>Not auto-checked:</b> colours, layout, logo placement and other purely visual rules - those go to manual review above. Checks are rule-based and fully explainable; nothing is auto-passed.</div>';
  return h;
}
function decLabel(d) { return d.decision === "applied" ? "Fix applied" : d.decision === "copy-change" ? "Copy change queued" : "Dismissed"; }
function cap(s) { return s.charAt(0).toUpperCase() + s.slice(1); }

/* ---------- overlays on poster ---------- */
function positionOverlays() {
  var img = document.getElementById("posterimg"), host = document.getElementById("overlays");
  if (!img || !host) return;
  function draw() {
    host.innerHTML = "";
    var w = img.clientWidth, hgt = img.clientHeight;
    if (!w || !img.naturalWidth) return;
    var sx = w / img.naturalWidth, sy = hgt / img.naturalHeight;
    state.flags.filter(function (f) { return f.sourceType === "creative" && f.bbox; }).forEach(function (f) {
      var dec = state.decisions[fingerprint(f)];
      var box = document.createElement("div");
      box.className = "flagbox" + (dec ? " resolved" : "");
      box.style.left = f.bbox.x0 * sx + "px"; box.style.top = f.bbox.y0 * sy + "px";
      box.style.width = (f.bbox.x1 - f.bbox.x0) * sx + "px"; box.style.height = (f.bbox.y1 - f.bbox.y0) * sy + "px";
      var tag = document.createElement("div");
      tag.className = "flagtag" + (dec ? " resolved" : "");
      tag.style.left = (f.bbox.x0 * sx + 4) + "px"; tag.style.top = (f.bbox.y0 * sy + 4) + "px";
      tag.textContent = f.ruleId;
      var badge = document.createElement("div");
      badge.className = "flagbadge" + (dec ? " resolved" : "");
      badge.style.left = f.bbox.x1 * sx + "px"; badge.style.top = f.bbox.y0 * sy + "px";
      badge.innerHTML = dec ? "&#10003;" : "!";
      host.appendChild(box); host.appendChild(tag); host.appendChild(badge);
    });
  }
  if (img.complete && img.naturalWidth) draw(); else img.onload = draw;
  window.onresize = draw;
}

/* ---------- rules view ---------- */
function rulesView() {
  var rs = state.ruleset;
  var h = '<div class="pagehead"><div class="pagetitle serif">Brand Rules</div><span class="cardmeta">' + esc(rs.rulesetName) + ' ' + esc(rs.version) + ' &middot; ' + rs.rules.length + ' rules &middot; every flag quotes these exact rules</span>' +
    '<div class="pageactions"><button class="btn" id="addRule">+ Add rule</button><button class="btn ghost" id="importRules">Import JSON</button><button class="btn ghost" id="exportRules">Export JSON</button><button class="btn danger" id="resetRules">Reset to demo</button>' +
    '<input type="file" id="rulesInput" accept="application/json" class="hidden"></div></div>';
  (rs.approvedFacts || []).forEach(function (f) {
    h += '<div class="rulecard"><div class="rulehead"><span class="ruleid">' + esc(f.id) + '</span><span class="rulename">Approved fact</span></div>' +
      '<div class="rulebody">"' + esc(f.text) + '"<br><span style="font-size:11.5px;color:#7a8272">Source: ' + esc(f.source.doc) + ' ' + esc(f.source.version) + '</span></div></div>';
  });
  rs.rules.forEach(function (r, i) {
    h += '<div class="rulecard' + (r.enabled === false ? " off" : "") + '"><div class="rulehead">' +
      '<span class="ruleid">' + esc(r.id) + '</span><span class="rulename">' + esc(r.name) + '</span>' +
      '<span class="rulecat">' + esc(r.category) + ' &middot; ' + esc(r.severity) + '</span>' +
      '<label class="switch"><input type="checkbox" data-toggle-rule="' + i + '" ' + (r.enabled === false ? "" : "checked") + '><span class="sl"></span></label></div>' +
      '<div class="rulebody">Matches: ' + r.patterns.map(function (p) { return "<code>" + esc(p) + "</code>"; }).join(" ") + (r.regex ? ' <span class="rulecat">(regex)</span>' : "") +
      '<br>' + esc(r.why) + '<br><span style="font-size:11.5px;color:#7a8272">Source: ' + esc(r.source.doc) + ' ' + esc(r.source.version) + ' &mdash; "' + esc(r.source.quote) + '"</span></div>' +
      '<div class="rulebtns"><button class="mini" data-edit-rule="' + i + '">Edit</button><button class="mini" data-del-rule="' + i + '">Delete</button></div></div>';
  });
  h += '<div class="scopenote">Changes here take effect on the next check run. Import accepts the same JSON shape: rules with id, name, category, severity, patterns (substrings or regex), why, suggestion and source.</div>';
  return h;
}

/* ---------- history / insights ---------- */
function historyView() {
  var hist = load(LS.history) || [];
  var h = '<div class="pagehead"><div class="pagetitle serif">History</div><span class="cardmeta">every approval, fix and dismissal, logged on this device</span></div>';
  if (!hist.length) return h + '<div class="empty">No completed reviews yet.<br>Run a review on the Review Content page and approve it - the audit record appears here.</div>';
  hist.forEach(function (x) {
    h += '<div class="hcard"><div class="htitle">' + esc(x.content) + '</div><div class="hmeta">' + new Date(x.ts).toLocaleString("en-IN") + ' &middot; ' + x.decisions + ' decisions: ' + x.applied + ' applied, ' + x.dismissed + ' dismissed, ' + x.copyChanges + ' creative copy changes queued</div>' +
      '<div class="hlist">Final caption: "' + esc(x.caption) + (x.caption.length >= 140 ? "&hellip;" : "") + '"</div></div>';
  });
  return h;
}
function insightsView() {
  return '<div class="pagehead"><div class="pagetitle serif">Insights</div><span class="cardmeta">planned for Round 3</span></div>' +
    '<div class="empty" style="text-align:left;line-height:1.8"><b>Round 3 scope (declared in our submission):</b><br>' +
    '1. <b>Recurring-flag analytics</b> - which brand rules get flagged most, so the guidelines themselves improve.<br>' +
    '2. <b>Role-based workspaces</b> - creator, manager and reviewer queues with assignments (from our Round 1 plan).<br>' +
    '3. <b>Visual-rule checks via a vision model</b> - contrast, safe zones and logo usage on the creative itself, wired through the same cited-flag pipeline.<br><br>' +
    'These need backend storage and a vision API, so they are honestly scoped for Round 3 rather than faked here.</div>';
}

/* ---------- wiring ---------- */
function wire(m) {
  m.querySelectorAll("[data-expand]").forEach(function (b) { b.addEventListener("click", function (ev) { ev.stopPropagation(); var id = b.dataset.expand; state.expanded[id] = state.expanded[id] === false; render(); }); });
  m.querySelectorAll("[data-apply]").forEach(function (b) { b.addEventListener("click", function () { applyFlag(findFlag(b.dataset.apply)); }); });
  m.querySelectorAll("[data-dismiss]").forEach(function (b) { b.addEventListener("click", function () { dismissFlag(findFlag(b.dataset.dismiss)); }); });
  m.querySelectorAll("[data-undo]").forEach(function (b) { b.addEventListener("click", function () { undoDecision(findFlag(b.dataset.undo)); }); });
  m.querySelectorAll("[data-manual]").forEach(function (b) { b.addEventListener("click", function () { markReviewed(+b.dataset.manual); }); });
  m.querySelectorAll("[data-tog]").forEach(function (b) { b.addEventListener("click", function () { state.showText = b.dataset.tog === "text"; render(); }); });
  m.querySelectorAll("[data-goto]").forEach(function (b) { b.addEventListener("click", function () { state.view = b.dataset.goto; render(); }); });
  var up = m.querySelector("#uploadBtn"); if (up) up.addEventListener("click", function () { m.querySelector("#fileInput").click(); });
  var fi = m.querySelector("#fileInput"); if (fi) fi.addEventListener("change", function () { if (fi.files[0]) uploadImage(fi.files[0]); });
  var dm = m.querySelector("#demoBtn"); if (dm) dm.addEventListener("click", useDemo);
  var rs = m.querySelector("#rescanBtn"); if (rs) rs.addEventListener("click", function () { state.draft.ocr = { status: "idle" }; runOcrIfNeeded(); });
  var sb = m.querySelector("#saveBtn"); if (sb) sb.addEventListener("click", function () { persistDraft(); save("brd.session", { decisions: state.decisions, seen: state.seen }); toast("Draft and review progress saved on this device."); });
  var ab = m.querySelector("#approveBtn"); if (ab) ab.addEventListener("click", approveExport);
  var ce = m.querySelector("#capEditBtn"); if (ce) ce.addEventListener("click", function () { state.captionEditing = true; render(); });
  var cc = m.querySelector("#capCancel"); if (cc) cc.addEventListener("click", function () { state.captionEditing = false; render(); });
  var cs = m.querySelector("#capSave"); if (cs) cs.addEventListener("click", function () {
    state.draft.caption = m.querySelector("#captionEdit").value; state.captionEditing = false; persistDraft(); runChecksNow(); toast("Caption saved and re-checked.");
  });
  // rules page
  var ar = m.querySelector("#addRule"); if (ar) ar.addEventListener("click", function () { ruleModal(null); });
  m.querySelectorAll("[data-edit-rule]").forEach(function (b) { b.addEventListener("click", function () { ruleModal(+b.dataset.editRule); }); });
  m.querySelectorAll("[data-del-rule]").forEach(function (b) { b.addEventListener("click", function () {
    if (confirm("Delete rule " + state.ruleset.rules[+b.dataset.delRule].id + "?")) { state.ruleset.rules.splice(+b.dataset.delRule, 1); save(LS.rules, state.ruleset); runChecksNow(); }
  }); });
  m.querySelectorAll("[data-toggle-rule]").forEach(function (b) { b.addEventListener("change", function () {
    state.ruleset.rules[+b.dataset.toggleRule].enabled = b.checked; save(LS.rules, state.ruleset); runChecksNow();
  }); });
  var ir = m.querySelector("#importRules"); if (ir) ir.addEventListener("click", function () { m.querySelector("#rulesInput").click(); });
  var ri = m.querySelector("#rulesInput"); if (ri) ri.addEventListener("change", function () {
    var f = ri.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var obj = JSON.parse(r.result);
        if (!obj.rules || !Array.isArray(obj.rules)) throw new Error("missing rules array");
        obj.rules.forEach(function (x) { if (!x.id || !x.patterns || !x.why || !x.source) throw new Error("rule " + (x.id || "?") + " is missing id/patterns/why/source"); });
        state.ruleset = obj; save(LS.rules, obj); runChecksNow(); toast("Ruleset imported: " + obj.rules.length + " rules loaded.");
      } catch (e) { toast("Import failed: " + e.message); }
    };
    r.readAsText(f);
  });
  var er = m.querySelector("#exportRules"); if (er) er.addEventListener("click", function () { download("brand-rules.json", JSON.stringify(state.ruleset, null, 2), "application/json"); });
  var rr = m.querySelector("#resetRules"); if (rr) rr.addEventListener("click", function () {
    if (confirm("Reset to the demo Arka Foods ruleset? Your edits will be lost.")) { state.ruleset = window.DEFAULT_RULESET; localStorage.removeItem(LS.rules); runChecksNow(); }
  });
}
function findFlag(id) { return state.flags.find(function (f) { return f.id === id; }); }

/* ---------- rule editor modal ---------- */
function ruleModal(idx) {
  var r = idx == null ? { id: "", name: "", category: "", severity: "medium", type: "phrase", regex: false, patterns: [], why: "", suggestion: { kind: "replace", text: "", note: "" }, source: { doc: "", version: "", quote: "" }, enabled: true } : state.ruleset.rules[idx];
  var root = document.getElementById("modalroot");
  root.innerHTML = '<div class="modalbg"><div class="modal"><div class="mtitle">' + (idx == null ? "Add rule" : "Edit " + esc(r.id)) + '</div>' +
    f("Rule ID", "m_id", r.id, "e.g. TERM-03") + f("Name", "m_name", r.name, "e.g. Terminology") + f("Category", "m_cat", r.category, "e.g. Approved Terminology") +
    '<div class="frow"><label class="flabel">Severity</label><select class="fsel" id="m_sev">' + ["high", "medium", "low"].map(function (s) { return '<option ' + (r.severity === s ? "selected" : "") + ">" + s + "</option>"; }).join("") + '</select></div>' +
    f("Patterns (comma-separated)", "m_pat", r.patterns.join(", "), "exact phrases, or a regex") +
    '<div class="frow"><label><input type="checkbox" id="m_regex" ' + (r.regex ? "checked" : "") + '> patterns are regular expressions</label></div>' +
    '<div class="frow"><label class="flabel">Why it matters</label><textarea class="fta" id="m_why">' + esc(r.why) + '</textarea></div>' +
    f("Suggested replacement", "m_sugg", r.suggestion ? r.suggestion.text : "", "approved wording") +
    f("Suggestion note", "m_suggnote", r.suggestion ? r.suggestion.note : "", "") +
    f("Source document", "m_doc", r.source.doc, "e.g. Brand Book") + f("Source version", "m_ver", r.source.version, "e.g. v3") +
    '<div class="frow"><label class="flabel">Source quote (shown on every flag)</label><textarea class="fta" id="m_quote">' + esc(r.source.quote) + '</textarea></div>' +
    '<div class="mbtns"><button class="btn ghost" id="m_cancel">Cancel</button><button class="btn" id="m_save">Save rule</button></div></div></div>';
  document.getElementById("m_cancel").addEventListener("click", function () { root.innerHTML = ""; });
  document.getElementById("m_save").addEventListener("click", function () {
    var nr = { id: v("m_id"), name: v("m_name"), category: v("m_cat"), severity: document.getElementById("m_sev").value,
      type: "phrase", regex: document.getElementById("m_regex").checked,
      patterns: v("m_pat").split(",").map(function (s) { return s.trim(); }).filter(Boolean),
      why: v("m_why"), suggestion: v("m_sugg") ? { kind: "replace", text: v("m_sugg"), note: v("m_suggnote") } : null,
      source: { doc: v("m_doc"), version: v("m_ver"), quote: v("m_quote") }, enabled: true };
    if (!nr.id || !nr.patterns.length || !nr.why || !nr.source.quote) { toast("Rule needs an ID, at least one pattern, why and a source quote."); return; }
    if (nr.regex) { try { new RegExp(nr.patterns[0]); } catch (e) { toast("Invalid regex: " + e.message); return; } }
    if (idx == null) state.ruleset.rules.push(nr); else { nr.enabled = state.ruleset.rules[idx].enabled; state.ruleset.rules[idx] = nr; }
    save(LS.rules, state.ruleset); root.innerHTML = ""; runChecksNow(); toast("Rule saved and checks re-run.");
  });
  function f(label, id, val, ph) { return '<div class="frow"><label class="flabel">' + label + '</label><input class="fin" id="' + id + '" value="' + esc(val) + '" placeholder="' + esc(ph) + '"></div>'; }
  function v(id) { return document.getElementById(id).value.trim(); }
}

/* ---------- partial re-render used during OCR progress ---------- */
function renderDraftCard() { if (state.view === "review") render(); }

window.addEventListener("DOMContentLoaded", init);
})();
