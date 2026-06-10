export const BRAND_NAME = 'OmniShift';
export const BRAND_TAGLINE = 'Call center time tracking';

export function brandPageTitle(page?: string): string {
  return page ? `${page} | ${BRAND_NAME}` : BRAND_NAME;
}
