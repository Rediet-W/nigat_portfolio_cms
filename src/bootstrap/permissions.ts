import type { Core } from '@strapi/strapi';
import { PUBLIC_CREATE_TYPES, PUBLIC_READ_TYPES } from '../constants/sectors';

/**
 * Grants the Public role exactly what the websites need — read content,
 * submit enquiries — and nothing else. Idempotent: safe on every boot.
 */
export async function ensurePublicPermissions(strapi: Core.Strapi) {
  const role = await strapi.db.query('plugin::users-permissions.role').findOne({ where: { type: 'public' } });
  if (!role) {
    strapi.log.warn('[bootstrap] Public role not found; skipping API permissions.');
    return;
  }

  const actions = [
    ...PUBLIC_READ_TYPES.flatMap((uid) => [`${uid}.find`, `${uid}.findOne`]),
    ...PUBLIC_CREATE_TYPES.map((uid) => `${uid}.create`),
  ];

  for (const action of actions) {
    const exists = await strapi.db
      .query('plugin::users-permissions.permission')
      .findOne({ where: { action, role: role.id } });
    if (!exists) {
      await strapi.db.query('plugin::users-permissions.permission').create({ data: { action, role: role.id } });
    }
  }
}
