import { factories } from '@strapi/strapi';
import { isSector } from '../../../constants/sectors';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default factories.createCoreController('api::subscriber.subscriber', ({ strapi }) => ({
  /**
   * Public sign-up. Idempotent per sector + email: signing up twice (or again after
   * unsubscribing) never creates a duplicate and never reveals whether the email existed.
   */
  async create(ctx) {
    const input = (ctx.request.body?.data ?? {}) as Record<string, unknown>;
    const email = typeof input.email === 'string' ? input.email.trim().toLowerCase() : '';

    if (!isSector(input.sector)) return ctx.badRequest('A valid "sector" is required.');
    if (!EMAIL.test(email) || email.length > 254) return ctx.badRequest('A valid "email" is required.');

    const locale = typeof input.locale === 'string' ? input.locale.slice(0, 8) : undefined;
    const subscribers = strapi.documents('api::subscriber.subscriber');
    const existing = await subscribers.findFirst({ filters: { sector: input.sector, email } });

    if (existing) {
      await subscribers.update({ documentId: existing.documentId, data: { status: 'subscribed', locale } as any });
    } else {
      await subscribers.create({ data: { sector: input.sector, email, locale, status: 'subscribed' } as any });
    }

    ctx.status = 201;
    ctx.body = { data: { subscribed: true } };
  },
}));
