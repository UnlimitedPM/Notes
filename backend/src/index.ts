import { buildApp } from './app.js';
import { makeOidcVerifier } from './auth.js';
import { openDb } from './db.js';
import { loadConfig } from './env.js';

async function main(): Promise<void> {
  const config = loadConfig();
  const db = openDb(config.DATA_DIR);

  const app = buildApp({
    db,
    dataDir: config.DATA_DIR,
    maxUpload: config.MAX_UPLOAD_BYTES,
    corsOrigin: config.CORS_ORIGIN,
    logger: true,
    verify: makeOidcVerifier({
      issuer: config.OIDC_ISSUER,
      clientId: config.OIDC_CLIENT_ID,
      audience: config.OIDC_AUDIENCE
    })
  });

  const shutdown = async (signal: string) => {
    app.log.info(`${signal} reçu : arrêt propre`);
    await app.close();
    db.close();
    process.exit(0);
  };
  process.on('SIGINT', () => void shutdown('SIGINT'));
  process.on('SIGTERM', () => void shutdown('SIGTERM'));

  await app.listen({ port: config.PORT, host: config.HOST });
  app.log.info(`Notes server prêt sur http://${config.HOST}:${config.PORT}`);
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
