import { NextRequest, NextResponse } from 'next/server';

// Known exploit and scanning patterns
const BLOCKED_PATH_PATTERNS = [
  /\/\.env/i,
  /\/\.git/i,
  /\/wp-admin/i,
  /\/wp-login/i,
  /\/xmlrpc\.php/i,
  /\/phpinfo/i,
  /\/actuator/i,
  /\0/, // Null byte injection
  /\.\.\//, // Directory traversal
];

// Allowed HTTP methods for this application
const ALLOWED_METHODS = new Set(['GET', 'POST', 'HEAD', 'OPTIONS']);

// Check if an origin is trusted for CORS and CSRF
function isTrustedOrigin(origin: string, host: string): boolean {
  try {
    const originUrl = new URL(origin);
    if (originUrl.host === host) return true;
    if (originUrl.hostname === 'localhost' || originUrl.hostname === '127.0.0.1') return true;
    if (originUrl.hostname === 'raasintaal.in' || originUrl.hostname.endsWith('.raasintaal.in')) return true;

    // Additional allowed origins from environment (e.g. custom hosting domains)
    const extraAllowed = (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return extraAllowed.includes(origin) || extraAllowed.includes(originUrl.origin);
  } catch {
    return false;
  }
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl;
  const method = req.method;
  const host = req.headers.get('host') || '';
  const origin = req.headers.get('origin');

  // 1. HTTP Verb Tampering Defense
  if (!ALLOWED_METHODS.has(method)) {
    return new NextResponse('Method Not Allowed', { status: 405 });
  }

  // 2. Exploit Probe & Path Traversal Defense
  const pathname = decodeURIComponent(url.pathname);
  for (const pattern of BLOCKED_PATH_PATTERNS) {
    if (pattern.test(pathname)) {
      return new NextResponse('Bad Request', { status: 400 });
    }
  }

  // 3. Subdomain Routing: Map staff.* to /staff and admin.* to /admin
  if (host.startsWith('staff.') && pathname === '/') {
    const staffUrl = req.nextUrl.clone();
    staffUrl.pathname = '/staff';
    return NextResponse.rewrite(staffUrl);
  }
  if (host.startsWith('admin.') && pathname === '/') {
    const adminUrl = req.nextUrl.clone();
    adminUrl.pathname = '/admin';
    return NextResponse.rewrite(adminUrl);
  }

  // 4. CORS Preflight Handling (OPTIONS)
  if (method === 'OPTIONS') {
    if (origin && isTrustedOrigin(origin, host)) {
      return new NextResponse(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Allow-Methods': 'GET, POST, OPTIONS, HEAD',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-staff-token, x-staff-pin, x-admin-key',
          'Access-Control-Max-Age': '86400',
        },
      });
    }
    return new NextResponse(null, { status: 204 });
  }

  // 5. CSRF Protection on API Mutations
  if (method === 'POST' && pathname.startsWith('/api/') && !pathname.startsWith('/api/webhooks/')) {
    if (origin && host) {
      if (!isTrustedOrigin(origin, host)) {
        return NextResponse.json(
          { error: 'Cross-site request forgery protection: Origin mismatch blocked.' },
          { status: 403 }
        );
      }
    }
  }

  // 6. Request Body Size Limit Defense (Reject payloads > 512KB to protect against memory exhaustion)
  if (method === 'POST' && pathname.startsWith('/api/')) {
    const contentLength = req.headers.get('content-length');
    if (contentLength) {
      const bytes = parseInt(contentLength, 10);
      if (isNaN(bytes) || bytes > 512 * 1024) {
        return NextResponse.json(
          { error: 'Payload Too Large: Maximum allowed API payload is 512KB.' },
          { status: 413 }
        );
      }
    }
  }

  // 7. Pass through with Edge Security and CORS Headers
  const res = NextResponse.next();
  res.headers.set('X-DNS-Prefetch-Control', 'off');
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
  res.headers.set('X-Permitted-Cross-Domain-Policies', 'none');

  if (origin && isTrustedOrigin(origin, host)) {
    res.headers.set('Access-Control-Allow-Origin', origin);
    res.headers.set('Access-Control-Allow-Credentials', 'true');
    res.headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, HEAD');
    res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-staff-token, x-staff-pin, x-admin-key');
  }

  return res;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except static files, _next, favicon.ico, images
     */
    '/((?!_next/static|_next/image|assets/|favicon.ico).*)',
  ],
};
