# Nigat Portfolio CMS

One headless CMS ([Strapi 5](https://docs.strapi.io)) serving all three Nigat Group websites:
**Construction**, **Motors** and **Exports**, in **English and Amharic**.

**Stack:** Strapi 5 · TypeScript · PostgreSQL · Cloudinary.

## How content is organised

| Kind | Content types | How a website reads it |
| --- | --- | --- |
| Group-wide | `group-profile` (single type) | `GET /api/group-profile` |
| One entry per sector | `site-setting`, `home-page`, `about-page` | `GET /api/site-settings?filters[sector][$eq]=motors` |
| Shared, filtered by sector | `service`, `faq-group`, `gallery-item`, `testimonial`, `team-member`, `blog-post` | `GET /api/services?filters[sector][$eq]=exports&sort=order` |
| Sector-specific | `vehicle-category` (Motors), `product-category` (Exports), `project` (Construction) | `GET /api/projects` |
| Submissions | `enquiry` (write-only via API) | `POST /api/enquiries` |

- **Languages:** add `&locale=am` for Amharic (`en` is the default). Slugs, images and order are shared
  across languages; text is translated per language.
- **Media and components:** add `&populate=*` (or a targeted `populate[...]`) to include images and components.
- **Drafts:** collections use draft & publish. The API returns published content only.
- **Enquiries:** the public role can only *create* them. Staff read and manage them in the admin panel.
  `status` and `internalNotes` can't be set from outside.

Public read and enquiry-create permissions, plus the `am` locale, are applied automatically on every boot
(`src/bootstrap`).

### On-demand revalidation

When content goes live (published, unpublished or deleted, or saved for types without drafts), the CMS
sends a `POST` to **only the affected sector's** website:

```http
POST {REVALIDATE_URL_<SECTOR>}
x-revalidate-secret: {REVALIDATE_SECRET}

{ "sector": "motors", "model": "service", "action": "publish", "locale": "en" }
```

The website's route checks the secret and calls `revalidateTag(model)`. Leave a URL empty to disable it.

## Project structure

```
config/              Strapi config (server, admin, database, middlewares, plugins, api)
src/
  api/<type>/        Content types: schema + controller / route / service
  components/        Reusable field groups (seo, contact-info, hero-slide, faq item, …)
  bootstrap/         Idempotent startup tasks (locales, public permissions)
  constants/         Sectors, locales, which types are public
  lib/               Revalidation document middleware
  index.ts           register / bootstrap entry
database/migrations  Schema data migrations
types/generated      Auto-generated content types (do not edit)
```

## Getting started (local)

Requires Node 20–24 and Docker Desktop (running).

```bash
npm install
cp .env.example .env     # then generate the secrets (see below)
docker compose up -d     # local PostgreSQL on 127.0.0.1:5433
npm run develop          # http://localhost:1337/admin
```

On first run, create the admin user in the browser.

**Where local data lives (none of it goes to git):**

| Data | Location |
| --- | --- |
| Database | Docker volume `nigat-cms-db` (`docker compose down -v` wipes it) |
| Uploaded media | `public/uploads/` (git-ignored), or Cloudinary when its keys are set |
| Secrets | `.env` (git-ignored); `.env.example` is the committed template |

`docker-compose.yml` runs the **local database only**. In staging and production the CMS connects to a
managed PostgreSQL server through the `DATABASE_*` variables.

## Seeding a site's existing content

Each website's current content (English + Amharic) is kept as seed data in `scripts/seed/data/<sector>.json`.
Load it into the CMS (Postgres running; Strapi itself may be running or not):

```bash
npm run seed -- construction ../nigat_construction/public/images
```

The second argument is the website's images folder; files are uploaded once and reused. Re-running is safe:
entries are matched by slug (or order/anchor) and updated in place, never duplicated, and everything is
published in both languages. Re-running **overwrites edits made in the admin** for those entries, so treat it
as a one-time import per site.

## Environment variables

| Variable | Where to get it |
| --- | --- |
| `APP_KEYS`, `API_TOKEN_SALT`, `ADMIN_JWT_SECRET`, `TRANSFER_TOKEN_SALT`, `JWT_SECRET`, `ENCRYPTION_KEY` | Generate them yourself: `node -e "console.log(require('crypto').randomBytes(16).toString('base64'))"`. Use different values per environment. Never change them after go-live (`ENCRYPTION_KEY` and `ADMIN_JWT_SECRET` invalidate tokens and sessions). |
| `PUBLIC_URL` | The CMS domain you will deploy to (e.g. `https://cms.nigat.et`). |
| `IS_PROXIED` | `true` on Azure (HTTPS terminated in front of the container). |
| `DATABASE_*` | From the PostgreSQL server: Azure Database for PostgreSQL → *Connection strings*, or from whoever manages the DB. Create an empty database (e.g. `nigat_cms`); Strapi creates the tables. Set `DATABASE_SSL=true` for Azure Postgres. |
| `CLOUDINARY_NAME`, `CLOUDINARY_KEY`, `CLOUDINARY_SECRET` | [cloudinary.com](https://cloudinary.com) → Console → *Dashboard* (Product Environment Credentials: Cloud name, API Key, API Secret). |
| `CLOUDINARY_FOLDER` | Any folder name for this CMS's uploads (default `nigat-cms`). |
| `CORS_ORIGINS` | The deployed URLs of the three websites (Vercel project domains / custom domains) plus localhost. |
| `REVALIDATE_SECRET` | Generate a random string and put the **same** value in each website's env. |
| `REVALIDATE_URL_*` | Each website's revalidate endpoint once it exists, e.g. `https://nigat-motors.vercel.app/api/revalidate`. |

## Scripts

| Script | Purpose |
| --- | --- |
| `npm run develop` | Dev server with auto-reload and the Content-Type Builder |
| `npm run build` | Build the admin panel |
| `npm run start` | Production server (no Content-Type Builder) |
| `npm run typecheck` | TypeScript check |
| `npm run types:generate` | Regenerate `types/generated` |
