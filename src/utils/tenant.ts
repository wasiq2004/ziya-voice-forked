import { getApiBaseUrl } from './api';

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

const getPlatformOriginFromApiBaseUrl = (): string | null => {
  const backendBaseUrl = getApiBaseUrl();
  if (!backendBaseUrl) return null;

  try {
    const parsedUrl = new URL(backendBaseUrl);
    const protocol = parsedUrl.protocol || 'https:';
    const hostname = parsedUrl.hostname.toLowerCase();

    if (hostname === 'localhost' || hostname === '127.0.0.1' || parsedUrl.port) {
      if (typeof window !== 'undefined' && window.location?.origin) {
        return window.location.origin;
      }
      return `${protocol}//${hostname}${parsedUrl.port ? `:${parsedUrl.port}` : ''}`;
    }

    const publicHostname = hostname.startsWith('api.') ? hostname.slice(4) : hostname;
    return `${protocol}//${publicHostname}`;
  } catch {
    return typeof window !== 'undefined' ? window.location.origin : null;
  }
};

export const getPlatformLoginHost = (): string | null => {
  const origin = getPlatformOriginFromApiBaseUrl();
  if (!origin) return null;

  try {
    return new URL(origin).hostname.toLowerCase();
  } catch {
    return null;
  }
};

export const getOrganizationSlugFromHostname = (hostname = window.location.hostname): string | null => {
  const normalizedHost = String(hostname || '').toLowerCase();
  const platformHost = getPlatformLoginHost();

  if (!normalizedHost || normalizedHost === 'localhost' || normalizedHost === '127.0.0.1') {
    return null;
  }

  if (normalizedHost.endsWith('.localhost')) {
    const candidate = normalizedHost.replace(/\.localhost$/, '');
    return normalizeOrganizationSlug(candidate) || null;
  }

  if (platformHost && (normalizedHost === platformHost || normalizedHost === `www.${platformHost}`)) {
    return null;
  }

  if (platformHost && normalizedHost.endsWith(`.${platformHost}`)) {
    const candidate = normalizedHost.slice(0, -(platformHost.length + 1));
    return normalizeOrganizationSlug(candidate) || null;
  }

  return null;
};

export const buildOrganizationLoginUrl = (slug: string): string => {
  const normalizedSlug = normalizeOrganizationSlug(slug);
  const platformOrigin = getPlatformOriginFromApiBaseUrl();
  const platformHost = getPlatformLoginHost();

  if (!platformOrigin || !platformHost) {
    return '/login';
  }

  if (!normalizedSlug || normalizedSlug === PLATFORM_ORG_SLUG) {
    return `${platformOrigin.replace(/\/$/, '')}/login`;
  }

  const parsedOrigin = new URL(platformOrigin);
  const port = parsedOrigin.port ? `:${parsedOrigin.port}` : '';
  return `${parsedOrigin.protocol}//${normalizedSlug}.${platformHost}${port}/login`;
};
