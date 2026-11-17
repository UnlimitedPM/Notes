import { z } from 'zod';

/** Docker Compose transmet `""` quand une variable optionnelle n'est pas définie. */
const blankAsUndefined = (value: unknown) =>
  typeof value === 'string' && value.trim() === '' ? undefined : value;

const Schema = z
  .object({
    PORT: z.coerce.number().int().positive().default(8080),
    HOST: z.string().default('0.0.0.0'),
    DATA_DIR: z.string().default('./data'),
    // OIDC facultatif : sans issuer/client, l'API de synchro reste fermée.
    OIDC_ISSUER: z.preprocess(blankAsUndefined, z.string().url().optional()),
    OIDC_CLIENT_ID: z.preprocess(blankAsUndefined, z.string().min(1).optional()),
    OIDC_AUDIENCE: z.preprocess(blankAsUndefined, z.string().min(1).optional()),
    CORS_ORIGIN: z.preprocess(blankAsUndefined, z.string().optional()),
    /** Dossier de la PWA compilée (vide = API seule). */
    STATIC_DIR: z.preprocess(blankAsUndefined, z.string().optional()),
    MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(25 * 1024 * 1024)
  })
  .refine((config) => (config.OIDC_ISSUER === undefined) === (config.OIDC_CLIENT_ID === undefined), {
    message: 'OIDC_ISSUER et OIDC_CLIENT_ID se définissent ensemble',
    path: ['OIDC_ISSUER']
  });

export type Config = z.infer<typeof Schema>;

export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
  const parsed = Schema.safeParse(source);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuration invalide :\n${details}`);
  }
  return parsed.data;
}
