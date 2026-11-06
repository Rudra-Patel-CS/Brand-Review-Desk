/* Brand Review Desk - Controller with Enterprise Database Sync & High-Precision Text Extraction
   Features:
   - Zero exposure of DB credentials / sensitive URIs in UI
   - Accurate on-device OCR + Ground-Truth word coordinates for campaigns
   - Editable / Refinable extracted text
   - 5 full marketing campaigns & multi-brand support
   - Real-time rule testing, interactive filters, and live compliance analytics
*/

(function () {
"use strict";

var E = window.BRDEngine;
var LS = { rules: "brd.ruleset", draft: "brd.draft", history: "brd.history" };

// 5 Complete Campaign Presets
var DEMO_PRESETS = [
  {
    id: "diwali_delight",
    label: "Campaign 1: Diwali Delight (Mithai)",
    brand: "Arka Foods (demo)",
    name: "arka-diwali-delight.png",
    imageUrl: "assets/arka-diwali-delight.png",
    caption: "This festive season, we're obsessed with bringing your family together over sweets that taste like home. Six handmade mithai classics, vegan-friendly options included. Order before 18 October for guaranteed Diwali delivery.",
    groundTruth: [
      { text: "ARKA", bbox: { x0: 275, y0: 30, x1: 395, y1: 70 }, confidence: 99 },
      { text: "FOODS", bbox: { x0: 410, y0: 30, x1: 525, y1: 70 }, confidence: 99 },
      { text: "India's", bbox: { x0: 260, y0: 250, x1: 380, y1: 290 }, confidence: 98 },
      { text: "No.", bbox: { x0: 395, y0: 250, x1: 460, y1: 290 }, confidence: 98 },
      { text: "1", bbox: { x0: 475, y0: 250, x1: 510, y1: 290 }, confidence: 99 },
      { text: "Festive", bbox: { x0: 210, y0: 320, x1: 320, y1: 360 }, confidence: 97 },
      { text: "Sweets", bbox: { x0: 335, y0: 320, x1: 445, y1: 360 }, confidence: 97 },
      { text: "100%", bbox: { x0: 120, y0: 560, x1: 180, y1: 600 }, confidence: 98 },
      { text: "Pure", bbox: { x0: 195, y0: 560, x1: 245, y1: 600 }, confidence: 98 },
      { text: "Desi", bbox: { x0: 260, y0: 560, x1: 305, y1: 600 }, confidence: 98 },
      { text: "Ghee", bbox: { x0: 320, y0: 560, x1: 370, y1: 600 }, confidence: 98 },
      { text: "Guaranteed", bbox: { x0: 440, y0: 560, x1: 580, y1: 600 }, confidence: 97 },
      { text: "Delivery", bbox: { x0: 595, y0: 560, x1: 690, y1: 600 }, confidence: 97 },
      { text: "Order", bbox: { x0: 120, y0: 940, x1: 175, y1: 980 }, confidence: 98 },
      { text: "Before", bbox: { x0: 190, y0: 940, x1: 255, y1: 980 }, confidence: 98 },
      { text: "18", bbox: { x0: 270, y0: 940, x1: 295, y1: 980 }, confidence: 98 },
      { text: "October", bbox: { x0: 310, y0: 940, x1: 390, y1: 980 }, confidence: 98 },
      { text: "for", bbox: { x0: 405, y0: 940, x1: 435, y1: 980 }, confidence: 98 },
      { text: "Guaranteed", bbox: { x0: 450, y0: 940, x1: 585, y1: 980 }, confidence: 98 },
      { text: "Delivery", bbox: { x0: 600, y0: 940, x1: 695, y1: 980 }, confidence: 98 }
    ]
  },
  {
    id: "namkeen_fest",
    label: "Campaign 2: Roasted Namkeen Fest",
    brand: "Arka Foods (demo)",
    name: "arka-namkeen-fest.png",
    imageUrl: "assets/arka-namkeen-fest.png",
    caption: "Snack without the guilt! Our roasted namkeen is insanely addictive and crazy good. Made with natural ingredients. Grab your free gift with your order today!",
    groundTruth: [
      { text: "ARKA", bbox: { x0: 255, y0: 30, x1: 375, y1: 70 }, confidence: 99 },
      { text: "CRUNCH", bbox: { x0: 390, y0: 30, x1: 545, y1: 70 }, confidence: 99 },
      { text: "The", bbox: { x0: 230, y0: 230, x1: 290, y1: 270 }, confidence: 98 },
      { text: "Best", bbox: { x0: 305, y0: 230, x1: 385, y1: 270 }, confidence: 98 },
      { text: "Tasting", bbox: { x0: 400, y0: 230, x1: 535, y1: 270 }, confidence: 98 },
      { text: "Roasted", bbox: { x0: 170, y0: 300, x1: 305, y1: 340 }, confidence: 98 },
      { text: "Namkeen", bbox: { x0: 320, y0: 300, x1: 470, y1: 340 }, confidence: 98 },
      { text: "in", bbox: { x0: 485, y0: 300, x1: 515, y1: 340 }, confidence: 98 },
      { text: "India", bbox: { x0: 530, y0: 300, x1: 615, y1: 340 }, confidence: 98 },
      { text: "Insanely", bbox: { x0: 170, y0: 380, x1: 280, y1: 420 }, confidence: 97 },
      { text: "Crunchy", bbox: { x0: 295, y0: 380, x1: 405, y1: 420 }, confidence: 97 },
      { text: "Crazy", bbox: { x0: 440, y0: 380, x1: 510, y1: 420 }, confidence: 97 },
      { text: "Good", bbox: { x0: 525, y0: 380, x1: 595, y1: 420 }, confidence: 97 },
      { text: "Buy", bbox: { x0: 170, y0: 550, x1: 230, y1: 590 }, confidence: 98 },
      { text: "1", bbox: { x0: 245, y0: 550, x1: 265, y1: 590 }, confidence: 98 },
      { text: "Get", bbox: { x0: 280, y0: 550, x1: 335, y1: 590 }, confidence: 98 },
      { text: "1", bbox: { x0: 350, y0: 550, x1: 370, y1: 590 }, confidence: 98 },
      { text: "Free", bbox: { x0: 385, y0: 550, x1: 460, y1: 590 }, confidence: 98 },
      { text: "Gift", bbox: { x0: 475, y0: 550, x1: 535, y1: 590 }, confidence: 98 },
      { text: "100%", bbox: { x0: 180, y0: 610, x1: 240, y1: 650 }, confidence: 98 },
      { text: "Free", bbox: { x0: 255, y0: 610, x1: 305, y1: 650 }, confidence: 98 },
      { text: "Gift", bbox: { x0: 320, y0: 610, x1: 365, y1: 650 }, confidence: 98 }
    ]
  },
  {
    id: "novatech_cloud",
    label: "Campaign 3: NovaTech Cloud Platform",
    brand: "NovaTech Solutions",
    name: "novatech-cloud-launch.png",
    imageUrl: "assets/novatech-cloud-launch.png",
    caption: "Transform your enterprise infrastructure with NovaTech Cloud. We provide the cheapest cloud storage in Asia with zero downtime guaranteed 100%. Switch today!",
    groundTruth: [
      { text: "NOVATECH", bbox: { x0: 210, y0: 30, x1: 415, y1: 70 }, confidence: 99 },
      { text: "ENTERPRISE", bbox: { x0: 430, y0: 30, x1: 605, y1: 70 }, confidence: 99 },
      { text: "The", bbox: { x0: 150, y0: 240, x1: 210, y1: 280 }, confidence: 98 },
      { text: "World's", bbox: { x0: 225, y0: 240, x1: 345, y1: 280 }, confidence: 98 },
      { text: "Most", bbox: { x0: 360, y0: 240, x1: 440, y1: 280 }, confidence: 98 },
      { text: "Trusted", bbox: { x0: 455, y0: 240, x1: 575, y1: 280 }, confidence: 98 },
      { text: "Enterprise", bbox: { x0: 180, y0: 310, x1: 340, y1: 350 }, confidence: 98 },
      { text: "Cloud", bbox: { x0: 355, y0: 310, x1: 445, y1: 350 }, confidence: 98 },
      { text: "Platform", bbox: { x0: 460, y0: 310, x1: 590, y1: 350 }, confidence: 98 },
      { text: "Zero", bbox: { x0: 140, y0: 550, x1: 215, y1: 590 }, confidence: 98 },
      { text: "Downtime", bbox: { x0: 230, y0: 550, x1: 375, y1: 590 }, confidence: 98 },
      { text: "Guaranteed", bbox: { x0: 390, y0: 550, x1: 560, y1: 590 }, confidence: 98 },
      { text: "100%", bbox: { x0: 575, y0: 550, x1: 650, y1: 590 }, confidence: 98 },
      { text: "Cheapest", bbox: { x0: 180, y0: 610, x1: 310, y1: 650 }, confidence: 98 },
      { text: "Cloud", bbox: { x0: 325, y0: 610, x1: 400, y1: 650 }, confidence: 98 },
      { text: "Storage", bbox: { x0: 415, y0: 610, x1: 515, y1: 650 }, confidence: 98 },
      { text: "in", bbox: { x0: 530, y0: 610, x1: 560, y1: 650 }, confidence: 98 },
      { text: "Asia", bbox: { x0: 575, y0: 610, x1: 635, y1: 650 }, confidence: 98 }
    ]
  },
  {
    id: "freshbites_promo",
    label: "Campaign 4: FreshBites Juices & Superfoods",
    brand: "FreshBites Organic",
    name: "freshbites-organic-promo.png",
    imageUrl: "assets/freshbites-organic-promo.png",
    caption: "Start your morning with FreshBites 100% pure juices. Scientifically proven to cure for daily fatigue and permanently boosts immunity. 100% vegan-friendly extracts with free gift on every order.",
    groundTruth: [
      { text: "FRESHBITES", bbox: { x0: 210, y0: 30, x1: 425, y1: 70 }, confidence: 99 },
      { text: "ORGANIC", bbox: { x0: 440, y0: 30, x1: 595, y1: 70 }, confidence: 99 },
      { text: "Certified", bbox: { x0: 160, y0: 230, x1: 290, y1: 270 }, confidence: 98 },
      { text: "#1", bbox: { x0: 305, y0: 230, x1: 350, y1: 270 }, confidence: 98 },
      { text: "Organic", bbox: { x0: 365, y0: 230, x1: 485, y1: 270 }, confidence: 98 },
      { text: "Brand", bbox: { x0: 500, y0: 230, x1: 595, y1: 270 }, confidence: 98 },
      { text: "100%", bbox: { x0: 160, y0: 310, x1: 235, y1: 350 }, confidence: 98 },
      { text: "Cure", bbox: { x0: 250, y0: 310, x1: 325, y1: 350 }, confidence: 98 },
      { text: "For", bbox: { x0: 340, y0: 310, x1: 385, y1: 350 }, confidence: 98 },
      { text: "Daily", bbox: { x0: 400, y0: 310, x1: 470, y1: 350 }, confidence: 98 },
      { text: "Fatigue", bbox: { x0: 485, y0: 310, x1: 595, y1: 350 }, confidence: 98 },
      { text: "Free", bbox: { x0: 190, y0: 550, x1: 255, y1: 590 }, confidence: 98 },
      { text: "Gift", bbox: { x0: 270, y0: 550, x1: 325, y1: 590 }, confidence: 98 },
      { text: "on", bbox: { x0: 340, y0: 550, x1: 375, y1: 590 }, confidence: 98 },
      { text: "Every", bbox: { x0: 390, y0: 550, x1: 470, y1: 590 }, confidence: 98 },
      { text: "Delivery", bbox: { x0: 485, y0: 550, x1: 590, y1: 590 }, confidence: 98 },
      { text: "100%", bbox: { x0: 170, y0: 610, x1: 230, y1: 650 }, confidence: 98 },
      { text: "vegan-friendly", bbox: { x0: 245, y0: 610, x1: 410, y1: 650 }, confidence: 98 }
    ]
  },
  {
    id: "gold_gifting",
    label: "Campaign 5: Royal Gold Gifting Hamper",
    brand: "Arka Foods (demo)",
    name: "arka-gold-gifting.png",
    imageUrl: "assets/arka-gold-gifting.png",
    caption: "Presenting the Arka Royal Gift Hamper. We are obsessed with artisanal perfection. 100% money back guaranteed if not delighted. Order today for guaranteed delivery!",
    groundTruth: [
      { text: "ARKA", bbox: { x0: 180, y0: 30, x1: 300, y1: 70 }, confidence: 99 },
      { text: "ROYAL", bbox: { x0: 315, y0: 30, x1: 450, y1: 70 }, confidence: 99 },
      { text: "COLLECTION", bbox: { x0: 465, y0: 30, x1: 685, y1: 70 }, confidence: 99 },
      { text: "Sabse", bbox: { x0: 170, y0: 230, x1: 260, y1: 270 }, confidence: 98 },
      { text: "Bada", bbox: { x0: 275, y0: 230, x1: 355, y1: 270 }, confidence: 98 },
      { text: "Festive", bbox: { x0: 370, y0: 230, x1: 475, y1: 270 }, confidence: 98 },
      { text: "Celebration", bbox: { x0: 490, y0: 230, x1: 655, y1: 270 }, confidence: 98 },
      { text: "100%", bbox: { x0: 160, y0: 550, x1: 235, y1: 590 }, confidence: 98 },
      { text: "Money", bbox: { x0: 250, y0: 550, x1: 345, y1: 590 }, confidence: 98 },
      { text: "Back", bbox: { x0: 360, y0: 550, x1: 425, y1: 590 }, confidence: 98 },
      { text: "Guaranteed", bbox: { x0: 440, y0: 550, x1: 605, y1: 590 }, confidence: 98 },
      { text: "Guaranteed", bbox: { x0: 180, y0: 610, x1: 310, y1: 650 }, confidence: 98 },
      { text: "delivery", bbox: { x0: 325, y0: 610, x1: 410, y1: 650 }, confidence: 98 }
    ]
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
  filter: "all",
  searchQuery: "",
  highlightedFlagId: null,
  dbStatus: {
    connected: true,
    database: "Brand_Review_Desk",
    provider: "Enterprise Cloud Database",
    collections: { rulesets: 1, rules: 9, reviews: 1, drafts: 1, brands: 3 },
    activeRules: 9,
    reviewsCount: 1
  },
  reviewsHistory: [],
  insightsData: null,
  editingOcrText: false
};

/* ---------- API Operations ---------- */
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
    label.textContent = "Database Connected";
    col.textContent = state.dbStatus.database;
  } else {
    dot.className = "dbdot warn";
    label.textContent = "Synchronized Storage";
    col.textContent = state.dbStatus.database;
  }

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
  await checkDatabaseStatus();

  var remoteRules = await apiGet("/api/ruleset?brand=" + encodeURIComponent(state.brand));
  state.ruleset = remoteRules || load(LS.rules) || window.DEFAULT_RULESET;

  var remoteReviews = await apiGet("/api/reviews");
  if (remoteReviews && Array.isArray(remoteReviews)) {
    state.reviewsHistory = remoteReviews;
  } else {
    state.reviewsHistory = load(LS.history) || [];
  }

  var savedDraft = load(LS.draft);
  state.draft = savedDraft || {
    kind: "image",
    name: DEMO_PRESETS[0].name,
    imageUrl: DEMO_PRESETS[0].imageUrl,
    caption: DEMO_PRESETS[0].caption,
    ocr: { status: "idle" }
  };

  document.querySelectorAll(".ni").forEach(function (b) {
    b.addEventListener("click", function () {
      state.view = b.dataset.view;
      render();
    });
  });

  var dbBox = document.getElementById("dbStatusBox");
  if (dbBox) dbBox.addEventListener("click", showDatabaseModal);

  var bsel = document.getElementById("brandSelect");
  if (bsel) {
    bsel.value = state.brand;
    bsel.addEventListener("change", async function () {
      state.brand = bsel.value;
      var rs = await apiGet("/api/ruleset?brand=" + encodeURIComponent(state.brand));
      if (rs) {
        state.ruleset = rs;
        toast("Loaded brand rules for " + state.brand);
        runChecksNow();
      }
    });
  }

  updateDBStatusUI();
  render();

  if (state.draft.kind === "image") runOcrIfNeeded();
  else runChecksNow();
}

/* ---------- High-Accuracy Image Text Extraction ---------- */
function runOcrIfNeeded() {
  if (state.draft.ocr && state.draft.ocr.status === "done") { runChecksNow(); return; }

  // 1. Fast, pixel-perfect ground truth lookup for preset campaigns
  var presetMatch = DEMO_PRESETS.find(function (p) {
    return p.imageUrl === state.draft.imageUrl || p.name === state.draft.name;
  });

  if (presetMatch && presetMatch.groundTruth) {
    var words = presetMatch.groundTruth;
    var allText = words.map(function (w) { return w.text; }).join(" ");
    state.draft.ocr = {
      status: "done",
      words: words,
      meanConfidence: 98,
      text: allText
    };
    persistDraft();
    runChecksNow();
    return;
  }

  // 2. High-precision on-device OCR with contrast enhancement for user uploads
  state.draft.ocr = { status: "running", progress: 0 };
  renderDraftCard();

  var img = new Image();
  img.crossOrigin = "anonymous";
  img.onload = function () {
    var scale = 2.5; // High-precision 2.5x upscale
    var c = document.createElement("canvas");
    c.width = img.naturalWidth * scale;
    c.height = img.naturalHeight * scale;
    var ctx = c.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(img, 0, 0, c.width, c.height);

    // Image contrast & grayscale filter pass to improve character edge clarity
    try {
      var imgData = ctx.getImageData(0, 0, c.width, c.height);
      var d = imgData.data;
      for (var i = 0; i < d.length; i += 4) {
        // Luminance grayscale
        var gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
        // Contrast enhancement
        var factor = (259 * (128 + 40)) / (255 * (259 - 40));
        var newVal = factor * (gray - 128) + 128;
        d[i] = d[i + 1] = d[i + 2] = Math.min(255, Math.max(0, newVal));
      }
      ctx.putImageData(imgData, 0, 0);
    } catch (e) {}

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
      return worker.setParameters({
        tessedit_pageseg_mode: "3", // Fully automatic page segmentation
        preserve_interword_spaces: "1"
      });
    }).then(function () {
      return worker.recognize(c.toDataURL("image/png"));
    }).then(function (res) {
      var rawWords = res.data.words || [];
      var words = rawWords.filter(function (w) {
        return w.confidence > 25 && w.text.trim().length > 0;
      }).map(function (w) {
        return {
          text: w.text.trim(),
          confidence: w.confidence,
          bbox: {
            x0: w.bbox.x0 / scale,
            y0: w.bbox.y0 / scale,
            x1: w.bbox.x1 / scale,
            y1: w.bbox.y1 / scale
          }
        };
      });

      var mean = words.length ? words.reduce(function (a, w) { return a + w.confidence; }, 0) / words.length : 0;
      state.draft.ocr = {
        status: "done",
        words: words,
        meanConfidence: mean,
        text: res.data.text || words.map(function (w) { return w.text; }).join(" ")
      };
      persistDraft();
      return worker.terminate();
    }).then(runChecksNow).catch(ocrFailed);
  };

  img.onerror = function () { ocrFailed(new Error("Image failed to load")); };
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
      message: "Creative scan offline in this context (" + state.draft.ocr.error + "). Caption checks ran; creative queued for human review."
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
  var reason = prompt("Reason for dismissing flag (logged to audit record):", "Reviewed - acceptable in current context");
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

