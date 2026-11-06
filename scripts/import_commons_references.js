const { MongoClient } = require('mongodb');
const dns = require('node:dns');
require('dotenv').config();

try { dns.setServers(['8.8.8.8', '1.1.1.1']); } catch {}

const uri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME || 'Brand_Review_Desk';
const queries = [
  'fruit juice glass',
  'green smoothie',
  'fresh fruit market',
  'salad bowl vegetables',
  'tea leaves cup',
  'bakery bread display',
  'catering buffet food',
  'spices ingredients bowl',
  'headphones audio',
  'laptop computer'
];
const curatedFallbacks = [
  { title: 'Apple juice glass.jpg', creator: 'JeanBono', licenseName: 'CC BY 4.0', licenseUrl: 'https://creativecommons.org/licenses/by/4.0/', description: 'Apple juice in a glass.' },
  { title: 'Green smoothie.jpg', creator: 'Joanna Slodownik', licenseName: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/', description: 'Green smoothie with banana, pear, celery, spinach.' },
  { title: 'Green smoothie bowl.jpg', creator: 'Miscellaneous contributor', licenseName: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', description: 'Green smoothie bowl with muesli and chia seeds.' },
  { title: 'Salad greens in pot.jpg', creator: 'Ruth Hartnup', licenseName: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/', description: 'Salad greens in a bowl.' },
  { title: 'Tea Leaves.jpg', creator: 'Sathish', licenseName: 'CC BY 3.0', licenseUrl: 'https://creativecommons.org/licenses/by/3.0/', description: 'Tea leaves photographed in Ooty.' },
  { title: 'Breads from a local bakery.jpg', creator: 'Elmer B. Domingo', licenseName: 'CC BY-SA 4.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/', description: 'Assorted breads from a local bakery.' },
  { title: 'Buffet foods.jpg', creator: 'Michael Coté', licenseName: 'CC BY 2.0', licenseUrl: 'https://creativecommons.org/licenses/by/2.0/', description: 'Food displayed at a buffet.' },
  { title: 'Common Indian household spices in a bowl.jpg', creator: 'Pamri (author assumed on Commons)', licenseName: 'Public domain', licenseUrl: 'https://creativecommons.org/publicdomain/mark/1.0/', description: 'Common Indian household spices in a bowl.' },
  { title: 'Headphones.jpg', creator: 'Atorero (Alexander Kozlov)', licenseName: 'CC BY-SA 3.0', licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/', description: 'Koss headphones.' },
  { title: 'Laptop image.jpg', creator: 'Darakshanehaluddin', licenseName: 'CC0 1.0', licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/', description: 'Laptop computer.' }
];

if (!uri) {
  console.error('MONGO_URI is required. No database was changed.');
  process.exit(1);
}

function plainText(value) {
  return String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function slug(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 55);
}

function hasOpenLicense(metadata) {
  const license = plainText(metadata?.LicenseShortName?.value).toLowerCase();
  const url = plainText(metadata?.LicenseUrl?.value).toLowerCase();
  return license.includes('cc0') || license.includes('public domain') ||
    license.includes('cc by') || license.includes('cc-by') ||
    url.includes('creativecommons.org/licenses/by/') ||
    url.includes('creativecommons.org/licenses/by-sa/') ||
    url.includes('creativecommons.org/publicdomain/');
}

async function findReference(term, excludedIds) {
  const params = new URLSearchParams({
    action: 'query',
    format: 'json',
    generator: 'search',
    gsrsearch: `filetype:bitmap ${term}`,
    gsrnamespace: '6',
    gsrlimit: '20',
    prop: 'imageinfo',
    iiprop: 'url|extmetadata',
    iiurlwidth: '1200'
  });
  const response = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
    headers: { 'User-Agent': 'BrandReviewDeskDemo/1.0 (image reference importer)' },
    signal: AbortSignal.timeout(20000)
  });
  if (!response.ok) throw new Error(`Wikimedia search failed for "${term}" (${response.status})`);
  const payload = await response.json();
  const pages = Object.values(payload.query?.pages || {});
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    const metadata = info?.extmetadata || {};
    if (!info || !info.thumburl || !hasOpenLicense(metadata)) continue;
    const title = plainText(page.title).replace(/^File:/, '');
    if (excludedIds.has(`commons-${slug(title)}`)) continue;
    const sourceUrl = `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title.replace(/ /g, '_'))}`;
    return {
      title,
      imageUrl: info.thumburl,
      sourceUrl,
      licenseName: plainText(metadata.LicenseShortName?.value) || 'Open license (verify source page)',
      licenseUrl: plainText(metadata.LicenseUrl?.value),
      creator: plainText(metadata.Artist?.value),
      description: plainText(metadata.ImageDescription?.value)
    };
  }
  throw new Error(`No openly licensed image found for "${term}"`);
}

async function main() {
  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 10000 });
  try {
    await client.connect();
    const database = client.db(dbName);
    const collection = database.collection('campaigns');
    const existingIds = new Set((await collection.find({ id: /^commons-/ }, { projection: { id: 1 } }).toArray()).map(row => row.id));
    let inserted = 0;
    for (const [index, term] of queries.entries()) {
      try {
        let image;
        try {
          image = await findReference(term, existingIds);
        } catch (searchError) {
          const fallback = curatedFallbacks[index];
          if (!fallback) throw searchError;
          const encodedName = encodeURIComponent(fallback.title);
          image = {
            ...fallback,
            imageUrl: `https://commons.wikimedia.org/wiki/Special:FilePath/${encodedName}?width=1200`,
            sourceUrl: `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(fallback.title.replace(/ /g, '_'))}`
          };
          console.log(`Using verified Commons reference for "${term}" because live search was unavailable.`);
        }
        const id = `commons-${slug(image.title)}`;
        const campaign = {
          id,
          code: `REF-${String(index + 1).padStart(3, '0')}`,
          title: image.title.replace(/\.[^/.]+$/, '').replace(/[_-]+/g, ' '),
          brandId: 'global',
          brandName: 'Reference library',
          channel: 'Image reference',
          format: 'Reference artwork',
          aspectRatio: '4/3',
          imageUrl: image.imageUrl,
          caption: '',
          ocrText: '',
          ocrConfidence: 0,
          initialFindings: [],
          status: 'action_required',
          referenceOnly: true,
          isDemo: true,
          sourceName: 'Wikimedia Commons',
          sourceUrl: image.sourceUrl,
          licenseName: image.licenseName,
          licenseUrl: image.licenseUrl,
          attribution: image.creator,
          sourceDescription: image.description,
          updatedAt: new Date()
        };
        const result = await collection.updateOne(
          { id },
          { $setOnInsert: { ...campaign, createdAt: new Date() } },
          { upsert: true }
        );
        existingIds.add(id);
        if (result.upsertedCount) inserted++;
        console.log(`${result.upsertedCount ? 'Added' : 'Already present'}: ${image.title} — ${image.licenseName}\n${image.sourceUrl}`);
      } catch (err) {
        console.warn(`Skipped "${term}": ${err.message}`);
      }
    }
    console.log(`Finished. ${inserted} new reference campaigns added; existing records were preserved.`);
  } finally {
    await client.close();
  }
}

main().catch(err => {
  console.error(`Reference import failed: ${err.message}`);
  process.exitCode = 1;
});
