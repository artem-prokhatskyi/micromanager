import { spawn } from 'node:child_process';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

function loadEnvFiles() {
  for (const envFile of ['.env', '.env.local']) {
    try {
      process.loadEnvFile?.(envFile);
    } catch (error) {
      if (!(error instanceof Error) || !('code' in error) || error.code !== 'ENOENT') {
        throw error;
      }
    }
  }
}

function resolveDatabaseUrl() {
  const override = process.env.LOCAL_DATABASE_URL;

  if (override) {
    return override;
  }

  const currentValue = process.env.POSTGRES_URL;

  if (!currentValue) {
    return currentValue;
  }

  try {
    const databaseUrl = new URL(currentValue);

    if (databaseUrl.hostname === 'db') {
      databaseUrl.hostname = 'localhost';
      return databaseUrl.toString();
    }
  } catch {
    return currentValue;
  }

  return currentValue;
}

loadEnvFiles();

const nextBinPath = fileURLToPath(new URL('../node_modules/next/dist/bin/next', import.meta.url));
const databaseUrl = resolveDatabaseUrl();
const child = spawn(process.execPath, [nextBinPath, 'dev'], {
  stdio: 'inherit',
  env: {
    ...process.env,
    ...(databaseUrl ? { POSTGRES_URL: databaseUrl } : {}),
  },
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code ?? 0);
});