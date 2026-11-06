/* Brand Review Desk - check engine (pure logic, no DOM).
   Runs the loaded brand rules against caption text and OCR text
   extracted from the creative. Every flag carries the rule ID, the
   exact matched quote and the rule's source reference.
   Works in the browser (window.BRDEngine) and in Node (for tests). */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) module.exports = factory();
  else root.BRDEngine = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Build one searchable text plus per-word character offsets so an OCR
  // text match can be mapped back to word bounding boxes on the image.
  function indexOcrWords(words) {
    var text = "", spans = [];
    (words || []).forEach(function (w) {
      var start = text.length;
      text += w.text;
      spans.push({ start: start, end: text.length, bbox: w.bbox, confidence: w.confidence });
      text += " ";
    });
    return { text: text, spans: spans };
  }

  function findMatches(text, pattern, isRegex) {
    var out = [];
    if (!text || !pattern) return out;
    if (isRegex) {
      var re;
      try { re = new RegExp(pattern, "gi"); } catch (e) { return out; }
      var m;
      while ((m = re.exec(text)) !== null) {
        if (m[0].length === 0) { re.lastIndex++; continue; }
        out.push({ start: m.index, end: m.index + m[0].length, matched: m[0] });
        if (out.length > 50) break;
      }
    } else {
      var hay = text.toLowerCase(), needle = pattern.toLowerCase(), i = 0;
      while ((i = hay.indexOf(needle, i)) !== -1) {
        out.push({ start: i, end: i + needle.length, matched: text.substr(i, needle.length) });
        i += needle.length;
        if (out.length > 50) break;
      }
    }
    return out;
  }

  function bboxForMatch(spans, start, end) {
    var hit = spans.filter(function (s) { return s.start < end && s.end > start; });
    if (!hit.length) return null;
    var box = { x0: Infinity, y0: Infinity, x1: -Infinity, y1: -Infinity }, confSum = 0;
    hit.forEach(function (s) {
      box.x0 = Math.min(box.x0, s.bbox.x0); box.y0 = Math.min(box.y0, s.bbox.y0);
      box.x1 = Math.max(box.x1, s.bbox.x1); box.y1 = Math.max(box.y1, s.bbox.y1);
      confSum += s.confidence || 0;
    });
    return { bbox: box, meanConfidence: confSum / hit.length, wordCount: hit.length };
  }

  function pad(box, p) {
    return { x0: Math.max(0, box.x0 - p), y0: Math.max(0, box.y0 - p), x1: box.x1 + p, y1: box.y1 + p };
  }

  /* input: { caption: string, ocr: { ran, words: [{text,bbox,confidence}], meanConfidence } }
     rules: array from the loaded ruleset. Returns { flags, manualReview }. */
  function runChecks(input, rules) {
    var flags = [], manualReview = [], n = 0;
    var ocrIndex = input.ocr && input.ocr.ran ? indexOcrWords(input.ocr.words) : null;

    rules.filter(function (r) { return r.enabled !== false; }).forEach(function (rule) {
      (rule.patterns || []).forEach(function (pattern) {
        // 1) caption text
        findMatches(input.caption || "", pattern, !!rule.regex).forEach(function (m) {
          flags.push(makeFlag(rule, m, "caption", { start: m.start, end: m.end }, null, ++n));
        });
        // 2) creative text (OCR)
        if (ocrIndex) {
          findMatches(ocrIndex.text, pattern, !!rule.regex).forEach(function (m) {
            var loc = bboxForMatch(ocrIndex.spans, m.start, m.end);
            flags.push(makeFlag(rule, m, "creative", null, loc ? pad(loc.bbox, 10) : null, ++n, loc));
          });
        }
      });
    });

    if (input.ocr && input.ocr.ran) {
      if (!ocrIndex.text.trim()) {
        manualReview.push({ kind: "no-text", message: "No readable text was detected on this creative. Visual checks cannot run on it, so it goes to manual review - never auto-passed." });
      } else if ((input.ocr.meanConfidence || 0) < 55) {
        manualReview.push({ kind: "low-confidence", message: "OCR confidence is low on this creative (stylized type or busy background). Treat creative-text flags as hints and confirm by eye." });
      }
    }
    flags = dedupeFlags(flags);
    return { flags: flags, manualReview: manualReview };
  }

  // When two patterns of the same rule match overlapping text on the same
  // source, keep the longest match so one issue does not appear twice.
  function dedupeFlags(flags) {
    var seenId = {};
    flags = flags.filter(function (f) { if (seenId[f.id]) return false; seenId[f.id] = true; return true; });
    return flags.filter(function (f) {
      if (f.sourceType !== "caption") return true;
      return !flags.some(function (g) {
        return g !== f && g.ruleId === f.ruleId && g.sourceType === f.sourceType &&
          g.span && f.span && g.span.start <= f.span.start && g.span.end >= f.span.end &&
          (g.span.end - g.span.start) > (f.span.end - f.span.start);
      });
    });
  }

  function makeFlag(rule, m, sourceType, span, bbox, n, loc) {
    // stable id: the same violation keeps the same id across check re-runs
    var id = rule.id + "-" + sourceType + "-" + m.matched.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40);
    return {
      id: id,
      ruleId: rule.id,
      name: rule.name,
      category: rule.category,
      severity: rule.severity,
      matched: m.matched,
      sourceType: sourceType,              // "caption" | "creative"
      span: span || null,                  // char offsets when caption
      bbox: bbox || null,                  // pixel box when creative
      ocrConfidence: loc ? Math.round(loc.meanConfidence) : null,
      why: rule.why,
      // Caption flags can be fixed in place; creative flags queue a copy
      // change for the design re-export (this app never edits poster pixels).
      suggestion: rule.suggestion ? {
        kind: sourceType === "caption" ? rule.suggestion.kind : "copy-change",
        text: rule.suggestion.text,
        note: rule.suggestion.note
      } : null,
      sourceRef: rule.source
    };
  }

  function escapeRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

  // Replace the matched span of one caption flag with the suggestion text.
  function applyToCaption(caption, flag) {
    if (!flag || flag.sourceType !== "caption" || !flag.span || !flag.suggestion) return caption;
    return caption.slice(0, flag.span.start) + flag.suggestion.text + caption.slice(flag.span.end);
  }

  function buildExport(session) {
    var lines = [];
    lines.push("BRAND REVIEW DESK - REVIEW REPORT");
    lines.push("Brand: " + session.brand + "  |  Ruleset: " + session.rulesetName + " " + session.rulesVersion);
    lines.push("Content: " + session.contentName + "  |  Reviewed: " + session.timestamp);
    lines.push("");
    lines.push("DECISIONS (" + session.decisions.length + ")");
    session.decisions.forEach(function (d) {
      lines.push("- [" + d.decision.toUpperCase() + "] " + d.ruleId + " " + d.name +
        " | matched \"" + d.matched + "\" in " + d.sourceType +
        (d.decision === "applied" && d.suggestionText ? " | fix: \"" + d.suggestionText + "\"" : "") +
        (d.decision === "copy-change" ? " | creative copy change queued: \"" + d.matched + "\" -> \"" + d.suggestionText + "\" (poster re-export required; pixels not edited here)" : "") +
        (d.decision === "dismissed" && d.reason ? " | reason: " + d.reason : ""));
      lines.push("  rule source: " + d.sourceRef.doc + " " + d.sourceRef.version + " - \"" + d.sourceRef.quote + "\"");
    });
    if (session.copyChanges && session.copyChanges.length) {
      lines.push("");
      lines.push("QUEUED CREATIVE COPY CHANGES (hand to design)");
      session.copyChanges.forEach(function (c) { lines.push("- \"" + c.from + "\" -> \"" + c.to + "\""); });
    }
    lines.push("");
    lines.push("FINAL APPROVED CAPTION");
    lines.push(session.finalCaption || "(none)");
    return { text: lines.join("\n"), json: session };
  }

  return { runChecks: runChecks, findMatches: findMatches, indexOcrWords: indexOcrWords, applyToCaption: applyToCaption, buildExport: buildExport, escapeRe: escapeRe };
});
