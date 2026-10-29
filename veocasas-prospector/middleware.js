import { NextResponse } from 'next/server';

export function middleware(req) {
  const auth = req.headers.get('authorization') || '';
  if (auth.startsWith('Basic ')) {
    const [, pass] = atob(auth.slice(6)).split(':');
    if (pass && pass === process.env.DASHBOARD_PASSWORD) return NextResponse.next();
  }
  return new NextResponse('Ingresá la clave del panel', { status: 401, headers: { 'WWW-Authenticate': 'Basic realm="Veocasas"' } });
}

export const config = { matcher: ['/', '/api/leads/:path*', '/api/admin/:path*', '/api/export'] };