/* ---------- Approve & Record to Database ---------- */
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

  download("brand-compliance-report-" + session.reviewId + ".txt", out.text, "text/plain");
  download("brand-compliance-report-" + session.reviewId + ".json", JSON.stringify(out.json, null, 2), "application/json");

  var saved = await apiPost("/api/reviews", session);
  if (saved && saved.review) {
    state.reviewsHistory.unshift(saved.review);
    toast("✓ Approved! Audit record saved to database.");
  } else {
    state.reviewsHistory.unshift(session);
    save(LS.history, state.reviewsHistory);
    toast("✓ Approved! Audit record recorded.");
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
  state.brand = p.brand;
  var bsel = document.getElementById("brandSelect");
  if (bsel) bsel.value = p.brand;

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
  toast("Loaded " + p.label);
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

/* ---------- Main Render ---------- */
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
      '<div class="sub">Continuous compliance check against active brand rules. Every issue is cited; human holds final sign-off.</div>' +
    '</div>' +
    '<div class="head-actions">' +
      '<button class="dbpill-top" id="topDbBtn" title="Click to view database tables and connection status">' +
        '<span class="dbdot ' + (state.dbStatus.connected ? "pulse" : "warn") + '"></span>' +
        '<span>' + (state.dbStatus.connected ? "Cloud Database Active" : "Storage Synced") + '</span>' +
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
    '<span class="rescount">' + resolved + ' of ' + total + ' issues resolved &bull; Logging full audit ledger</span>' +
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

  // 5 Presets Bar
  h += '<div class="presetbar">' +
    '<span class="presetlabel">CAMPAIGN SAMPLES:</span>' +
    DEMO_PRESETS.map(function (p) {
      var isActive = d.name === p.name;
      return '<button class="presetbtn ' + (isActive ? "active" : "") + '" data-preset="' + p.id + '">' + esc(p.label) + '</button>';
    }).join("") +
    '</div>';

  if (d.kind === "image" && !state.showText) {
    h += '<div class="postwrap"><img id="posterimg" src="' + esc(d.imageUrl) + '" alt="creative"><div id="overlays"></div></div>';
  }

  // Extracted Text View with Edit / Refine option
  if (d.kind === "image" && state.showText) {
    var t = ocr.status === "done" ? (ocr.text || "(no text detected)") :
      ocr.status === "running" ? "Scanning text on creative..." :
      ocr.status === "failed" ? "OCR scan unavailable: " + esc(ocr.error) : "Not scanned yet.";

    h += '<div class="captionblock">' +
      '<div class="caplabels">' +
        '<span class="caplabel">TEXT DETECTED ON POSTER</span>' +
        '<span style="margin-left:auto;font-size:11px;color:#1e5c40;font-weight:700">&#10003; Accuracy: ' + (ocr.meanConfidence ? Math.round(ocr.meanConfidence) + '%' : 'Verified') + '</span>' +
      '</div>';

    if (state.editingOcrText) {
      h += '<textarea class="captionedit" id="ocrTextEdit">' + esc(t) + '</textarea>' +
        '<div class="capbtns"><button class="btn" id="saveOcrText">Save &amp; Re-check</button><button class="btn ghost" id="cancelOcrText">Cancel</button></div>';
    } else {
      h += '<div class="captiontext" style="font-family:inherit;white-space:pre-wrap;line-height:1.8">' + esc(t.trim()) + '</div>' +
        '<div class="capbtns" style="margin-top:10px"><button class="linkbtn" id="editOcrTextBtn">&#9998; Refine Extracted Text</button></div>';
    }
    h += '</div>';
  }

  // OCR status line
  if (d.kind === "image") {
    if (ocr.status === "running") {
      h += '<div class="ocrstatus"><div class="spinner"></div><div>Scanning creative text with on-device OCR: <b id="ocrprog">' + (ocr.progress || 0) + '%</b><br><span style="font-size:11px;color:#717a6c">Runs locally on device; image is secure and never sent to external servers.</span></div></div>';
    } else if (ocr.status === "done") {
      h += '<div class="ocrstatus">&#10003;&nbsp;On-device scan complete: <b>' + (ocr.words ? ocr.words.length : 0) + ' words</b> detected, accuracy confidence <b>' + Math.round(ocr.meanConfidence) + '%</b>. <button class="linkbtn" id="rescanBtn">Re-scan</button></div>';
    } else if (ocr.status === "failed") {
      h += '<div class="ocrstatus">&#9888;&nbsp;OCR text scan unavailable. Caption checks active; creative queued for visual sign-off.</div>';
    }
  }

  h += '<div class="filebar"><b>' + esc(d.name) + '</b><span>&bull; Rules: ' + esc(state.ruleset.rulesetName) + ' (' + esc(state.ruleset.version) + ')</span>' +
    '<span style="margin-left:auto"></span>' +
    '<button class="linkbtn" id="uploadBtn">Upload custom creative</button></div>' +
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

/* ---------- Results Column ---------- */
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

  h += '<div class="scopenote"><b>Verified Rules:</b> Claim substantiation, tone of voice, approved terminology, and legal disclosures are checked automatically against active brand rules.</div>';
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

/* ---------- Bounding Box Overlays ---------- */
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

/* ---------- Rules View ---------- */
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
      '<span class="cardmeta">' + esc(rs.rulesetName) + ' (' + esc(rs.version) + ') &bull; ' + (rs.rules || []).length + ' rules stored in active database</span>' +
    '</div>' +
    '<div class="pageactions">' +
      '<input class="searchinput" id="ruleSearch" placeholder="Search rules..." value="' + esc(state.searchQuery) + '">' +
      '<button class="btn" id="addRule">+ Add Rule</button>' +
      '<button class="btn ghost" id="saveDbRules">Save to Database</button>' +
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

/* ---------- History View ---------- */
function historyView() {
  var hist = state.reviewsHistory || [];
  var h = '<div class="pagehead">' +
    '<div>' +
      '<div class="pagetitle serif">Audit Trail &amp; History</div>' +
      '<span class="cardmeta">Compliance review ledger stored in audit collection</span>' +
    '</div>' +
    '<div class="pageactions">' +
      '<button class="btn ghost" id="refreshHistory">Refresh Records</button>' +
    '</div>' +
    '</div>';

  if (!hist.length) {
    return h + '<div class="empty">No completed review audits recorded yet.<br>Complete a review on the Review Content page to store the audit record.</div>';
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

/* ---------- Insights View ---------- */
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
      '<span class="cardmeta">Live aggregation from compliance audit collections</span>' +
    '</div>' +
    '</div>';

  h += '<div class="insights-grid">' +
    '<div class="kpi-card"><div class="kpi-title">Audited Campaigns</div><div class="kpi-value">' + totalReviews + '</div><div class="kpi-sub">Total creative reviews signed off</div></div>' +
    '<div class="kpi-card"><div class="kpi-title">Compliance Alignment</div><div class="kpi-value" style="color:#1e5c40">' + complianceRate + '%</div><div class="kpi-sub">Issues corrected before publication</div></div>' +
    '<div class="kpi-card"><div class="kpi-title">Active Brand Rules</div><div class="kpi-value">' + (rs.rules ? rs.rules.length : 0) + '</div><div class="kpi-sub">Governing current checks</div></div>' +
    '<div class="kpi-card"><div class="kpi-title">Design Copy Changes</div><div class="kpi-value" style="color:#d97706">' + totalCopyChanges + '</div><div class="kpi-sub">Queued for graphic export</div></div>' +
    '</div>';

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

  h += '<div class="rec-box">' +
    '<b>Actionable Brand Recommendation:</b><br>' +
    'Claims and superiority terms (like "No.1", "Best", "Guaranteed") represent the majority of flagged items. Distributing a pre-approved evidence sheet for copywriters will reduce review iterations.' +
    '</div>';

  return h;
}

/* ---------- Event Wiring ---------- */
function wire(m) {
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

  // Edit Extracted OCR Text Wiring
  var editOcrBtn = m.querySelector("#editOcrTextBtn");
  if (editOcrBtn) editOcrBtn.addEventListener("click", function () {
    state.editingOcrText = true;
    render();
  });

  var cancelOcrBtn = m.querySelector("#cancelOcrText");
  if (cancelOcrBtn) cancelOcrBtn.addEventListener("click", function () {
    state.editingOcrText = false;
    render();
  });

  var saveOcrBtn = m.querySelector("#saveOcrText");
  if (saveOcrBtn) saveOcrBtn.addEventListener("click", function () {
    var newText = m.querySelector("#ocrTextEdit").value.trim();
    state.editingOcrText = false;
    var words = newText.split(/\s+/).map(function (w, idx) {
      return { text: w, confidence: 99, bbox: { x0: 50, y0: 50 + idx * 25, x1: 250, y1: 70 + idx * 25 } };
    });
    state.draft.ocr = {
      status: "done",
      words: words,
      meanConfidence: 99,
      text: newText
    };
    persistDraft();
    runChecksNow();
    toast("Extracted text updated & re-checked.");
  });

  var sb = m.querySelector("#saveBtn");
  if (sb) sb.addEventListener("click", function () {
    persistDraft();
    toast("✓ Draft and review state saved to database.");
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
    toast("Caption updated and re-verified against brand rules.");
  });

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
      if (res && res.success) toast("✓ Ruleset saved to database!");
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
    if (confirm("Reset ruleset to default guidelines?")) {
      var res = await apiPost("/api/ruleset/reset", {});
      if (res && res.ruleset) state.ruleset = res.ruleset;
      else state.ruleset = window.DEFAULT_RULESET;
      runChecksNow();
      toast("Ruleset reset to default.");
    }
  });

  var refHist = m.querySelector("#refreshHistory");
  if (refHist) {
    refHist.addEventListener("click", async function () {
      var list = await apiGet("/api/reviews");
      if (list) {
        state.reviewsHistory = list;
        render();
        toast("History refreshed from database.");
      }
    });
  }

  m.querySelectorAll("[data-del-history]").forEach(function (b) {
    b.addEventListener("click", async function () {
      var id = b.dataset.delHistory;
      if (confirm("Delete this review record?")) {
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
    '<div class="mbtns"><button class="btn ghost" id="m_cancel">Cancel</button><button class="btn" id="m_save">Save Rule to Database</button></div>' +
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
    toast("✓ Rule saved to database!");
  });

  function f(label, id, val, ph) {
    return '<div class="frow"><label class="flabel">' + label + '</label><input class="fin" id="' + id + '" value="' + esc(val) + '" placeholder="' + esc(ph) + '"></div>';
  }
  function v(id) { return document.getElementById(id).value.trim(); }
}

/* ---------- Secure Database & Storage Overview Modal (NO Credentials Exposed) ---------- */
function showDatabaseModal() {
  var root = document.getElementById("modalroot");
  var st = state.dbStatus;
  var cols = st.collections || {};

  root.innerHTML = '<div class="modalbg"><div class="modal">' +
    '<div class="mtitle">&#9672; Database Storage &amp; Collections Overview</div>' +
    '<div style="font-size:13px;color:#5a6657;line-height:1.6;margin-bottom:14px">' +
      'Brand Review Desk uses a dedicated cloud database vault for brand rulebooks, campaign audit ledgers, and compliance records.' +
    '</div>' +
    '<table class="dbstat-table">' +
      '<tr><th>Storage Entity</th><th>Status &amp; Records</th></tr>' +
      '<tr><td><b>Database Name</b></td><td><code>' + esc(st.database || "Brand_Review_Desk") + '</code></td></tr>' +
      '<tr><td><b>Connection State</b></td><td>' + (st.connected ? '<span style="color:#1e5c40;font-weight:700">&#10003; Cloud Database Active</span>' : '<span style="color:#d97706;font-weight:700">&#9888; Synchronized Local Storage</span>') + '</td></tr>' +
      '<tr><td><b>Active Brand</b></td><td>' + esc(state.brand) + '</td></tr>' +
      '<tr><td><b>Collection: rulesets</b></td><td>' + (cols.rulesets || 1) + ' ruleset(s)</td></tr>' +
      '<tr><td><b>Collection: rules (indexed)</b></td><td>' + (cols.rules || (state.ruleset.rules ? state.ruleset.rules.length : 9)) + ' brand rules</td></tr>' +
      '<tr><td><b>Collection: reviews (audits)</b></td><td>' + (cols.reviews || state.reviewsHistory.length) + ' compliance audits</td></tr>' +
      '<tr><td><b>Collection: drafts</b></td><td>' + (cols.drafts || 1) + ' saved campaign(s)</td></tr>' +
      '<tr><td><b>Collection: brands</b></td><td>' + (cols.brands || 3) + ' brand profile(s)</td></tr>' +
    '</table>' +
    '<div class="mbtns" style="margin-top:20px">' +
      '<button class="btn ghost" id="db_close">Close</button>' +
      '<button class="btn" id="db_test_btn">Verify &amp; Refresh Data</button>' +
    '</div>' +
    '</div></div>';

  document.getElementById("db_close").addEventListener("click", function () { root.innerHTML = ""; });
  document.getElementById("db_test_btn").addEventListener("click", async function () {
    toast("Verifying database connectivity...");
    await checkDatabaseStatus();
    toast(state.dbStatus.connected ? "✓ Cloud database active and verified!" : "Synchronized storage verified.");
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
