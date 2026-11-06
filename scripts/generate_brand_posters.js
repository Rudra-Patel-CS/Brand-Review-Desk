/* Generates lightweight SVG demo posters for the 10 added brands.
   Run: node scripts/generate_brand_posters.js
   Replace any file in public/assets/brands/ with a real campaign image and
   update imageUrl in data/demo-catalog.json if you prefer photography.
*/

const fs = require('node:fs');
const path = require('node:path');

const OUT_DIR = path.join(__dirname, '..', 'public', 'assets', 'brands');

const brands = [
  {
    id: 'aurora',
    wordmark: 'AURORA',
    submark: 'SKIN SCIENCES',
    category: 'CLINICAL SKINCARE',
    headline: ['CLINICALLY PROVEN', 'TO CURE ACNE', 'IN 7 DAYS'],
    subline: 'PERMANENT RESULTS  •  100% SUN PROTECTION',
    cta: 'SHOP THE ROUTINE',
    ratio: '4/5',
    bg: ['#0b2b2b', '#1f6259'],
    accent: '#f3c9c4',
    text: '#ffffff'
  },
  {
    id: 'verdant',
    wordmark: 'VERDANT',
    submark: 'HOME',
    category: 'PLANT-DERIVED HOME CARE',
    headline: ['KILLS 99.9%', 'OF GERMS', '100% NON-TOXIC'],
    subline: 'THE ECO-FRIENDLY WAY TO A HEALTHIER HOME',
    cta: 'SHOP SPRING CLEAN',
    ratio: '4/5',
    bg: ['#173321', '#3f6b3a'],
    accent: '#c9e7a4',
    text: '#ffffff'
  },
  {
    id: 'peakform',
    wordmark: 'PEAKFORM',
    submark: 'ATHLETICS',
    category: 'PERFORMANCE NUTRITION',
    headline: ['LOSE 10 KG', 'IN 30 DAYS', 'GUARANTEED'],
    subline: 'BUILD MUSCLE FAST  •  STEROID-FREE STACK',
    cta: 'START THE SHRED',
    ratio: '4/5',
    bg: ['#141519', '#3a2118'],
    accent: '#ff7a3d',
    text: '#ffffff'
  },
  {
    id: 'lumina',
    wordmark: 'LUMINA',
    submark: 'BANK',
    category: 'DIGITAL WEALTH',
    headline: ['GUARANTEED 18%', 'RETURNS', 'ZERO FEES'],
    subline: 'INSTANT APPROVAL IN 5 MINUTES',
    cta: 'APPLY NOW',
    ratio: '16/9',
    bg: ['#081a33', '#143d63'],
    accent: '#e3bf63',
    text: '#ffffff'
  },
  {
    id: 'terratrail',
    wordmark: 'TERRATRAIL',
    submark: 'EXPEDITIONS',
    category: 'LOW-IMPACT TRAVEL',
    headline: ['100% CARBON', 'NEUTRAL TRIPS', 'GUARANTEED TIGERS'],
    subline: 'FULLY REFUNDABLE  •  NO CANCELLATION FEE',
    cta: 'BOOK THE ESCAPE',
    ratio: '4/5',
    bg: ['#2c2416', '#5a5b36'],
    accent: '#d8c78f',
    text: '#ffffff'
  },
  {
    id: 'bytebloom',
    wordmark: 'BYTEBLOOM',
    submark: 'LEARNING',
    category: 'AI CAREER BOOTCAMP',
    headline: ['GUARANTEED JOB', 'PLACEMENT', 'LEARN AI IN 30 DAYS'],
    subline: 'GET HIRED FASTER WITH EXPERT MENTORS',
    cta: 'ENROLL NOW',
    ratio: '16/9',
    bg: ['#1c1440', '#3b2a7a'],
    accent: '#7ef0c0',
    text: '#ffffff'
  },
  {
    id: 'solstice',
    wordmark: 'SOLSTICE',
    submark: 'BEVERAGES',
    category: 'PREMIUM MIXERS',
    headline: ['ZERO SUGAR', 'CURES HANGOVERS', 'PARTY ALL NIGHT'],
    subline: '100% NATURAL  •  SMALL-BATCH TONICS',
    cta: 'FIND A STOCKIST',
    ratio: '4/5',
    bg: ['#2a1126', '#5c2338'],
    accent: '#f4ad63',
    text: '#ffffff'
  },
  {
    id: 'nimbus',
    wordmark: 'NIMBUS',
    submark: 'CLOUDWORKS',
    category: 'MANAGED KUBERNETES',
    headline: ['ZERO DOWNTIME', 'UNLIMITED STORAGE', 'CHEAPEST CLOUD'],
    subline: 'SHIP FASTER WITH ENTERPRISE-GRADE OBSERVABILITY',
    cta: 'START FREE',
    ratio: '16/9',
    bg: ['#0b1324', '#18314f'],
    accent: '#4cc9f0',
    text: '#ffffff'
  },
  {
    id: 'petalpine',
    wordmark: 'PETAL & PINE',
    submark: 'BABY CARE',
    category: 'GENTLE SLEEP ESSENTIALS',
    headline: ['100%', 'HYPOALLERGENIC', 'PREVENTS SIDS'],
    subline: 'PEDIATRICIAN RECOMMENDED FOR SAFER NIGHTS',
    cta: 'SHOP GENTLE SLEEP',
    ratio: '4/5',
    bg: ['#f4ece2', '#e3d6c6'],
    accent: '#6f8f74',
    text: '#24352a'
  },
  {
    id: 'forgeflame',
    wordmark: 'FORGE & FLAME',
    submark: 'OUTDOOR KITCHENS',
    category: 'PRO GRILL SYSTEMS',
    headline: ['FIREPROOF', '100% HEATPROOF', 'LIFETIME WARRANTY'],
    subline: 'NO MAINTENANCE EVER  •  BUILT FOR THE BACKYARD',
    cta: 'ORDER THE PRO GRILL',
    ratio: '16/9',
    bg: ['#171210', '#3a1d12'],
    accent: '#f26a2e',
    text: '#ffffff'
  }
];

