import type { Core } from '@strapi/strapi';
import { ensureLocales } from './bootstrap/locales';
import { ensurePublicPermissions } from './bootstrap/permissions';
import { registerRevalidation } from './lib/revalidate';

export default {
  /** Runs before the app initializes — document middlewares are registered here. */
  register({ strapi }: { strapi: Core.Strapi }) {
    registerRevalidation(strapi);
  },

  /** Runs before the server starts — idempotent setup only. */
  async bootstrap({ strapi }: { strapi: Core.Strapi }) {
    await ensureLocales(strapi);
    await ensurePublicPermissions(strapi);
  },
};
