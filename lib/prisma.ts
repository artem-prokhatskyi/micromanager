import { PrismaClient } from '@prisma/client';

interface GlobalForPrisma {
  prisma?: PrismaClient;
}

const globalForPrisma = globalThis as GlobalForPrisma;

function resolvePrismaDatabaseUrl(): string | undefined {
  const value = process.env.POSTGRES_URL;

  if (!value) {
    return value;
  }

  try {
    const databaseUrl = new URL(value);
    const isSupabaseTransactionPooler =
      databaseUrl.hostname.endsWith('.pooler.supabase.com') && databaseUrl.port === '6543';

    if (isSupabaseTransactionPooler && databaseUrl.searchParams.get('pgbouncer') !== 'true') {
      databaseUrl.searchParams.set('pgbouncer', 'true');
    }

    // Increase connection pool timeout (default 10s is too low for serverless)
    if (!databaseUrl.searchParams.has('pool_timeout')) {
      databaseUrl.searchParams.set('pool_timeout', '30');
    }
    // Reduce connection limit for serverless to avoid exhausting DB connections
    if (!databaseUrl.searchParams.has('connection_limit')) {
      databaseUrl.searchParams.set('connection_limit', '3');
    }

    return databaseUrl.toString();
  } catch {
    return value;
  }
}

const databaseUrl = resolvePrismaDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (!globalForPrisma.prisma) {
  globalForPrisma.prisma = prisma;
}