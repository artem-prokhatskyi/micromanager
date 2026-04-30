const HEX_KEY_PATTERN = /^[0-9a-fA-F]{64}$/;

function requireEnv(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function validateEncryptionKey(value: string): string {
  if (!HEX_KEY_PATTERN.test(value)) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }

  return value;
}

const databaseUrl = requireEnv('DATABASE_URL');
const encryptionKey = validateEncryptionKey(requireEnv('ENCRYPTION_KEY'));

export const config = {
  databaseUrl,
  encryptionKey,
  postgresDb: requireEnv('POSTGRES_DB'),
  postgresPassword: requireEnv('POSTGRES_PASSWORD'),
  postgresUser: requireEnv('POSTGRES_USER'),
} as const;