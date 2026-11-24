import type { Core, UID } from '@strapi/strapi';
import {
  GROUP_WIDE_TYPES,
  PUBLIC_CREATE_TYPES,
  SECTORS,
  SECTOR_OWNED_TYPES,
  isSector,
  type Sector,
} from '../constants/sectors';

/**
 * Tells a sector website to refresh its cached pages after content changes,
 * so only the affected site rebuilds — not all three.
 *
 * Each website exposes a route (e.g. POST /api/revalidate) that checks the
 * `x-revalidate-secret` header and calls Next.js `revalidateTag(model)`.
 * Sectors without a configured URL are skipped silently.
 */

/** With draft & publish, only these change what visitors see. */
const LIVE_ACTIONS_WITH_DRAFTS = new Set(['publish', 'unpublish', 'delete']);
const LIVE_ACTIONS_WITHOUT_DRAFTS = new Set(['create', 'update', 'delete']);

const revalidateUrl = (sector: Sector) => process.env[`REVALIDATE_URL_${sector.toUpperCase()}`];

async function notify(strapi: Core.Strapi, sector: Sector, payload: Record<string, unknown>) {
  const url = revalidateUrl(sector);
  const secret = process.env.REVALIDATE_SECRET;
  if (!url || !secret) return;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-revalidate-secret': secret },
      body: JSON.stringify({ sector, ...payload }),
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) strapi.log.warn(`[revalidate] ${sector} responded ${res.status}`);
  } catch (error) {
    strapi.log.warn(`[revalidate] ${sector} unreachable: ${(error as Error).message}`);
  }
}

/** Which sector websites display the given document. */
async function resolveSectors(
  strapi: Core.Strapi,
  uid: UID.ContentType,
  params: Record<string, any>,
): Promise<Sector[]> {
  if (GROUP_WIDE_TYPES.includes(uid)) return [...SECTORS];

  const owner = SECTOR_OWNED_TYPES[uid];
  if (owner) return [owner];

  if (isSector(params.data?.sector)) return [params.data.sector];

  if (params.documentId) {
    const doc: any = await strapi
      .documents(uid as any)
      .findOne({ documentId: params.documentId, fields: ['sector'] } as any);
    if (isSector(doc?.sector)) return [doc.sector];
  }
  return [];
}

export function registerRevalidation(strapi: Core.Strapi) {
  strapi.documents.use(async (context, next) => {
    const uid = context.uid as UID.ContentType;
    // Form submissions never change what visitors see.
    if (!uid.startsWith('api::') || PUBLIC_CREATE_TYPES.includes(uid)) return next();

    const hasDrafts = Boolean(strapi.contentType(uid)?.options?.draftAndPublish);
    const liveActions = hasDrafts ? LIVE_ACTIONS_WITH_DRAFTS : LIVE_ACTIONS_WITHOUT_DRAFTS;
    if (!liveActions.has(context.action)) return next();

    // Resolve before running the action: after a delete the sector is gone.
    const params = context.params as Record<string, any>;
    const sectors = await resolveSectors(strapi, uid, params);
    const result = await next();

    const payload = { model: uid.split('.').pop(), action: context.action, locale: params.locale ?? null };
    // Fire-and-forget: a slow website must never block an editor's save.
    sectors.forEach((sector) => void notify(strapi, sector, payload));

    return result;
  });
}
