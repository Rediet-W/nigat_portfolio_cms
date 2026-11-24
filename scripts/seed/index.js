/**
 * Seeds one sector's content into the CMS from scripts/seed/data/<sector>.json.
 *
 *   npm run seed -- construction ../nigat_construction/public/images
 *
 * - Loads Strapi in-process (no API token or running server needed; uses the DB from .env).
 * - Idempotent: entries are matched by slug (or a stable key) and updated, never duplicated.
 * - Images are uploaded once and reused (matched by file name).
 * - Every entry is written in English, then Amharic, and published.
 */
'use strict';

const fs = require('fs');
const path = require('path');
const { createStrapi, compileStrapi } = require('@strapi/strapi');

const LOCALES = ['en', 'am'];
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.svg': 'image/svg+xml' };

/** [seed key, content type, stored field that identifies an entry on re-runs] */
const COLLECTIONS = [
  ['services', 'api::service.service', 'slug'],
  ['projects', 'api::project.project', 'slug'],
  ['teamMembers', 'api::team-member.team-member', 'slug'],
  ['blogPosts', 'api::blog-post.blog-post', 'slug'],
  ['faqGroups', 'api::faq-group.faq-group', 'anchor'],
  ['testimonials', 'api::testimonial.testimonial', 'order'],
  ['galleryItems', 'api::gallery-item.gallery-item', 'order'],
];
const PER_SECTOR = [
  ['siteSetting', 'api::site-setting.site-setting'],
  ['homePage', 'api::home-page.home-page'],
  ['aboutPage', 'api::about-page.about-page'],
];

/** Media fields per content type (values in the seed file are file names). */
const MEDIA_FIELDS = {
  'api::site-setting.site-setting': ['logo'],
  'api::home-page.home-page': [],
  'api::about-page.about-page': ['mainImage'],
  'api::service.service': ['image'],
  'api::project.project': ['cover', 'gallery'],
  'api::team-member.team-member': ['photo'],
  'api::blog-post.blog-post': ['cover'],
  'api::faq-group.faq-group': [],
  'api::testimonial.testimonial': ['photo'],
  'api::gallery-item.gallery-item': ['media'],
};

async function main() {
  const [sector, assetsArg] = process.argv.slice(2);
  if (!sector || !assetsArg) {
    console.error('Usage: npm run seed -- <sector> <path to the website images folder>');
    process.exit(1);
  }
  const dataFile = path.join(__dirname, 'data', `${sector}.json`);
  const assetsDir = path.resolve(assetsArg);
  if (!fs.existsSync(dataFile)) throw new Error(`No seed data at ${dataFile}`);
  if (!fs.existsSync(assetsDir)) throw new Error(`Images folder not found: ${assetsDir}`);
  const seed = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  if (seed.sector !== sector) throw new Error(`${dataFile} is for "${seed.sector}", not "${sector}"`);

  const strapi = await createStrapi(await compileStrapi()).load();
  strapi.log.level = 'warn';

  const uploads = new Map();
  /** Uploads a file from the website's images folder once; returns its id. */
  async function media(fileName, alt) {
    if (uploads.has(fileName)) return uploads.get(fileName);
    const existing = await strapi.db.query('plugin::upload.file').findOne({ where: { name: fileName } });
    let id = existing?.id;
    if (!id) {
      const filepath = path.join(assetsDir, fileName);
      if (!fs.existsSync(filepath)) throw new Error(`Image not found: ${filepath}`);
      const [file] = await strapi.plugin('upload').service('upload').upload({
        data: { fileInfo: { name: fileName, alternativeText: alt || '', caption: '' } },
        files: {
          filepath,
          originalFilename: fileName,
          mimetype: MIME[path.extname(fileName).toLowerCase()] || 'application/octet-stream',
          size: fs.statSync(filepath).size,
        },
      });
      id = file.id;
    }
    uploads.set(fileName, id);
    return id;
  }

  /** Swaps file names for upload ids; drops the seed-only `key`. Nested components (hero slides) too. */
  async function resolve(uid, shared, alt) {
    const data = { ...shared };
    delete data.key;
    for (const field of MEDIA_FIELDS[uid]) {
      if (data[field] === undefined) continue;
      data[field] = Array.isArray(data[field])
        ? await Promise.all(data[field].map((f) => media(f, alt)))
        : data[field] && (await media(data[field], alt));
    }
    if (Array.isArray(data.heroSlides)) {
      data.heroSlides = await Promise.all(data.heroSlides.map(async (s) => ({ ...s, image: await media(s.image, s.label) })));
    }
    return data;
  }

  const hasSector = (uid) => Boolean(strapi.getModel(uid).attributes.sector);
  const hasDrafts = (uid) => Boolean(strapi.getModel(uid).options?.draftAndPublish);

  /** Creates or updates one document in every locale and publishes it. */
  async function upsert(uid, where, entry, label) {
    const docs = strapi.documents(uid);
    const filters = { ...where, ...(hasSector(uid) ? { sector } : {}) };
    const found = await docs.findFirst({ filters, locale: 'en' });
    const alt = entry.locales.en.title || entry.locales.en.name || entry.locales.en.alt || label;
    const shared = { ...(await resolve(uid, entry.shared || {}, alt)), ...(hasSector(uid) ? { sector } : {}), ...where };

    let documentId = found?.documentId;
    for (const locale of LOCALES) {
      const data = { ...shared, ...entry.locales[locale] };
      if (!documentId) {
        documentId = (await docs.create({ data, locale })).documentId;
      } else {
        await docs.update({ documentId, locale, data });
      }
      if (hasDrafts(uid)) await docs.publish({ documentId, locale });
    }
    return found ? 'updated' : 'created';
  }

  const tally = {};
  const count = (key, result) => {
    tally[key] = tally[key] || { created: 0, updated: 0 };
    tally[key][result] += 1;
  };

  for (const [key, uid] of PER_SECTOR) {
    if (seed[key]) count(key, await upsert(uid, {}, seed[key], key));
  }
  for (const [key, uid, field] of COLLECTIONS) {
    for (const entry of seed[key] || []) {
      const where = { [field]: field === 'slug' ? entry.slug : entry.shared[field] };
      count(key, await upsert(uid, where, entry, entry.slug || entry.key));
    }
  }

  console.table(tally);
  await strapi.destroy();
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
