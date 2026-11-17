// Démarre l'app complète (PWA + API) pour les tests E2E, comme en production :
// build du front, build du back, puis un seul processus Fastify sur le port 4173.
import { execFileSync, spawn } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..', '..');
const frontend = join(root, 'frontend');
const backend = join(root, 'backend');
const isWindows = process.platform === 'win32';
const npm = isWindows ? 'npm.cmd' : 'npm';

function build(cwd, label) {
  console.log(`[e2e] build ${label}`);
  execFileSync(npm, ['run', 'build'], { cwd, stdio: 'inherit', shell: isWindows });
}

build(frontend, 'frontend');
build(backend, 'backend');

if (!existsSync(join(frontend, 'dist', 'index.html'))) {
  console.error('[e2e] frontend/dist/index.html manquant après le build');
  process.exit(1);
}

const dataDir = mkdtempSync(join(tmpdir(), 'notes-e2e-'));

const child = spawn(process.execPath, [join(backend, 'dist', 'index.js')], {
  env: {
    ...process.env,
    NODE_ENV: 'production',
    PORT: '4317',
    HOST: '127.0.0.1',
    DATA_DIR: dataDir,
    STATIC_DIR: join(frontend, 'dist'),
    OIDC_ISSUER: '',
    OIDC_CLIENT_ID: '',
    OIDC_AUDIENCE: ''
  },
  stdio: 'inherit'
});

function shutdown(code) {
  try {
    rmSync(dataDir, { recursive: true, force: true });
  } catch {
    /* dossier déjà supprimé */
  }
  process.exit(code);
}

child.on('exit', (code) => shutdown(code ?? 0));
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => child.kill(signal));
}
