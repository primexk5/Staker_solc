import { type NextRequest, NextResponse } from 'next/server';

// Server-side RPC proxy: reads the Alchemy URL at runtime (not build-time), so
// no NEXT_PUBLIC_ var is needed and the key never appears in the browser bundle.
// Set RPC_URL in Netlify's environment variables (Site config → Env vars).
const RPC_URL = process.env.RPC_URL ?? process.env.NEXT_PUBLIC_RPC_URL;

export async function POST(req: NextRequest) {
  if (!RPC_URL) {
    return NextResponse.json({ error: 'RPC_URL not configured' }, { status: 503 });
  }

  const body = await req.text();
  const upstream = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  const text = await upstream.text();
  return new NextResponse(text, {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json' },
  });
}
