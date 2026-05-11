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
      return databaseUrl.toString();
    }
  } catch {
    return value;
  }

  return value;
}

const databaseUrl = resolvePrismaDatabaseUrl();

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    ...(databaseUrl ? { datasources: { db: { url: databaseUrl } } } : {}),
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}