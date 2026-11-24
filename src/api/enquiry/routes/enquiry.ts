import { factories } from '@strapi/strapi';

/**
 * Enquiries are write-only over the REST API: the sector websites submit them,
 * while reading and managing them happens in the admin panel only.
 */
export default factories.createCoreRouter('api::enquiry.enquiry', {
  only: ['create'],
});
