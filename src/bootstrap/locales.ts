import type { Core } from '@strapi/strapi';
import { LOCALES } from '../constants/sectors';

/** Makes sure every site language exists in the i18n plugin. Idempotent. */
export async function ensureLocales(strapi: Core.Strapi) {
  const localeService = strapi.plugin('i18n').service('locales');
  const existing: { code: string }[] = await localeService.find();
  const existingCodes = new Set(existing.map((locale) => locale.code));

  for (const locale of LOCALES) {
    if (existingCodes.has(locale.code)) continue;
    await localeService.create({ code: locale.code, name: locale.name, isDefault: false });
    strapi.log.info(`[bootstrap] Created locale "${locale.code}".`);
  }
}
