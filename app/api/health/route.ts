import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db/prisma';

type HealthStatus = 'ok' | 'error';
type DatabaseStatus = 'ok' | 'error';

async function checkDatabase(): Promise<DatabaseStatus> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return 'ok';
  } catch (error) {
    console.error('[health] Database check failed:', error);
    return 'error';
  }
}

export async function GET() {
  const database = await checkDatabase();
  const status: HealthStatus = database === 'ok' ? 'ok' : 'error';
  const httpStatus = status === 'ok' ? 200 : 503;

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      database,
    },
    { status: httpStatus }
  );
}
