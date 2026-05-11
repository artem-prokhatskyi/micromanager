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

export const config = {
  get databaseUrl(): string {
    return requireEnv('POSTGRES_URL');
  },
  get encryptionKey(): string {
    return validateEncryptionKey(requireEnv('ENCRYPTION_KEY'));
  },
  get postgresDb(): string {
    return requireEnv('POSTGRES_DATABASE');
  },
  get postgresPassword(): string {
    return requireEnv('POSTGRES_PASSWORD');
  },
  get postgresUser(): string {
    return requireEnv('POSTGRES_USER');
  },
} as const;