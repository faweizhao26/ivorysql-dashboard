export function withSessionNotice(fetcher: typeof fetch, onExpired: () => void, origin: string): typeof fetch {
  return async (input, init) => {
    const response = await fetcher(input, init);
    const url = new URL(input instanceof Request ? input.url : String(input), origin);
    if (url.origin === origin && url.pathname.startsWith('/api/')
      && !url.pathname.startsWith('/api/auth/') && response.status === 401) {
      const payload = await response.clone().json().catch(() => null);
      if (payload?.code === 'AUTH_REQUIRED') onExpired();
    }
    return response;
  };
}

export function safeReturnPath(value: string | null): string {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\r\n]/.test(value)) return '/';
  const url = new URL(value, 'https://dashboard.invalid');
  if (url.origin !== 'https://dashboard.invalid' || url.pathname.startsWith('/auth')) return '/';
  return url.pathname + url.search + url.hash;
}
