window.DEFAULT_RULESET = {
  "brand": "Arka Foods (demo)",
  "rulesetName": "Arka Foods Brand Compliance Guidelines",
  "version": "v3.2",
  "note": "Official brand compliance ruleset governing advertising claims, tone of voice, terminology, and legal requirements.",
  "approvedFacts": [
    {
      "id": "FACT-04",
      "text": "Gujarat ka apna snacks brand, 2018 se",
      "source": { "doc": "Arka Brand Book", "version": "v3", "quote": "Approved non-comparative positioning line: 'Gujarat ka apna snacks brand, 2018 se'." }
    },
    {
      "id": "FACT-05",
      "text": "Made with 100% natural spices sourced directly from local farmers",
      "source": { "doc": "Arka Quality Standards", "version": "v2", "quote": "Standard: 'Made with 100% natural spices sourced directly from local farmers'." }
    }
  ],
  "rules": [
    {
      "id": "FACT-01",
      "name": "Unsubstantiated Superiority Claim",
      "category": "Claims & Evidence",
      "type": "claim",
      "severity": "high",
      "patterns": ["\\bno\\.?\\s*1\\b", "\\bnumber\\s+one\\b", "\\bbest\\b", "\\bbiggest\\b", "\\bleading\\b", "\\bmost\\s+trusted\\b", "\\bsabse\\s+bada\\b", "\\bsabse\\b", "#1"],
      "regex": true,
      "why": "Brand rule FACT-01 requires any 'No.1', 'Best', or superiority claim to carry an audited, documented source on file before publication.",
      "suggestion": { "kind": "replace", "text": "Gujarat ka apna snacks brand, 2018 se", "note": "Approved non-comparative fact FACT-04." },
      "source": { "doc": "Arka Brand Book", "version": "v3", "quote": "Superiority claims (No.1, best, biggest, leading) must carry an approved evidence source on file." },
      "enabled": true
    },
    {
      "id": "TONE-04",
      "name": "Tone Mismatch / Hype Wording",
      "category": "Tone of Voice",
      "type": "phrase",
      "severity": "medium",
      "patterns": ["we're obsessed with", "we are obsessed with", "obsessed", "crazy good", "insanely", "addictive", "insanely crunchy"],
      "regex": false,
      "why": "Tone rule TONE-04: Arka's voice is warm and family-first. Hype adjectives like 'obsessed', 'insanely', and 'addictive' dilute the authentic heritage tone.",
      "suggestion": { "kind": "replace", "text": "we love", "note": "Maintains heartfelt warmth without aggressive marketing hype." },
      "source": { "doc": "Arka Tone Guide", "version": "v3", "quote": "Avoid hype wording (obsessed, addictive, insanely). Prefer warm, family-first language." },
      "enabled": true
    },
    {
      "id": "TERM-02",
      "name": "Retired Terminology",
      "category": "Approved Terminology",
      "type": "phrase",
      "severity": "low",
      "patterns": ["vegan-friendly", "vegan friendly"],
      "regex": false,
      "why": "Terminology rule TERM-02: 'plant-based' is the approved current customer-facing standard. 'Vegan-friendly' is retired wording.",
      "suggestion": { "kind": "replace", "text": "plant-based", "note": "Approved standard term per TERM-02." },
      "source": { "doc": "Arka Terminology List", "version": "v3", "quote": "Say 'plant-based', not 'vegan-friendly'." },
      "enabled": true
    },
    {
      "id": "LEGAL-01",
      "name": "Guaranteed Delivery Disclaimer",
      "category": "Legal & Compliance",
      "type": "phrase",
      "severity": "high",
      "patterns": ["guaranteed delivery", "100% guaranteed delivery", "guaranteed diwali delivery"],
      "regex": false,
      "why": "Legal rule LEGAL-01: Absolute delivery guarantees create strict commercial liability. Must state target delivery subject to courier SLAs.",
      "suggestion": { "kind": "replace", "text": "estimated festive delivery (courier SLAs apply)", "note": "Compliant wording per legal handbook." },
      "source": { "doc": "Arka Legal Handbook", "version": "v2", "quote": "Do not promise unqualified delivery guarantees in advertising." },
      "enabled": true
    },
    {
      "id": "LEGAL-02",
      "name": "Unqualified Money Back Guarantee",
      "category": "Legal & Compliance",
      "type": "phrase",
      "severity": "high",
      "patterns": ["100% money back guaranteed", "money back guaranteed", "money back guarantee"],
      "regex": false,
      "why": "Legal rule LEGAL-02: Food products cannot advertise unqualified money-back guarantees without specific terms regarding product return conditions.",
      "suggestion": { "kind": "replace", "text": "satisfaction guaranteed per terms", "note": "Qualified refund policy statement." },
      "source": { "doc": "Arka Legal Handbook", "version": "v2", "quote": "Money-back guarantees must refer to clear invoice terms." },
      "enabled": true
    },
    {
      "id": "PRICE-01",
      "name": "Promotional & Free Gift Transparency",
      "category": "Pricing & Offers",
      "type": "phrase",
      "severity": "medium",
      "patterns": ["free gift", "100% free gift", "free without conditions", "100% free"],
      "regex": false,
      "why": "Pricing rule PRICE-01: Promotional 'free gift' statements must state minimum order criteria or qualifying box types.",
      "suggestion": { "kind": "replace", "text": "complimentary gift with select festive boxes", "note": "Compliant promotional description." },
      "source": { "doc": "Arka Promotions Guide", "version": "v1.4", "quote": "All promotional claims must clearly specify qualifying cart conditions." },
      "enabled": true
    },
    {
      "id": "TECH-01",
      "name": "Absolute Zero-Downtime Guarantee",
      "category": "Technical & SLA",
      "type": "phrase",
      "severity": "high",
      "patterns": ["zero downtime guaranteed", "zero downtime guaranteed 100%"],
      "regex": false,
      "why": "Technical rule TECH-01: Absolute zero-downtime claims violate SLA policies; state 99.99% high availability instead.",
      "suggestion": { "kind": "replace", "text": "99.99% high-availability SLA", "note": "Standard enterprise cloud SLA standard." },
      "source": { "doc": "Enterprise Cloud SLA Policy", "version": "v4", "quote": "Advertise high-availability percentages, never absolute zero downtime." },
      "enabled": true
    },
    {
      "id": "COMP-01",
      "name": "Unsubstantiated Comparative Pricing",
      "category": "Competitive Claims",
      "type": "phrase",
      "severity": "medium",
      "patterns": ["cheapest cloud storage", "cheapest in asia", "cheapest"],
      "regex": false,
      "why": "Competitive rule COMP-01: Price superiority claims ('cheapest') require third-party benchmark disclosures.",
      "suggestion": { "kind": "replace", "text": "cost-optimized enterprise tier", "note": "Compliant pricing tier description." },
      "source": { "doc": "Enterprise Compliance Code", "version": "v2", "quote": "Comparative pricing claims must cite published third-party audits." },
      "enabled": true
    },
    {
      "id": "HEALTH-01",
      "name": "Curative / Medical Disease Claim",
      "category": "Health & Nutrition",
      "type": "phrase",
      "severity": "high",
      "patterns": ["100% cure for daily fatigue", "100% cure", "cure for fatigue", "permanently boosts immunity", "cure"],
      "regex": false,
      "why": "Health rule HEALTH-01: Food and juice products cannot claim to cure medical conditions or diseases under FSSAI / advertising standards.",
      "suggestion": { "kind": "replace", "text": "nourishing blend supporting daily wellness", "note": "Compliant wellness positioning." },
      "source": { "doc": "Food Advertising Guidelines", "version": "v3", "quote": "Food products must not claim therapeutic or curative disease benefits." },
      "enabled": true
    }
  ]
};
