import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const MAINTENANCE_BYPASS_COOKIE = 'homeland_maintenance_bypass';

export function proxy(request: NextRequest) {
  const correlationId = request.headers.get('x-correlation-id') || crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-correlation-id', correlationId);
  const url = request.nextUrl;
  const maintenanceMode = process.env.MAINTENANCE_MODE === 'true' || process.env.NEXT_PUBLIC_MAINTENANCE_MODE === 'true';
  const bypassKey = process.env.MAINTENANCE_BYPASS_KEY || '';
  const requestedBypassKey = url.searchParams.get('maintenance_bypass') || '';
  const cookieBypassKey = request.cookies.get(MAINTENANCE_BYPASS_COOKIE)?.value || '';
  const bypassAllowed = Boolean(bypassKey && (requestedBypassKey === bypassKey || cookieBypassKey === bypassKey));

  if (maintenanceMode && url.pathname !== '/maintenance' && !bypassAllowed) {
    const redirectUrl = url.clone();
    redirectUrl.pathname = '/maintenance';
    redirectUrl.search = '';
    const response = NextResponse.redirect(redirectUrl);
    response.headers.set('x-correlation-id', correlationId);
    return response;
  }

  const response = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  });

  if (maintenanceMode && bypassKey && requestedBypassKey === bypassKey) {
    response.cookies.set(MAINTENANCE_BYPASS_COOKIE, bypassKey, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
    });
  }

  response.headers.set('x-correlation-id', correlationId);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
