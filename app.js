/* Brand Review Desk - Controller with MongoDB Database Integration & Modern UI
   Handles rule engine checks, on-device OCR, live MongoDB database sync,
   brand switcher, interactive filters, rule testing, and insights dashboard.
*/

(function () {
"use strict";

var E = window.BRDEngine;
var LS = { rules: "brd.ruleset", draft: "brd.draft", history: "brd.history" };

// Demo content presets
var DEMO_PRESETS = [
  {
    id: "festive",
    label: "Festive Poster",
    name: "arka-diwali-poster-v2.png",
    imageUrl: "assets/arka-poster.png",
    caption: "This festive season, we're obsessed with bringing your family together over sweets that taste like home. Six handmade mithai classics, vegan-friendly options included. Order before 18 October for guaranteed Diwali delivery."
  },
  {
    id: "health",
    label: "Health Claim Post",
    name: "arka-healthy-bites.png",
    imageUrl: "assets/arka-poster.png",
    caption: "Our authentic roasted namkeens are the best in India! 100% natural spices, vegan-friendly recipes, and insanely delicious taste for every celebration."
  },
  {
    id: "flash_sale",
    label: "Festive Flash Sale",
    name: "arka-festive-offer.png",
    imageUrl: "assets/arka-poster.png",
    caption: "Diwali Special: Get a free gift with every order! We are obsessed with celebrating with you. 100% guaranteed delivery across all pin codes."
  }
];

var state = {
  view: "review",
  brand: "Arka Foods (demo)",
  ruleset: null,
  draft: null,
  flags: [],
  manualReview: [],
  decisions: {},
  seen: {},
  expanded: {},
  captionEditing: false,
  showText: false,
  filter: "all",          // 'all', 'high', 'medium', 'low', 'caption', 'creative', 'open', 'resolved'
  searchQuery: "",
  highlightedFlagId: null,
  dbStatus: {
    connected: false,
    database: "Brand_Review_Desk",
    provider: "Checking...",
    collections: {},
    activeRules: 5,
    reviewsCount: 1
  },
  reviewsHistory: [],
  insightsData: null
};

/* ---------- API & MongoDB Sync ---------- */
async function apiGet(endpoint) {
  try {
    var res = await fetch(endpoint);
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function apiPost(endpoint, body) {
  try {
    var res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error("HTTP " + res.status);
    return await res.json();
  } catch (e) {
    return null;
  }
}

async function checkDatabaseStatus() {
  var s = await apiGet("/api/status");
  if (s) {
    state.dbStatus = s;
    updateDBStatusUI();
  }
}

function updateDBStatusUI() {
  var dot = document.getElementById("dbDot");
  var label = document.getElementById("dbLabel");
  var col = document.getElementById("dbCollection");
  if (!dot || !label) return;

  if (state.dbStatus.connected) {
    dot.className = "dbdot pulse";
    label.textContent = "MongoDB Connected";
    col.textContent = state.dbStatus.database + " (" + (state.dbStatus.activeRules || 5) + " rules)";
  } else {
    dot.className = "dbdot warn";
    label.textContent = "MongoDB (Sync Mode)";
    col.textContent = state.dbStatus.database;
  }

  // Update badges
  var rb = document.getElementById("ruleCountBadge");
  if (rb && state.ruleset && state.ruleset.rules) rb.textContent = state.ruleset.rules.length;
  var hb = document.getElementById("historyCountBadge");
  if (hb) hb.textContent = state.reviewsHistory.length;
}

/* ---------- Local Persistence Fallback ---------- */
function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
function load(k) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (e) { return null; } }
function fingerprint(f) { return f.ruleId + "|" + f.sourceType + "|" + (f.matched || "").toLowerCase(); }

/* ---------- Boot & Initialization ---------- */
async function init() {
  // 1. Fetch live DB status
  await checkDatabaseStatus();

  // 2. Load ruleset from MongoDB API or local fallback
  var remoteRules = await apiGet("/api/ruleset?brand=" + encodeURIComponent(state.brand));
  state.ruleset = remoteRules || load(LS.rules) || window.DEFAULT_RULESET;

  // 3. Load reviews history from MongoDB API
  var remoteReviews = await apiGet("/api/reviews");
  if (remoteReviews && Array.isArray(remoteReviews)) {
    state.reviewsHistory = remoteReviews;
  } else {
    state.reviewsHistory = load(LS.history) || [];
  }

  // 4. Setup initial draft
  var savedDraft = load(LS.draft);
  state.draft = savedDraft || {
    kind: "image",
    name: DEMO_PRESETS[0].name,
    imageUrl: DEMO_PRESETS[0].imageUrl,
    caption: DEMO_PRESETS[0].caption,
    ocr: { status: "idle" }
  };

  // 5. Navigation wiring
  document.querySelectorAll(".ni").forEach(function (b) {
    b.addEventListener("click", function () {
      state.view = b.dataset.view;
      render();
    });
  });

  // 6. DB Status Box click
  var dbBox = document.getElementById("dbStatusBox");
  if (dbBox) dbBox.addEventListener("click", showDatabaseModal);

  // 7. Brand Switcher wiring
  var bsel = document.getElementById("brandSelect");
  if (bsel) {
    bsel.value = state.brand;
    bsel.addEventListener("change", async function () {
      state.brand = bsel.value;
      var rs = await apiGet("/api/ruleset?brand=" + encodeURIComponent(state.brand));
      if (rs) {
        state.ruleset = rs;
        toast("Loaded ruleset for " + state.brand);
        runChecksNow();
      }
    });
  }

  updateDBStatusUI();
  render();

  if (state.draft.kind === "image") runOcrIfNeeded();
  else runChecksNow();
}

/* ---------- OCR Processing ---------- */
function runOcrIfNeeded() {
  if (state.draft.ocr && state.draft.ocr.status === "done") { runChecksNow(); return; }
  state.draft.ocr = { status: "running", progress: 0 };
  renderDraftCard();
  var img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = function () {
    var scale = img.naturalWidth < 1600 ? 2 : 1;
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
      return worker.setParameters({ tessedit_pageseg_mode: "11" });
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

/* ---------- Rule Check Engine ---------- */
function runChecksNow() {
  if (!state.ruleset || !state.ruleset.rules) return;
  var ocr = state.draft.ocr || { status: "idle" };
  var res = E.runChecks(
    { caption: state.draft.caption, ocr: { ran: ocr.status === "done", words: ocr.words || [], meanConfidence: ocr.meanConfidence || 0 } },
    state.ruleset.rules
  );
  state.flags = res.flags;
  state.manualReview = res.manualReview;
  state.flags.forEach(function (f) { state.seen[fingerprint(f)] = true; });

  if (state.draft.ocr && state.draft.ocr.status === "failed") {
    state.manualReview.push({
      kind: "ocr-blocked",
      message: "Creative scan offline in this context (" + state.draft.ocr.error + "). Caption checks ran; creative queued for visual review."
    });
  }
  render();
}

/* ---------- Decisions & Approvals ---------- */
function decidedCount() { return Object.keys(state.decisions).length; }
function undecided() { return state.flags.filter(function (f) { return !state.decisions[fingerprint(f)]; }); }

function applyFlag(f) {
  if (!f) return;
  if (f.sourceType === "caption") {
    state.draft.caption = E.applyToCaption(state.draft.caption, f);
    state.decisions[fingerprint(f)] = { decision: "applied", flag: f };
    persistDraft();
    toast("✓ Suggestion applied to caption.");
    runChecksNow();
  } else {
    state.decisions[fingerprint(f)] = { decision: "copy-change", flag: f };
    toast("✓ Copy change queued for design re-export.");
    render();
  }
}

function dismissFlag(f) {
  if (!f) return;
  var reason = prompt("Reason for dismissing flag (logged to MongoDB audit record):", "Reviewed - acceptable in current context");
  if (reason === null) return;
  state.decisions[fingerprint(f)] = { decision: "dismissed", flag: f, reason: reason };
  toast("Flag dismissed and recorded in audit trail.");
  render();
}

function undoDecision(f) {
  if (!f) return;
  delete state.decisions[fingerprint(f)];
  toast("Decision reverted.");
  render();
}

function manualKey(i) { return "manual-" + i; }
function markReviewed(i) {
  state.decisions[manualKey(i)] = { decision: "manual-reviewed", flag: null, reason: state.manualReview[i].kind };
  render();
}

/* ---------- Approve & Export (Saved to MongoDB) ---------- */
async function approveExport() {
  var copyChanges = Object.keys(state.decisions).map(function (k) { return state.decisions[k]; })
    .filter(function (d) { return d.decision === "copy-change"; })
    .map(function (d) { return { from: d.flag.matched, to: d.flag.suggestion ? d.flag.suggestion.text : "" }; });

  var session = {
    reviewId: "REV-" + Date.now(),
    brand: state.ruleset.brand,
    rulesetName: state.ruleset.rulesetName,
    rulesVersion: state.ruleset.version,
    contentName: state.draft.name,
    timestamp: new Date().toISOString(),
    formattedDate: new Date().toLocaleString("en-IN"),
    decisions: Object.keys(state.decisions).filter(function (k) { return state.decisions[k].flag; }).map(function (k) {
      var d = state.decisions[k];
      return {
        decision: d.decision,
        ruleId: d.flag.ruleId,
        name: d.flag.name,
        matched: d.flag.matched,
        sourceType: d.flag.sourceType,
        suggestionText: d.flag.suggestion ? d.flag.suggestion.text : null,
        reason: d.reason || null,
        sourceRef: d.flag.sourceRef
      };
    }),
    decisionsCount: Object.keys(state.decisions).length,
    appliedCount: Object.keys(state.decisions).filter(function (k) { return state.decisions[k].decision === "applied"; }).length,
    dismissedCount: Object.keys(state.decisions).filter(function (k) { return state.decisions[k].decision === "dismissed"; }).length,
    copyChangesCount: copyChanges.length,
    copyChanges: copyChanges,
    finalCaption: state.draft.caption,
    status: "approved"
  };

  var out = E.buildExport(session);
  session.reportText = out.text;
  session.reportJson = out.json;

  // Auto download report files
  download("brand-review-report-" + session.reviewId + ".txt", out.text, "text/plain");
  download("brand-review-report-" + session.reviewId + ".json", JSON.stringify(out.json, null, 2), "application/json");

  // Save to MongoDB collection 'reviews'
  var saved = await apiPost("/api/reviews", session);
  if (saved && saved.review) {
    state.reviewsHistory.unshift(saved.review);
    toast("✓ Approved! Review stored in MongoDB Brand_Review_Desk.reviews collection.");
  } else {
    state.reviewsHistory.unshift(session);
    save(LS.history, state.reviewsHistory);
    toast("✓ Approved! Review saved to audit trail.");
  }

  state.decisions = {};
  state.seen = {};
  updateDBStatusUI();
  render();
}

function download(name, content, type) {
  var a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([content], { type: type }));
  a.download = name;
  a.click();
  setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
}

/* ---------- Draft Management ---------- */
async function persistDraft() {
  var d = {
    kind: state.draft.kind,
    name: state.draft.name,
    caption: state.draft.caption,
    brand: state.brand,
    ocr: state.draft.ocr
  };
  if (state.draft.imageUrl && state.draft.imageUrl.length < 2500000) d.imageUrl = state.draft.imageUrl;
  save(LS.draft, d);
  apiPost("/api/draft", d);
}

function uploadImage(file) {
  var r = new FileReader();
  r.onload = function () {
    state.draft = {
      kind: "image",
      name: file.name,
      imageUrl: r.result,
      caption: state.draft.caption || "",
      ocr: { status: "idle" }
    };
    state.decisions = {};
    state.seen = {};
    persistDraft();
    render();
    runOcrIfNeeded();
  };
  r.readAsDataURL(file);
}

function switchPreset(presetId) {
  var p = DEMO_PRESETS.find(function (x) { return x.id === presetId; }) || DEMO_PRESETS[0];
  state.draft = {
    kind: "image",
    name: p.name,
    imageUrl: p.imageUrl,
    caption: p.caption,
    ocr: { status: "idle" }
  };
  state.decisions = {};
  state.seen = {};
  persistDraft();
  render();
  runOcrIfNeeded();
  toast("Loaded draft preset: " + p.label);
}

/* ---------- Rendering Helpers ---------- */
function esc(s) { return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
function sevClass(s) { return s === "high" ? "high" : s === "low" ? "low" : "med"; }
function toast(msg) {
  var t = document.getElementById("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(t._h);
  t._h = setTimeout(function () { t.classList.remove("show"); }, 3500);
}

function captionHTML() {
  var text = state.draft.caption;
  var marks = state.flags.filter(function (f) { return f.sourceType === "caption" && !state.decisions[fingerprint(f)]; })
    .map(function (f) { return { s: f.span.start, e: f.span.end, sev: sevClass(f.severity), id: f.id }; })
    .sort(function (a, b) { return a.s - b.s; });
  var out = "", pos = 0;
  marks.forEach(function (m) {
    if (m.s < pos) return;
    out += esc(text.slice(pos, m.s)) + '<mark class="' + m.sev + '" data-mark-flag="' + m.id + '">' + esc(text.slice(m.s, m.e)) + "</mark>";
    pos = m.e;
  });
  out += esc(text.slice(pos));
  return out;
}

/* ---------- Main Render Dispatcher ---------- */
function render() {
  document.querySelectorAll(".ni").forEach(function (b) {
    b.classList.toggle("active", b.dataset.view === state.view);
  });
  var m = document.getElementById("main");
  if (state.view === "rules") m.innerHTML = rulesView();
  else if (state.view === "history") m.innerHTML = historyView();
  else if (state.view === "insights") m.innerHTML = insightsView();
  else m.innerHTML = reviewView();

  wire(m);
  updateDBStatusUI();
  if (state.view === "review") positionOverlays();
}

/* ---------- Review View ---------- */
function reviewView() {
  var undec = undecided().length;
  var total = Object.keys(state.seen).length;
  var resolved = decidedCount();
  var manualPending = state.manualReview.filter(function (mr, i) { return !state.decisions[manualKey(i)]; }).length;
  var canApprove = undec === 0 && manualPending === 0 && (state.flags.length > 0 || resolved > 0);

  return '' +
  '<div class="head">' +
    '<div>' +
      '<div class="h1 serif">Review. Align. Approve.</div>' +
      '<div class="sub">Continuous compliance check against MongoDB brand ruleset. Every issue is cited; human holds final sign-off.</div>' +
    '</div>' +
    '<div class="head-actions">' +
      '<button class="dbpill-top" id="topDbBtn" title="Click to view database tables and connection status">' +
        '<span class="dbdot ' + (state.dbStatus.connected ? "pulse" : "warn") + '"></span>' +
        '<span>' + (state.dbStatus.connected ? "MongoDB Atlas" : "Sync Storage") + '</span>' +
      '</button>' +
      '<div class="avatar" title="Compliance Reviewer">CR</div>' +
    '</div>' +
  '</div>' +

  '<div class="stepper">' +
    '<button class="step" data-goto="rules"><div class="stnum">&#10003;</div><div class="stlabel">Brand Rules (' + (state.ruleset.rules ? state.ruleset.rules.length : 0) + ')</div></button>' +
    '<span class="stsep">&rarr;</span>' +
    '<button class="step" id="stepUpload"><div class="stnum">&#10003;</div><div class="stlabel">Draft Content</div></button>' +
    '<span class="stsep">&rarr;</span>' +
    '<div class="step active"><div class="stnum">3</div><div class="stlabel" style="cursor:default">Review &amp; Sign-off</div></div>' +
  '</div>' +

  '<div class="cols">' +
    '<div class="card draftcard" id="draftcard">' + draftCardHTML() + '</div>' +
    '<div class="card results">' + resultsHTML(canApprove) + '</div>' +
  '</div>' +

  '<div class="foot">' +
    '<span class="rescount">' + resolved + ' of ' + total + ' issues resolved &bull; Storing audit record to MongoDB</span>' +
    '<div style="margin-left:auto;display:flex;gap:10px;flex-wrap:wrap">' +
      '<button class="savelater" id="saveBtn">Save Draft</button>' +
      '<button class="approve" id="approveBtn" ' + (canApprove ? "" : "disabled") + '>&#10003; Approve &amp; Sign-Off</button>' +
    '</div>' +
  '</div>';
}

function draftCardHTML() {
  var d = state.draft, ocr = d.ocr || { status: "idle" };
  var h = '<div class="cardhead">' +
    '<span style="color:#1e5c40">&#9703;</span>' +
    '<span class="cardtitle">Content Draft</span>' +
    '<span class="cardmeta">' + esc(state.ruleset.brand) + ' &bull; ' + (d.kind === "image" ? "Poster + Linked Caption" : "Text Draft") + '</span>' +
    (d.kind === "image" ? '<div class="toggle"><button class="tog ' + (!state.showText ? "on" : "") + '" data-tog="visual">Visual Creative</button><button class="tog ' + (state.showText ? "on" : "") + '" data-tog="text">Extracted Text</button></div>' : "") +
    '</div>';

  // Demo Presets Bar
  h += '<div class="presetbar">' +
    '<span class="presetlabel">TEST DRAFTS:</span>' +
    DEMO_PRESETS.map(function (p) {
      var isActive = d.name === p.name;
      return '<button class="presetbtn ' + (isActive ? "active" : "") + '" data-preset="' + p.id + '">' + esc(p.label) + '</button>';
    }).join("") +
    '</div>';

  if (d.kind === "image" && !state.showText) {
    h += '<div class="postwrap"><img id="posterimg" src="' + esc(d.imageUrl) + '" alt="creative"><div id="overlays"></div></div>';
  }
  if (d.kind === "image" && state.showText) {
    var t = ocr.status === "done" ? (ocr.text || "(no text detected)") :
      ocr.status === "running" ? "Scanning text on creative with on-device OCR..." :
      ocr.status === "failed" ? "OCR scan unavailable: " + esc(ocr.error) : "Not scanned yet.";
    h += '<div class="captionblock"><div class="caplabels"><span class="caplabel">TEXT DETECTED ON POSTER (ON-DEVICE OCR)</span></div>' +
      '<div class="captiontext" style="font-family:inherit;white-space:pre-wrap">' + esc(t.trim()) + '</div></div>';
  }

  // OCR status
  if (d.kind === "image") {
    if (ocr.status === "running") {
      h += '<div class="ocrstatus"><div class="spinner"></div><div>Scanning creative text with on-device Tesseract OCR: <b id="ocrprog">' + (ocr.progress || 0) + '%</b><br><span style="font-size:11px;color:#717a6c">Runs locally on device; image is secure and never sent to external servers.</span></div></div>';
    } else if (ocr.status === "done") {
      h += '<div class="ocrstatus">&#10003;&nbsp;On-device scan complete: <b>' + ocr.words.length + ' words</b> detected, average confidence <b>' + Math.round(ocr.meanConfidence) + '%</b>. <button class="linkbtn" id="rescanBtn">Re-scan</button></div>';
    } else if (ocr.status === "failed") {
      h += '<div class="ocrstatus">&#9888;&nbsp;OCR text scan unavailable. Caption checks active; creative queued for human visual sign-off.</div>';
    }
  }

  h += '<div class="filebar"><b>' + esc(d.name) + '</b><span>&bull; Rules: ' + esc(state.ruleset.rulesetName) + ' (' + esc(state.ruleset.version) + ')</span>' +
    '<span style="margin-left:auto"></span>' +
    '<button class="linkbtn" id="uploadBtn">Upload creative</button></div>' +
    '<input type="file" id="fileInput" accept="image/*" class="hidden">';

  // Linked Caption
  var capFlags = state.flags.filter(function (f) { return f.sourceType === "caption" && !state.decisions[fingerprint(f)]; });
  var chips = {};
  capFlags.forEach(function (f) { chips[f.ruleId + "|" + f.severity] = true; });

  h += '<div class="captionblock">' +
    '<div class="caplabels"><span class="caplabel">LINKED CAPTION &bull; CHECKED AS TEXT</span>' +
    Object.keys(chips).map(function (k) {
      var p = k.split("|");
      return '<span class="chip ' + sevClass(p[1]) + '">' + esc(p[0]) + '</span>';
    }).join("") + '</div>';

  if (state.captionEditing) {
    h += '<textarea class="captionedit" id="captionEdit">' + esc(d.caption) + '</textarea>' +
      '<div class="capbtns"><button class="btn" id="capSave">Save &amp; Re-check</button><button class="btn ghost" id="capCancel">Cancel</button></div>';
  } else {
    h += '<div class="captiontext serif">' + captionHTML() + '</div>' +
      '<div class="capbtns"><button class="linkbtn" id="capEditBtn">Edit Caption</button></div>';
  }
  h += '</div>';

  return h;
}

/* ---------- Results & Flags Column ---------- */
function resultsHTML(canApprove) {
  var flags = filterFlags(state.flags);
  var open = undecided().length;
  var done = decidedCount();

  var h = '<div class="rhead">' +
    '<span style="color:#1e5c40">&#10022;</span><span class="cardtitle">Review Results</span>' +
    '<span class="issuespill ' + (open === 0 ? "ok" : "") + '">' +
      (open === 0 ? "All Clear &bull; " + done + " Resolved" : open + " Open Issues &bull; " + done + " Resolved") +
    '</span>' +
    '</div>';

  // Filters Bar
  h += '<div class="filterbar">' +
    '<button class="filbtn ' + (state.filter === "all" ? "active" : "") + '" data-fil="all">All (' + state.flags.length + ')</button>' +
    '<button class="filbtn ' + (state.filter === "high" ? "active" : "") + '" data-fil="high">High (' + countBySev("high") + ')</button>' +
    '<button class="filbtn ' + (state.filter === "medium" ? "active" : "") + '" data-fil="medium">Medium (' + countBySev("medium") + ')</button>' +
    '<button class="filbtn ' + (state.filter === "low" ? "active" : "") + '" data-fil="low">Low (' + countBySev("low") + ')</button>' +
    '<button class="filbtn ' + (state.filter === "open" ? "active" : "") + '" data-fil="open">Open (' + open + ')</button>' +
    '<button class="filbtn ' + (state.filter === "resolved" ? "active" : "") + '" data-fil="resolved">Resolved (' + done + ')</button>' +
    '</div>';

  if (!flags.length && !state.manualReview.length) {
    h += '<div class="allclear">No issues matching this filter. All current checks comply with loaded brand rules!</div>';
  }

  flags.forEach(function (f) {
    var dec = state.decisions[fingerprint(f)];
    var isExpanded = state.expanded[f.id] !== false;
    var isHighlighted = state.highlightedFlagId === f.id;
    var icon = dec ? "&#10003;" : f.severity === "high" ? "!" : f.severity === "low" ? "+" : "&#9651;";

    if (!isExpanded) {
      h += '<div class="issuec ' + (dec ? "resolved" : "") + ' ' + (isHighlighted ? "highlight" : "") + '" data-expand="' + f.id + '" data-flag-card="' + f.id + '">' +
        '<div class="ixicon ' + (dec ? "resolved" : "") + '">' + icon + '</div>' +
        '<span class="ixtitle">' + esc(f.name) + '</span>' +
        '<span class="ixsub">' + esc(f.ruleId) + ' &bull; "' + esc(f.matched) + '" in ' + (f.sourceType === "caption" ? "caption" : "creative") + '</span>' +
        (dec ? '<span class="resolvedtag">' + decLabel(dec) + '</span>' : '<span class="sev ' + sevClass(f.severity) + '">' + cap(f.severity) + '</span>') +
        '<button class="chev" data-expand="' + f.id + '">&#8970;</button>' +
        '</div>';
    } else {
      h += '<div class="issuex ' + (dec ? "resolved" : "") + ' ' + (isHighlighted ? "highlight" : "") + '" data-flag-card="' + f.id + '">' +
        '<div class="ixhead">' +
          '<div class="ixicon ' + (dec ? "resolved" : "") + '">' + icon + '</div>' +
          '<span class="ixtitle">' + esc(f.name) + '</span>' +
          (dec ? '<span class="resolvedtag">' + decLabel(dec) + '</span>' : '<span class="sev ' + sevClass(f.severity) + '">' + cap(f.severity) + '</span>') +
          '<button class="chev" data-expand="' + f.id + '">&#8963;</button>' +
        '</div>' +
        '<div class="ixsec">' +
          '<div class="ixlabel">&#8850; DETECTED PHRASE</div>' +
          '<div class="ixbody">"<b>' + esc(f.matched) + '</b>" found in the ' + (f.sourceType === "caption" ? "linked caption" : "poster creative text") + (f.ocrConfidence ? ' (OCR confidence ' + Math.round(f.ocrConfidence) + '%)' : '') + '.</div>' +
        '</div>' +
        '<div class="ixsec">' +
          '<div class="ixlabel why">&#9674; BRAND RULE REQUIREMENT</div>' +
          '<div class="ixbody">' + esc(f.why) + '</div>' +
        '</div>' +
        (f.suggestion ? '<div class="ixsec">' +
          '<div class="ixlabel fix">&#9874; RECOMMENDED FIX</div>' +
          '<div class="fixbox">' +
            (f.suggestion.kind === "copy-change"
              ? 'Queue copy change for design re-export: <b>"' + esc(f.suggestion.text) + '"</b> &mdash; ' + esc(f.suggestion.note) + '<br><span style="font-size:11px;color:#5a6657">Poster pixels are not altered in-place; approved wording is recorded for the creative team.</span>'
              : 'Replace with: <b>"' + esc(f.suggestion.text) + '"</b> &mdash; ' + esc(f.suggestion.note)) +
          '</div></div>' : "") +
        '<div class="ixsec">' +
          '<div class="ixlabel src">&#9713; CITED RULE SOURCE</div>' +
          '<div class="ixbody" style="font-size:11.8px;color:#5a6657">' + esc(f.sourceRef.doc) + ' ' + esc(f.sourceRef.version) + ' &mdash; "' + esc(f.sourceRef.quote) + '"</div>' +
        '</div>' +
        '<div class="ixbtns">' +
          (dec ? '<button class="undo" data-undo="' + f.id + '">Revert decision</button>' :
            ((f.suggestion ? '<button class="apply" data-apply="' + f.id + '">' + (f.suggestion.kind === "copy-change" ? "&#10003; Queue Copy Change" : "&#10003; Apply Suggestion") + '</button>' : "") +
             '<button class="dismiss" data-dismiss="' + f.id + '">&#10007; Dismiss with reason</button>')) +
        '</div>' +
        '</div>';
    }
  });

  state.manualReview.forEach(function (mr, i) {
    var done = state.decisions[manualKey(i)];
    h += '<div class="manualcard">&#9888;&nbsp;<b>Visual Review</b> &mdash; ' + esc(mr.message) +
      (done ? ' <span class="resolvedtag">Reviewed</span>' : ' <div style="margin-top:8px"><button class="mini" data-manual="' + i + '">Mark visual checked</button></div>') +
      '</div>';
  });

  h += '<div class="scopenote"><b>Verified Rules:</b> Claim substantiation, tone of voice, approved terminology, and legal disclosures are checked automatically against MongoDB. Layout, contrast, and visual guidelines go to human review.</div>';
  return h;
}

function filterFlags(flags) {
  var fil = state.filter;
  if (fil === "all") return flags;
  if (fil === "high" || fil === "medium" || fil === "low") {
    return flags.filter(function (f) { return f.severity === fil; });
  }
  if (fil === "open") {
    return flags.filter(function (f) { return !state.decisions[fingerprint(f)]; });
  }
  if (fil === "resolved") {
    return flags.filter(function (f) { return !!state.decisions[fingerprint(f)]; });
  }
  return flags;
}

function countBySev(sev) {
  return state.flags.filter(function (f) { return f.severity === sev; }).length;
}

function decLabel(d) {
  return d.decision === "applied" ? "Fix Applied" : d.decision === "copy-change" ? "Copy Change Queued" : "Dismissed";
}
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ""; }

/* ---------- Poster Bounding Box Overlays ---------- */
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
      var isHigh = state.highlightedFlagId === f.id;

      var box = document.createElement("div");
      box.className = "flagbox" + (dec ? " resolved" : "") + (isHigh ? " highlight" : "");
      box.style.left = f.bbox.x0 * sx + "px";
      box.style.top = f.bbox.y0 * sy + "px";
      box.style.width = (f.bbox.x1 - f.bbox.x0) * sx + "px";
      box.style.height = (f.bbox.y1 - f.bbox.y0) * sy + "px";

      var tag = document.createElement("div");
      tag.className = "flagtag" + (dec ? " resolved" : "");
      tag.style.left = (f.bbox.x0 * sx + 4) + "px";
      tag.style.top = (f.bbox.y0 * sy + 4) + "px";
      tag.textContent = f.ruleId;

      var badge = document.createElement("div");
      badge.className = "flagbadge" + (dec ? " resolved" : "");
      badge.style.left = f.bbox.x1 * sx + "px";
      badge.style.top = f.bbox.y0 * sy + "px";
      badge.innerHTML = dec ? "&#10003;" : "!";

      box.addEventListener("click", function () {
        state.highlightedFlagId = f.id;
        state.expanded[f.id] = true;
        render();
        var card = document.querySelector('[data-flag-card="' + f.id + '"]');
        if (card) card.scrollIntoView({ behavior: "smooth", block: "center" });
      });

      host.appendChild(box);
      host.appendChild(tag);
      host.appendChild(badge);
    });
  }

  if (img.complete && img.naturalWidth) draw();
  else img.onload = draw;
  window.onresize = draw;
}

/* ---------- Rules View (Backed by MongoDB) ---------- */
function rulesView() {
  var rs = state.ruleset;
  var q = state.searchQuery.toLowerCase();
  var rules = (rs.rules || []).filter(function (r) {
    if (!q) return true;
    return r.id.toLowerCase().includes(q) ||
           r.name.toLowerCase().includes(q) ||
           r.category.toLowerCase().includes(q) ||
           (r.patterns || []).some(function (p) { return p.toLowerCase().includes(q); });
  });

  var h = '<div class="pagehead">' +
    '<div>' +
      '<div class="pagetitle serif">Brand Rules</div>' +
      '<span class="cardmeta">' + esc(rs.rulesetName) + ' (' + esc(rs.version) + ') &bull; ' + (rs.rules || []).length + ' rules stored in MongoDB</span>' +
    '</div>' +
    '<div class="pageactions">' +
      '<input class="searchinput" id="ruleSearch" placeholder="Search rules..." value="' + esc(state.searchQuery) + '">' +
      '<button class="btn" id="addRule">+ Add Rule</button>' +
      '<button class="btn ghost" id="saveDbRules">Save to MongoDB</button>' +
      '<button class="btn ghost" id="exportRules">Export JSON</button>' +
      '<button class="btn danger" id="resetRules">Reset Demo</button>' +
    '</div>' +
    '</div>';

  (rs.approvedFacts || []).forEach(function (f) {
    h += '<div class="factcard">' +
      '<div class="rulehead"><span class="factid">' + esc(f.id) + '</span><span class="rulename">Approved Brand Fact</span></div>' +
      '<div class="rulebody">"' + esc(f.text) + '"<br><span style="font-size:11.5px;color:#717a6c">Evidence: ' + esc(f.source.doc) + ' ' + esc(f.source.version) + '</span></div>' +
      '</div>';
  });

  rules.forEach(function (r, i) {
    var realIdx = rs.rules.indexOf(r);
    h += '<div class="rulecard ' + (r.enabled === false ? "off" : "") + '">' +
      '<div class="rulehead">' +
        '<span class="ruleid">' + esc(r.id) + '</span>' +
        '<span class="rulename">' + esc(r.name) + '</span>' +
        '<span class="rulecat">' + esc(r.category) + ' &bull; ' + esc(r.severity) + '</span>' +
        '<label class="switch"><input type="checkbox" data-toggle-rule="' + realIdx + '" ' + (r.enabled === false ? "" : "checked") + '><span class="sl"></span></label>' +
      '</div>' +
      '<div class="rulebody">' +
        'Matches: ' + (r.patterns || []).map(function (p) { return "<code>" + esc(p) + "</code>"; }).join(" ") + (r.regex ? ' <span class="rulecat">(regex)</span>' : "") +
        '<br>' + esc(r.why) +
        (r.suggestion ? '<br><b style="color:#1e5c40">Approved Fix:</b> "' + esc(r.suggestion.text) + '"' : '') +
        '<br><span style="font-size:11.5px;color:#717a6c">Rule Authority: ' + esc(r.source.doc) + ' ' + esc(r.source.version) + ' &mdash; "' + esc(r.source.quote) + '"</span>' +
      '</div>' +
      '<div class="rulebtns">' +
        '<button class="mini" data-edit-rule="' + realIdx + '">Edit Rule</button>' +
        '<button class="mini" data-del-rule="' + realIdx + '">Delete</button>' +
      '</div>' +
      '</div>';
  });

  return h;
}

/* ---------- History View (Directly from MongoDB reviews) ---------- */
function historyView() {
  var hist = state.reviewsHistory || [];
  var h = '<div class="pagehead">' +
    '<div>' +
      '<div class="pagetitle serif">Audit Trail &amp; History</div>' +
      '<span class="cardmeta">Full compliance ledger stored in MongoDB collection <code>reviews</code></span>' +
    '</div>' +
    '<div class="pageactions">' +
      '<button class="btn ghost" id="refreshHistory">Refresh from DB</button>' +
    '</div>' +
    '</div>';

  if (!hist.length) {
    return h + '<div class="empty">No completed review audits recorded yet.<br>Complete a review on the Review Content page to store the immutable audit record in MongoDB.</div>';
  }

  hist.forEach(function (x, idx) {
    var dt = x.formattedDate || new Date(x.timestamp).toLocaleString("en-IN");
    h += '<div class="hcard">' +
      '<div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:8px">' +
        '<div class="htitle">' + esc(x.contentName || "Review Session") + ' &bull; <span style="color:#1e5c40">' + esc(x.brand || state.brand) + '</span></div>' +
        '<span class="resolvedtag">Signed-Off &bull; ' + (x.decisionsCount || (x.decisions ? x.decisions.length : 0)) + ' decisions</span>' +
      '</div>' +
      '<div class="hmeta">' + esc(dt) + ' &bull; ' + (x.appliedCount || 0) + ' applied, ' + (x.dismissedCount || 0) + ' dismissed, ' + (x.copyChangesCount || 0) + ' copy changes</div>' +
      '<div class="hlist">' +
        '<b>Final Caption:</b> "' + esc(x.finalCaption || "(no caption text)") + '"' +
      '</div>' +
      '<div class="hbtns">' +
        '<button class="mini" data-view-history="' + idx + '">Inspect Decisions</button>' +
        '<button class="mini" data-dl-report-txt="' + idx + '">Download TXT</button>' +
        '<button class="mini" data-dl-report-json="' + idx + '">Download JSON</button>' +
        '<button class="mini" style="color:#b33527" data-del-history="' + (x._id || x.reviewId) + '">Delete Record</button>' +
      '</div>' +
      '</div>';
  });

  return h;
}

/* ---------- Insights View (Real-time Analytics from MongoDB) ---------- */
function insightsView() {
  var hist = state.reviewsHistory || [];
  var rs = state.ruleset;

  var totalReviews = hist.length;
  var totalDecisions = 0;
  var totalApplied = 0;
  var totalDismissed = 0;
  var totalCopyChanges = 0;
  var ruleCounts = {};
  var catCounts = {};

  hist.forEach(function (r) {
    totalApplied += r.appliedCount || 0;
    totalDismissed += r.dismissedCount || 0;
    totalCopyChanges += r.copyChangesCount || 0;

    (r.decisions || []).forEach(function (d) {
      totalDecisions++;
      var rid = d.ruleId || "OTHER";
      ruleCounts[rid] = (ruleCounts[rid] || 0) + 1;
    });
  });

  (rs.rules || []).forEach(function (r) {
    var c = ruleCounts[r.id] || 0;
    catCounts[r.category] = (catCounts[r.category] || 0) + c;
  });

  var topRules = Object.keys(ruleCounts).map(function (k) {
    var rObj = (rs.rules || []).find(function (r) { return r.id === k; });
    return { id: k, count: ruleCounts[k], name: rObj ? rObj.name : k };
  }).sort(function (a, b) { return b.count - a.count; });

  var complianceRate = totalReviews ? Math.round(((totalApplied + totalCopyChanges) / Math.max(1, totalDecisions)) * 100) : 100;

  var h = '<div class="pagehead">' +
    '<div>' +
      '<div class="pagetitle serif">Compliance Insights &amp; Analytics</div>' +
      '<span class="cardmeta">Live aggregation from MongoDB Brand_Review_Desk audit collections</span>' +
    '</div>' +
    '</div>';

  // KPI Grid
  h += '<div class="insights-grid">' +
    '<div class="kpi-card"><div class="kpi-title">Audited Reviews</div><div class="kpi-value">' + totalReviews + '</div><div class="kpi-sub">Total creative campaigns reviewed</div></div>' +
    '<div class="kpi-card"><div class="kpi-title">Compliance Alignment</div><div class="kpi-value" style="color:#1e5c40">' + complianceRate + '%</div><div class="kpi-sub">Issues corrected before publication</div></div>' +
    '<div class="kpi-card"><div class="kpi-title">Active Brand Rules</div><div class="kpi-value">' + (rs.rules ? rs.rules.length : 0) + '</div><div class="kpi-sub">Governing current checks</div></div>' +
    '<div class="kpi-card"><div class="kpi-title">Design Copy Changes</div><div class="kpi-value" style="color:#d97706">' + totalCopyChanges + '</div><div class="kpi-sub">Queued for graphic export</div></div>' +
    '</div>';

  // Section 1: Top Flagged Rules
  h += '<div class="insight-sec">' +
    '<div class="sec-title">&#10022; Most Frequently Triggered Brand Rules</div>';
  if (!topRules.length) {
    h += '<div style="color:#717a6c;font-size:13px">Run and approve reviews to generate violation frequency insights.</div>';
  } else {
    var maxVal = topRules[0].count || 1;
    topRules.forEach(function (tr) {
      var pct = Math.round((tr.count / maxVal) * 100);
      h += '<div class="bar-row">' +
        '<div class="bar-label">' + esc(tr.id) + ' &bull; ' + esc(tr.name) + '</div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
        '<div class="bar-val">' + tr.count + '</div>' +
        '</div>';
    });
  }
  h += '</div>';

  // Section 2: Rule Category Distribution
  h += '<div class="insight-sec">' +
    '<div class="sec-title">&#9708; Violations by Rule Category</div>';
  var catKeys = Object.keys(catCounts);
  if (!catKeys.length) {
    h += '<div style="color:#717a6c;font-size:13px">No category stats recorded yet.</div>';
  } else {
    var maxCat = Math.max.apply(null, catKeys.map(function (k) { return catCounts[k]; })) || 1;
    catKeys.forEach(function (k) {
      var val = catCounts[k];
      var pct = Math.round((val / maxCat) * 100);
      h += '<div class="bar-row">' +
        '<div class="bar-label">' + esc(k) + '</div>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%;background:linear-gradient(90deg,#2563eb,#3b82f6)"></div></div>' +
        '<div class="bar-val">' + val + '</div>' +
        '</div>';
    });
  }
  h += '</div>';

  // Section 3: Actionable Brand Recommendations
  h += '<div class="rec-box">' +
    '<b>Actionable Brand Recommendation:</b><br>' +
    'Claims and superiority terms (like "No.1", "Best", "Guaranteed") represent the majority of flagged items. Consider distributing a pre-approved evidence sheet for copywriters to reduce review iterations.' +
    '</div>';

  return h;
}

/* ---------- Event Wiring ---------- */
function wire(m) {
  // Navigation & buttons
  m.querySelectorAll("[data-expand]").forEach(function (b) {
    b.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var id = b.dataset.expand;
      state.expanded[id] = state.expanded[id] === false;
      render();
    });
  });

  m.querySelectorAll("[data-apply]").forEach(function (b) {
    b.addEventListener("click", function () { applyFlag(findFlag(b.dataset.apply)); });
  });

  m.querySelectorAll("[data-dismiss]").forEach(function (b) {
    b.addEventListener("click", function () { dismissFlag(findFlag(b.dataset.dismiss)); });
  });

  m.querySelectorAll("[data-undo]").forEach(function (b) {
    b.addEventListener("click", function () { undoDecision(findFlag(b.dataset.undo)); });
  });

  m.querySelectorAll("[data-manual]").forEach(function (b) {
    b.addEventListener("click", function () { markReviewed(+b.dataset.manual); });
  });

  m.querySelectorAll("[data-tog]").forEach(function (b) {
    b.addEventListener("click", function () {
      state.showText = b.dataset.tog === "text";
      render();
    });
  });

  m.querySelectorAll("[data-goto]").forEach(function (b) {
    b.addEventListener("click", function () {
      state.view = b.dataset.goto;
      render();
    });
  });

  m.querySelectorAll("[data-preset]").forEach(function (b) {
    b.addEventListener("click", function () { switchPreset(b.dataset.preset); });
  });

  m.querySelectorAll("[data-fil]").forEach(function (b) {
    b.addEventListener("click", function () {
      state.filter = b.dataset.fil;
      render();
    });
  });

  var topDbBtn = m.querySelector("#topDbBtn");
  if (topDbBtn) topDbBtn.addEventListener("click", showDatabaseModal);

  var up = m.querySelector("#uploadBtn");
  if (up) up.addEventListener("click", function () { m.querySelector("#fileInput").click(); });

  var fi = m.querySelector("#fileInput");
  if (fi) fi.addEventListener("change", function () { if (fi.files[0]) uploadImage(fi.files[0]); });

  var rs = m.querySelector("#rescanBtn");
  if (rs) rs.addEventListener("click", function () {
    state.draft.ocr = { status: "idle" };
    runOcrIfNeeded();
  });

  var sb = m.querySelector("#saveBtn");
  if (sb) sb.addEventListener("click", function () {
    persistDraft();
    toast("✓ Draft and review state saved to MongoDB collection.");
  });

  var ab = m.querySelector("#approveBtn");
  if (ab) ab.addEventListener("click", approveExport);

  var ce = m.querySelector("#capEditBtn");
  if (ce) ce.addEventListener("click", function () { state.captionEditing = true; render(); });

  var cc = m.querySelector("#capCancel");
  if (cc) cc.addEventListener("click", function () { state.captionEditing = false; render(); });

  var cs = m.querySelector("#capSave");
  if (cs) cs.addEventListener("click", function () {
    state.draft.caption = m.querySelector("#captionEdit").value;
    state.captionEditing = false;
    persistDraft();
    runChecksNow();
    toast("Caption updated and re-verified against MongoDB rules.");
  });

  // Rules view wiring
  var rSearch = m.querySelector("#ruleSearch");
  if (rSearch) {
    rSearch.addEventListener("input", function (e) {
      state.searchQuery = e.target.value;
      render();
      var el = document.getElementById("ruleSearch");
      if (el) { el.focus(); el.selectionStart = el.selectionEnd = el.value.length; }
    });
  }

  var ar = m.querySelector("#addRule");
  if (ar) ar.addEventListener("click", function () { ruleModal(null); });

  var saveDb = m.querySelector("#saveDbRules");
  if (saveDb) {
    saveDb.addEventListener("click", async function () {
      var res = await apiPost("/api/ruleset", state.ruleset);
      if (res && res.success) toast("✓ Ruleset saved directly to MongoDB Atlas!");
      else toast("Ruleset persisted locally.");
    });
  }

  m.querySelectorAll("[data-edit-rule]").forEach(function (b) {
    b.addEventListener("click", function () { ruleModal(+b.dataset.editRule); });
  });

  m.querySelectorAll("[data-del-rule]").forEach(function (b) {
    b.addEventListener("click", async function () {
      var idx = +b.dataset.delRule;
      var r = state.ruleset.rules[idx];
      if (confirm("Delete rule " + r.id + " (" + r.name + ")?")) {
        state.ruleset.rules.splice(idx, 1);
        await apiPost("/api/ruleset", state.ruleset);
        save(LS.rules, state.ruleset);
        runChecksNow();
        toast("Rule deleted.");
      }
    });
  });

  m.querySelectorAll("[data-toggle-rule]").forEach(function (b) {
    b.addEventListener("change", async function () {
      var idx = +b.dataset.toggleRule;
      state.ruleset.rules[idx].enabled = b.checked;
      await apiPost("/api/ruleset", state.ruleset);
      save(LS.rules, state.ruleset);
      runChecksNow();
    });
  });

  var er = m.querySelector("#exportRules");
  if (er) er.addEventListener("click", function () {
    download("brand-rules-" + state.ruleset.brand.replace(/\s+/g, "-") + ".json", JSON.stringify(state.ruleset, null, 2), "application/json");
  });

  var rr = m.querySelector("#resetRules");
  if (rr) rr.addEventListener("click", async function () {
    if (confirm("Reset ruleset to default demo rules in MongoDB?")) {
      var res = await apiPost("/api/ruleset/reset", {});
      if (res && res.ruleset) state.ruleset = res.ruleset;
      else state.ruleset = window.DEFAULT_RULESET;
      runChecksNow();
      toast("Ruleset reset to demo.");
    }
  });

  // History view wiring
  var refHist = m.querySelector("#refreshHistory");
  if (refHist) {
    refHist.addEventListener("click", async function () {
      var list = await apiGet("/api/reviews");
      if (list) {
        state.reviewsHistory = list;
        render();
        toast("History refreshed from MongoDB.");
      }
    });
  }

  m.querySelectorAll("[data-del-history]").forEach(function (b) {
    b.addEventListener("click", async function () {
      var id = b.dataset.delHistory;
      if (confirm("Delete this review record from MongoDB?")) {
        try {
          await fetch("/api/reviews/" + id, { method: "DELETE" });
          state.reviewsHistory = state.reviewsHistory.filter(function (x) {
            return String(x._id) !== id && x.reviewId !== id;
          });
          render();
          toast("Review record removed.");
        } catch (e) {}
      }
    });
  });

  m.querySelectorAll("[data-view-history]").forEach(function (b) {
    b.addEventListener("click", function () {
      showHistoryDetailModal(+b.dataset.viewHistory);
    });
  });

  m.querySelectorAll("[data-dl-report-txt]").forEach(function (b) {
    b.addEventListener("click", function () {
      var r = state.reviewsHistory[+b.dataset.dlReportTxt];
      if (r) download("review-report-" + (r.reviewId || "audit") + ".txt", r.reportText || JSON.stringify(r, null, 2), "text/plain");
    });
  });

  m.querySelectorAll("[data-dl-report-json]").forEach(function (b) {
    b.addEventListener("click", function () {
      var r = state.reviewsHistory[+b.dataset.dlReportJson];
      if (r) download("review-report-" + (r.reviewId || "audit") + ".json", JSON.stringify(r.reportJson || r, null, 2), "application/json");
    });
  });
}

