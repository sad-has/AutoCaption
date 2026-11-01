import { createServer, build } from 'vite';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import electronPath from 'electron';
import * as dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Load environment variables
const envPaths = [
  path.resolve(rootDir, '.env.local'),
  path.resolve(rootDir, '.env'),
];
for (const p of envPaths) {
  if (fs.existsSync(p)) {
    dotenv.config({ path: p });
  }
}

async function runDev() {
  console.log('[Dev] Starting Vite renderer dev server...');
  const server = await createServer({
    configFile: path.resolve(rootDir, 'vite.config.ts'),
    server: { port: 5173 },
  });

  await server.listen();
  const devUrl = 'http://localhost:5173';
  console.log(`[Dev] Renderer dev server live at ${devUrl}`);

  console.log('[Dev] Compiling Main process and Preload script...');
  await build({
    configFile: path.resolve(rootDir, 'vite.main.config.ts'),
  });

  await build({
    configFile: path.resolve(rootDir, 'vite.preload.config.ts'),
  });
  console.log('[Dev] Main and Preload compiled successfully.');

  console.log('[Dev] Launching Electron window...');
  const electronProcess = spawn(String(electronPath), ['.'], {
    cwd: rootDir,
    stdio: 'inherit',
    env: {
      ...process.env,
      VITE_DEV_SERVER_URL: devUrl,
      NODE_ENV: 'development',
    },
  });

  electronProcess.on('close', async (code) => {
    console.log(`[Dev] Electron process exited with code ${code}. Shutting down dev server...`);
    await server.close();
    process.exit(code ?? 0);
  });

  process.on('SIGINT', async () => {
    electronProcess.kill('SIGINT');
    await server.close();
    process.exit(0);
  });
}

runDev().catch((err) => {
  console.error('[Dev] Fatal error launching dev environment:', err);
  process.exit(1);
});
