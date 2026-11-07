#!/usr/bin/env node
/* Brand Review Desk - Base64 to GridFS Migration Utility
   Migrates campaign records with embedded base64 data URLs to MongoDB GridFS.
   - Idempotent: Skips campaigns that are already migrated
   - Safe: Preserves existing base64 in `legacyImageUrl` until manually verified
   - Dry-run mode: Run with --dry-run to preview actions without modifying records
   - Manual execution: NEVER run automatically during server startup
*/

require('dotenv').config();
const { MongoClient, ObjectId, GridFSBucket } = require('mongodb');
const { detectImageType, BUCKET_NAME } = require('../storage');
const { Readable } = require('stream');

const uri = process.env.MONGO_URI;
const dbName = process.env.DB_NAME || 'Brand_Review_Desk';
const isDryRun = process.argv.includes('--dry-run') || process.argv.includes('-d');

function parseBase64DataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) {
    return null;
  }
  const match = dataUrl.match(/^data:(image\/[a-zA-Z0-9.+_-]+);base64,(.+)$/);
  if (!match) return null;
  const mimeType = match[1];
  const buffer = Buffer.from(match[2], 'base64');
  return { mimeType, buffer };
}

async function uploadBufferToGridFS(bucket, buffer, filename, metadata) {
  return new Promise((resolve, reject) => {
    const uploadStream = bucket.openUploadStream(filename, {
      metadata,
      contentType: metadata.mimeType
    });
    const readable = new Readable();
    readable.push(buffer);
    readable.push(null);

    readable
      .pipe(uploadStream)
      .on('error', reject)
      .on('finish', () => resolve(uploadStream.id));
  });
}

async function runMigration() {
  if (!uri) {
    console.error('Error: MONGO_URI is required to run the migration.');
    process.exit(1);
  }
  console.log('────────────────────────────────────────────────────────────');
  console.log(`Campaign Base64 -> GridFS Migration Tool ${isDryRun ? '[DRY RUN MODE]' : '[LIVE EXECUTION]'}`);
  console.log('────────────────────────────────────────────────────────────');

  const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
  try {
    await client.connect();
    const database = client.db(dbName);
    const campaignsCollection = database.collection('campaigns');
    const bucket = new GridFSBucket(database, { bucketName: BUCKET_NAME });

    // Find all campaigns that contain base64 image data and have not been migrated yet
    const query = {
      $and: [
        { imageUrl: { $regex: /^data:image\//i } },
        { assetId: { $exists: false } }
      ]
    };

    const candidates = await campaignsCollection.find(query).toArray();
    console.log(`Found ${candidates.length} candidate campaign(s) with base64 image data.\n`);

    if (candidates.length === 0) {
      console.log('No unmigrated base64 campaigns found. Everything is already up to date!');
      return;
    }

    let migratedCount = 0;
    let skippedCount = 0;

    for (const campaign of candidates) {
      const parsed = parseBase64DataUrl(campaign.imageUrl);
      if (!parsed) {
        console.warn(`[SKIP] Campaign ${campaign.id} (${campaign.title}): Could not parse data URL.`);
        skippedCount++;
        continue;
      }

      const { buffer } = parsed;
      const detected = detectImageType(buffer);
      if (!detected) {
        console.warn(`[SKIP] Campaign ${campaign.id} (${campaign.title}): Content did not match supported image magic bytes.`);
        skippedCount++;
        continue;
      }

      const filename = `${campaign.id || 'campaign'}-${Date.now()}.${detected.extension}`;
      const metadata = {
        migratedFromBase64: true,
        campaignId: campaign.id,
        mimeType: detected.mimeType,
        size: buffer.length,
        migratedAt: new Date()
      };

      if (isDryRun) {
        console.log(`[DRY RUN] Would migrate campaign: ${campaign.id}`);
        console.log(`          Title: "${campaign.title}"`);
        console.log(`          Size: ${Math.round(buffer.length / 1024)} KB (${detected.mimeType})`);
        console.log(`          Target GridFS Bucket: ${BUCKET_NAME}`);
        console.log(`          New Asset URL: /api/assets/<generated-gridfs-id>\n`);
        migratedCount++;
      } else {
        const fileId = await uploadBufferToGridFS(bucket, buffer, filename, metadata);
        const newUrl = `/api/assets/${fileId}`;

        // Update document: set assetId and new URL, while preserving legacyBase64Url
        await campaignsCollection.updateOne(
          { _id: campaign._id },
          {
            $set: {
              assetId: String(fileId),
              imageUrl: newUrl,
              legacyImageUrl: campaign.imageUrl,
              assetMetadata: metadata,
              updatedAt: new Date()
            }
          }
        );

        console.log(`[MIGRATED] Campaign ${campaign.id}: "${campaign.title}"`);
        console.log(`           GridFS ID: ${fileId} -> URL: ${newUrl}\n`);
        migratedCount++;
      }
    }

    console.log('────────────────────────────────────────────────────────────');
    console.log(`Migration Summary:`);
    console.log(`  - Total Candidates: ${candidates.length}`);
    console.log(`  - ${isDryRun ? 'Would Migrate' : 'Successfully Migrated'}: ${migratedCount}`);
    console.log(`  - Skipped: ${skippedCount}`);
    console.log('────────────────────────────────────────────────────────────');
  } finally {
    await client.close();
  }
}

if (require.main === module) {
  runMigration().catch((err) => {
    console.error('Migration failed:', err.message);
    process.exit(1);
  });
}

module.exports = { runMigration, parseBase64DataUrl };