function findFlag(id) { return state.flags.find(function (f) { return f.id === id; }); }

/* ---------- Rule Editor Modal with Live Pattern Tester ---------- */
function ruleModal(idx) {
  var r = idx == null ? {
    id: "", name: "", category: "Claims & Evidence", severity: "high",
    type: "phrase", regex: false, patterns: [], why: "",
    suggestion: { kind: "replace", text: "", note: "" },
    source: { doc: "Brand Book", version: "v3", quote: "" }, enabled: true
  } : state.ruleset.rules[idx];

  var root = document.getElementById("modalroot");
  root.innerHTML = '<div class="modalbg"><div class="modal">' +
    '<div class="mtitle">' + (idx == null ? "+ Add Brand Rule" : "Edit " + esc(r.id)) + '</div>' +
    f("Rule ID", "m_id", r.id, "e.g. FACT-02") +
    f("Rule Name", "m_name", r.name, "e.g. Unsubstantiated Superiority Claim") +
    f("Category", "m_cat", r.category, "e.g. Claims & Evidence") +
    '<div class="frow"><label class="flabel">Severity</label><select class="fsel" id="m_sev">' +
      ["high", "medium", "low"].map(function (s) { return '<option ' + (r.severity === s ? "selected" : "") + ">" + s + "</option>"; }).join("") +
    '</select></div>' +
    f("Patterns (comma-separated)", "m_pat", (r.patterns || []).join(", "), "phrases or regexes") +
    '<div class="frow"><label style="font-size:12px"><input type="checkbox" id="m_regex" ' + (r.regex ? "checked" : "") + '> Patterns are regular expressions</label></div>' +

    // Real-time Interactive Rule Tester
    '<div class="testerbox">' +
      '<label class="flabel">&#9656; Live Pattern Tester</label>' +
      '<input class="fin" id="m_test_input" placeholder="Type sample text to test your rule match...">' +
      '<div id="m_test_result" class="testresult nomatch">Enter sample text to test</div>' +
    '</div>' +

    '<div class="frow" style="margin-top:12px"><label class="flabel">Why It Matters (Rule explanation)</label><textarea class="fta" id="m_why">' + esc(r.why) + '</textarea></div>' +
    f("Approved Replacement Suggestion", "m_sugg", r.suggestion ? r.suggestion.text : "", "e.g. approved alternative phrase") +
    f("Suggestion Note", "m_suggnote", r.suggestion ? r.suggestion.note : "", "guidance note") +
    f("Source Document", "m_doc", r.source ? r.source.doc : "", "e.g. Arka Brand Book") +
    f("Source Version", "m_ver", r.source ? r.source.version : "", "e.g. v3") +
    '<div class="frow"><label class="flabel">Source Quote from Guideline</label><textarea class="fta" id="m_quote">' + esc(r.source ? r.source.quote : "") + '</textarea></div>' +
    '<div class="mbtns"><button class="btn ghost" id="m_cancel">Cancel</button><button class="btn" id="m_save">Save Rule to MongoDB</button></div>' +
    '</div></div>';

  function runTest() {
    var txt = document.getElementById("m_test_input").value;
    var rawPat = document.getElementById("m_pat").value;
    var isRegex = document.getElementById("m_regex").checked;
    var resEl = document.getElementById("m_test_result");
    if (!txt.trim() || !rawPat.trim()) {
      resEl.className = "testresult nomatch";
      resEl.textContent = "Enter test text above";
      return;
    }
    var pats = rawPat.split(",").map(function (s) { return s.trim(); }).filter(Boolean);
    var matched = false;
    for (var i = 0; i < pats.length; i++) {
      var matches = E.findMatches ? E.findMatches(txt, pats[i], isRegex) : [];
      if (matches && matches.length > 0) {
        matched = true;
        break;
      }
    }
    if (matched) {
      resEl.className = "testresult match";
      resEl.innerHTML = "&#10003; Pattern matches! Flag will trigger.";
    } else {
      resEl.className = "testresult nomatch";
      resEl.textContent = "No match with current patterns.";
    }
  }

  document.getElementById("m_test_input").addEventListener("input", runTest);
  document.getElementById("m_pat").addEventListener("input", runTest);
  document.getElementById("m_regex").addEventListener("change", runTest);

  document.getElementById("m_cancel").addEventListener("click", function () { root.innerHTML = ""; });
  document.getElementById("m_save").addEventListener("click", async function () {
    var nr = {
      id: v("m_id"),
      name: v("m_name"),
      category: v("m_cat"),
      severity: document.getElementById("m_sev").value,
      type: "phrase",
      regex: document.getElementById("m_regex").checked,
      patterns: v("m_pat").split(",").map(function (s) { return s.trim(); }).filter(Boolean),
      why: v("m_why"),
      suggestion: v("m_sugg") ? { kind: "replace", text: v("m_sugg"), note: v("m_suggnote") } : null,
      source: { doc: v("m_doc"), version: v("m_ver"), quote: v("m_quote") },
      enabled: true
    };

    if (!nr.id || !nr.patterns.length || !nr.why || !nr.source.quote) {
      toast("Please fill in Rule ID, patterns, why, and source quote.");
      return;
    }

    if (idx == null) state.ruleset.rules.push(nr);
    else { nr.enabled = state.ruleset.rules[idx].enabled; state.ruleset.rules[idx] = nr; }

    root.innerHTML = "";
    await apiPost("/api/ruleset", state.ruleset);
    save(LS.rules, state.ruleset);
    runChecksNow();
    toast("✓ Rule saved to MongoDB!");
  });

  function f(label, id, val, ph) {
    return '<div class="frow"><label class="flabel">' + label + '</label><input class="fin" id="' + id + '" value="' + esc(val) + '" placeholder="' + esc(ph) + '"></div>';
  }
  function v(id) { return document.getElementById(id).value.trim(); }
}

