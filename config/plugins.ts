import type { Core } from '@strapi/strapi';

const config = ({ env }: Core.Config.Shared.ConfigParams): Core.Config.Plugin => {
  const cloudinary = {
    cloud_name: env('CLOUDINARY_NAME'),
    api_key: env('CLOUDINARY_KEY'),
    api_secret: env('CLOUDINARY_SECRET'),
  };
  const hasCloudinary = Object.values(cloudinary).every(Boolean);
  const folder = env('CLOUDINARY_FOLDER', 'nigat-cms');

  return {
    // Without Cloudinary credentials, uploads fall back to ./public/uploads (fine for local dev).
    upload: hasCloudinary
      ? {
          config: {
            provider: 'cloudinary',
            providerOptions: cloudinary,
            actionOptions: {
              upload: { folder },
              uploadStream: { folder },
              delete: {},
            },
          },
        }
      : {},
  };
};

export default config;
