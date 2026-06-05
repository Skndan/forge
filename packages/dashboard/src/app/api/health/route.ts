// ── Health API Route ──

import { NextResponse } from 'next/server';

export async function GET() {
  // Basic health check - container/process level
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
}
