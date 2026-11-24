import type { UID } from '@strapi/strapi';

export const SECTORS = ['construction', 'motors', 'exports'] as const;

export type Sector = (typeof SECTORS)[number];

export const isSector = (value: unknown): value is Sector =>
  typeof value === 'string' && (SECTORS as readonly string[]).includes(value);

/** Content types that belong to a single sector, so they carry no `sector` field. */
export const SECTOR_OWNED_TYPES: Partial<Record<UID.ContentType, Sector>> = {
  'api::vehicle-category.vehicle-category': 'motors',
  'api::product-category.product-category': 'exports',
  'api::project.project': 'construction',
};

/** Content types shown on every sector website. */
export const GROUP_WIDE_TYPES: UID.ContentType[] = ['api::group-profile.group-profile'];

/** Content types the websites may read anonymously (find + findOne). */
export const PUBLIC_READ_TYPES: UID.ContentType[] = [
  'api::group-profile.group-profile',
  'api::site-setting.site-setting',
  'api::home-page.home-page',
  'api::about-page.about-page',
  'api::service.service',
  'api::faq-group.faq-group',
  'api::gallery-item.gallery-item',
  'api::testimonial.testimonial',
  'api::team-member.team-member',
  'api::blog-post.blog-post',
  'api::vehicle-category.vehicle-category',
  'api::product-category.product-category',
  'api::project.project',
];

/** Content types the websites may create anonymously. */
export const PUBLIC_CREATE_TYPES: UID.ContentType[] = ['api::enquiry.enquiry', 'api::subscriber.subscriber'];

/** Languages every sector publishes in. English is Strapi's default locale. */
export const LOCALES = [
  { code: 'en', name: 'English (en)' },
  { code: 'am', name: 'Amharic (am)' },
] as const;
