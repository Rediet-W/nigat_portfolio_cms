import { factories } from '@strapi/strapi';
import { isSector } from '../../../constants/sectors';

/** Fields a website visitor may set. Everything else (status, notes) is staff-only. */
const PUBLIC_FIELDS = ['sector', 'fullName', 'email', 'phone', 'company', 'topic', 'message', 'locale'] as const;

export default factories.createCoreController('api::enquiry.enquiry', ({ strapi }) => ({
  async create(ctx) {
    const input = (ctx.request.body?.data ?? {}) as Record<string, unknown>;

    if (!isSector(input.sector)) {
      return ctx.badRequest('A valid "sector" is required.');
    }

    const data = Object.fromEntries(
      PUBLIC_FIELDS.filter((field) => input[field] !== undefined).map((field) => [field, input[field]]),
    );

    const entry = await strapi.documents('api::enquiry.enquiry').create({
      data: { ...data, status: 'new' } as any,
    });

    // Acknowledge only — never echo the stored record back to the public.
    ctx.status = 201;
    ctx.body = { data: { documentId: entry.documentId, createdAt: entry.createdAt } };
  },
}));