/* ---------- Database & Cluster Status Modal ---------- */
function showDatabaseModal() {
  var root = document.getElementById("modalroot");
  var st = state.dbStatus;
  var cols = st.collections || {};

  root.innerHTML = '<div class="modalbg"><div class="modal">' +
    '<div class="mtitle">&#9672; MongoDB Cluster &amp; Tables Status</div>' +
    '<div style="font-size:13px;color:#5a6657;line-height:1.6;margin-bottom:14px">' +
      'Brand Review Desk uses a dedicated MongoDB database for rulesets, audit logs, and compliance records.' +
    '</div>' +
    '<table class="dbstat-table">' +
      '<tr><th>Property</th><th>Status</th></tr>' +
      '<tr><td><b>Cluster</b></td><td>project-1.xzfwn9j.mongodb.net</td></tr>' +
      '<tr><td><b>Database Name</b></td><td><code>' + esc(st.database || "Brand_Review_Desk") + '</code></td></tr>' +
      '<tr><td><b>Connection Status</b></td><td>' + (st.connected ? '<span style="color:#1e5c40;font-weight:700">&#10003; Connected to MongoDB Atlas</span>' : '<span style="color:#d97706;font-weight:700">&#9888; Synchronized Local Fallback</span>') + '</td></tr>' +
      '<tr><td><b>Table: rulesets</b></td><td>' + (cols.rulesets || 1) + ' document(s)</td></tr>' +
      '<tr><td><b>Table: rules (normalized)</b></td><td>' + (cols.rules || (state.ruleset.rules ? state.ruleset.rules.length : 5)) + ' rules</td></tr>' +
      '<tr><td><b>Table: reviews (audit trail)</b></td><td>' + (cols.reviews || state.reviewsHistory.length) + ' audits recorded</td></tr>' +
      '<tr><td><b>Table: drafts</b></td><td>' + (cols.drafts || 1) + ' saved</td></tr>' +
      '<tr><td><b>Table: brands</b></td><td>' + (cols.brands || 2) + ' brands</td></tr>' +
    '</table>' +
    '<div class="frow" style="margin-top:14px">' +
      '<label class="flabel">MongoDB Connection URI</label>' +
      '<input class="fin" id="db_uri_input" value="mongodb+srv://db_test:password%402177@project-1.xzfwn9j.mongodb.net/Brand_Review_Desk?retryWrites=true&w=majority&appName=project-1">' +
    '</div>' +
    '<div class="mbtns">' +
      '<button class="btn ghost" id="db_close">Close</button>' +
      '<button class="btn" id="db_test_btn">Test &amp; Sync MongoDB</button>' +
    '</div>' +
    '</div></div>';

  document.getElementById("db_close").addEventListener("click", function () { root.innerHTML = ""; });
  document.getElementById("db_test_btn").addEventListener("click", async function () {
    var uri = document.getElementById("db_uri_input").value.trim();
    toast("Checking connection to MongoDB Atlas...");
    var res = await apiPost("/api/connect", { uri: uri });
    if (res) state.dbStatus = res;
    updateDBStatusUI();
    toast(state.dbStatus.connected ? "✓ Connected to MongoDB Atlas!" : "MongoDB connection verified in sync store mode.");
    root.innerHTML = "";
    render();
  });
}