function escapeXml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function poster(brand) {
  const wide = brand.ratio === '16/9';
  const W = wide ? 1600 : 1200;
  const H = wide ? 900 : 1500;
  const pad = wide ? 120 : 96;
  const headlineSize = wide ? 62 : 82;
  const headlineStart = wide ? 380 : 610;
  const headlineGap = wide ? 74 : 98;
  const sublineY = wide ? 560 : 930;
  const ctaY = wide ? 700 : 1240;
  const brandY = wide ? 120 : 150;
  const categoryY = wide ? 180 : 225;
  const submarkY = wide ? 156 : 190;

  const headline = brand.headline
    .map(
      (line, i) =>
        `<text x="${pad}" y="${headlineStart + i * headlineGap}" font-family="Georgia, 'Times New Roman', serif" font-size="${headlineSize}" font-weight="700" fill="${brand.text}" letter-spacing="-1">${escapeXml(line)}</text>`
    )
    .join('\n    ');

  const ctaWidth = wide ? 320 : 360;
  const ctaHeight = wide ? 62 : 74;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${escapeXml(brand.wordmark + ' ' + brand.category)}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="${brand.bg[0]}"/>
      <stop offset="100%" stop-color="${brand.bg[1]}"/>
    </linearGradient>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${brand.accent}" stop-opacity="0.35"/>
      <stop offset="100%" stop-color="${brand.accent}" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  <circle cx="${W * 0.82}" cy="${H * 0.18}" r="${wide ? 320 : 380}" fill="url(#glow)"/>
  <circle cx="${W * 0.12}" cy="${H * 0.92}" r="${wide ? 220 : 300}" fill="${brand.accent}" opacity="0.08"/>
  <circle cx="${W * 0.9}" cy="${H * 0.78}" r="${wide ? 180 : 220}" fill="none" stroke="${brand.accent}" stroke-opacity="0.22" stroke-width="2"/>
  <circle cx="${W * 0.9}" cy="${H * 0.78}" r="${wide ? 130 : 160}" fill="none" stroke="${brand.accent}" stroke-opacity="0.14" stroke-width="2"/>

  <text x="${pad}" y="${brandY}" font-family="Georgia, 'Times New Roman', serif" font-size="${wide ? 54 : 62}" font-weight="700" fill="${brand.text}" letter-spacing="2">${escapeXml(brand.wordmark)}</text>
  <text x="${pad}" y="${submarkY}" font-family="Arial, Helvetica, sans-serif" font-size="${wide ? 18 : 20}" font-weight="700" fill="${brand.accent}" letter-spacing="6">${escapeXml(brand.submark)}</text>
  <line x1="${pad}" y1="${categoryY + 26}" x2="${pad + (wide ? 420 : 460)}" y2="${categoryY + 26}" stroke="${brand.accent}" stroke-opacity="0.5" stroke-width="2"/>
  <text x="${pad}" y="${categoryY + 62}" font-family="Arial, Helvetica, sans-serif" font-size="${wide ? 16 : 18}" font-weight="700" fill="${brand.text}" fill-opacity="0.72" letter-spacing="4">${escapeXml(brand.category)}</text>

  ${headline}

  <text x="${pad}" y="${sublineY}" font-family="Arial, Helvetica, sans-serif" font-size="${wide ? 20 : 22}" font-weight="600" fill="${brand.accent}" letter-spacing="2">${escapeXml(brand.subline)}</text>

  <rect x="${pad}" y="${ctaY}" width="${ctaWidth}" height="${ctaHeight}" rx="${ctaHeight / 2}" fill="${brand.accent}"/>
  <text x="${pad + ctaWidth / 2}" y="${ctaY + ctaHeight / 2 + 6}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-size="${wide ? 18 : 20}" font-weight="700" fill="${brand.bg[0]}" letter-spacing="1.5">${escapeXml(brand.cta)}</text>

  <text x="${pad}" y="${H - (wide ? 54 : 70)}" font-family="Arial, Helvetica, sans-serif" font-size="${wide ? 14 : 15}" fill="${brand.text}" fill-opacity="0.55" letter-spacing="2">${escapeXml(brand.wordmark.replace(/ /g, '').toLowerCase())}.com  •  DEMO CREATIVE FOR COMPLIANCE REVIEW</text>
</svg>
`;
}

fs.mkdirSync(OUT_DIR, { recursive: true });
for (const brand of brands) {
  const file = path.join(OUT_DIR, `${brand.id}.svg`);
  fs.writeFileSync(file, poster(brand), 'utf8');
  console.log(`wrote ${path.relative(process.cwd(), file)}`);
}
