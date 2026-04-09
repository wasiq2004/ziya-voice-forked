export const PLATFORM_ORG_SLUG = 'ziya';

export interface TenantOrganization {
  id: number;
  name: string;
  slug: string;
  logo_url?: string | null;
  status?: string;
  is_platform_org?: boolean;
}

export const normalizeOrganizationSlug = (value: string | null | undefined): string => {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
};

const getBaseUrl = (): string => {
  if (typeof window === 'undefined') {
    return '';
  }
  return window.location.origin.replace(/\/$/, '');
};

export const getOrganizationSlugFromPath = (pathname = typeof window !== 'undefined' ? window.location.pathname : ''): string | null => {
  const segments = String(pathname || '')
    .split('/')
    .map(segment => segment.trim())
    .filter(Boolean);

  const firstSegment = segments[0] ? normalizeOrganizationSlug(segments[0]) : '';
  if (!firstSegment) {
    return null;
  }

  if (['login', 'signup', 'dashboard', 'superadmin', 'admin'].includes(firstSegment)) {
    return null;
  }

  return firstSegment;
};

export const getOrganizationLoginPath = (slug: string): string => {
  const normalizedSlug = normalizeOrganizationSlug(slug);
  if (!normalizedSlug || normalizedSlug === PLATFORM_ORG_SLUG) {
    return '/login';
  }
  return `/${normalizedSlug}/login`;
};

export const buildOrganizationLoginUrl = (slug: string): string => {
  const baseUrl = getBaseUrl();
  const loginPath = getOrganizationLoginPath(slug);
  return `${baseUrl}${loginPath}`;
};
