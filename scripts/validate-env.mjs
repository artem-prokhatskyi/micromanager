const HEX_KEY_PATTERN = /^[0-9a-fA-F]{64}$/;

function requireEnv(key) {
  const value = process.env[key];

  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }

  return value;
}

function validateEncryptionKey(value) {
  if (!HEX_KEY_PATTERN.test(value)) {
    throw new Error('ENCRYPTION_KEY must be a 64-character hex string (32 bytes)');
  }
}

requireEnv('DATABASE_URL');
validateEncryptionKey(requireEnv('ENCRYPTION_KEY'));
requireEnv('POSTGRES_DB');
requireEnv('POSTGRES_PASSWORD');
requireEnv('POSTGRES_USER');