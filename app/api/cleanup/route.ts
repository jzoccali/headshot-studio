import { del } from '@vercel/blob';
import { NextResponse } from 'next/server';

// Deletes the user's source photos from Blob storage.
// Called when the user clears their sources or starts a new session, so we honor
// the "source photos are deleted after generation" privacy promise WITHOUT deleting
// them mid-session (which used to break every variation after the first one).
export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const urls: string[] = Array.isArray(body?.urls)
      ? body.urls.filter((u: unknown): u is string => typeof u === 'string' && u.startsWith('http'))
      : [];

    if (urls.length === 0) {
      return NextResponse.json({ deleted: 0 });
    }

    try {
      await del(urls);
    } catch (e) {
      // Best-effort: a missing/already-deleted blob shouldn't surface as an error to the user.
      console.warn('Cleanup: some references could not be deleted:', e);
    }

    return NextResponse.json({ deleted: urls.length });
  } catch (error: any) {
    console.error('Cleanup error:', error);
    return NextResponse.json({ error: error?.message || 'Cleanup failed' }, { status: 500 });
  }
}