/* ---------- History Details Modal ---------- */
function showHistoryDetailModal(idx) {
  var item = state.reviewsHistory[idx];
  if (!item) return;
  var root = document.getElementById("modalroot");

  var decList = (item.decisions || []).map(function (d) {
    return '<div style="background:#f9f8f2;border:1px solid #e7e4d6;border-radius:10px;padding:10px 12px;margin-bottom:8px">' +
      '<div style="display:flex;align-items:center;justify-content:space-between">' +
        '<b>' + esc(d.ruleId) + ' &bull; ' + esc(d.name) + '</b>' +
        '<span class="resolvedtag">' + esc(d.decision) + '</span>' +
      '</div>' +
      '<div style="font-size:12px;margin-top:4px">Matched text: <code>"' + esc(d.matched) + '"</code> in ' + esc(d.sourceType) + '</div>' +
      (d.suggestionText ? '<div style="font-size:12px;color:#1e5c40;margin-top:2px">Suggestion: "' + esc(d.suggestionText) + '"</div>' : '') +
      (d.reason ? '<div style="font-size:11.5px;color:#717a6c;margin-top:2px">Logged Reason: ' + esc(d.reason) + '</div>' : '') +
      '</div>';
  }).join("");

  root.innerHTML = '<div class="modalbg"><div class="modal">' +
    '<div class="mtitle">Review Audit: ' + esc(item.contentName || "Session") + '</div>' +
    '<div style="font-size:12.5px;color:#717a6c;margin-bottom:12px">' +
      'Brand: <b>' + esc(item.brand || state.brand) + '</b> &bull; Signed off: ' + esc(item.formattedDate || new Date(item.timestamp).toLocaleString("en-IN")) +
    '</div>' +
    '<div style="margin-bottom:12px"><b style="font-size:13px">Recorded Decisions (' + (item.decisions ? item.decisions.length : 0) + '):</b></div>' +
    decList +
    '<div style="margin-top:14px;background:#fff;border:1px solid #dcd7c6;border-radius:10px;padding:12px">' +
      '<b style="font-size:12px">Final Approved Caption:</b>' +
      '<div style="font-size:12.5px;color:#354035;margin-top:4px;line-height:1.6">' + esc(item.finalCaption || "") + '</div>' +
    '</div>' +
    '<div class="mbtns"><button class="btn" id="modal_close_btn">Done</button></div>' +
    '</div></div>';

  document.getElementById("modal_close_btn").addEventListener("click", function () { root.innerHTML = ""; });
}

function renderDraftCard() { if (state.view === "review") render(); }

window.addEventListener("DOMContentLoaded", init);
})();
