import { NextResponse, type NextRequest } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';

// Server-side proxy for the admin API. Checks the NextAuth session, then calls
// Express with the shared ADMIN_API_KEY so the key never reaches the browser.
// (App routes take precedence over the /api/* rewrite in next.config.mjs.)

const SERVER_URL = (process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:3001').replace(/\/$/, '');

export const dynamic = 'force-dynamic';

function error(status: number, code: string, message: string) {
  return NextResponse.json(
    { status: 'error', data: null, errors: [{ code, message }], meta: { timestamp: new Date().toISOString() } },
    { status },
  );
}

export async function GET(req: NextRequest, { params }: { params: { path: string[] } }) {
  const session = await getServerSession(authOptions);
  if (session?.user?.role !== 'admin') return error(401, 'UNAUTHORIZED', 'Sign in as admin');

  const key = process.env.ADMIN_API_KEY;
  if (!key) return error(503, 'ADMIN_DISABLED', 'ADMIN_API_KEY is not set on the frontend');

  const path = params.path.map(encodeURIComponent).join('/');
  try {
    const res = await fetch(`${SERVER_URL}/api/admin/${path}${req.nextUrl.search}`, {
      headers: { 'x-admin-key': key },
      cache: 'no-store',
    });
    return new NextResponse(res.body, {
      status: res.status,
      headers: { 'content-type': res.headers.get('content-type') ?? 'application/json' },
    });
  } catch {
    return error(502, 'BACKEND_UNREACHABLE', 'Could not reach the game server');
  }
}
