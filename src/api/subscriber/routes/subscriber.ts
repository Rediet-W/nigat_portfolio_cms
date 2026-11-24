import { factories } from '@strapi/strapi';

/** Write-only over the REST API, like enquiries: staff view and export the list in the admin panel. */
export default factories.createCoreRouter('api::subscriber.subscriber', {
  only: ['create'],
});
