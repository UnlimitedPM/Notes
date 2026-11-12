import { createRemoteJWKSet, jwtVerify, type JWTPayload } from 'jose';

export type Claims = {
  sub: string;
  name?: string;
  email?: string;
};

/** Vérifie l'en-tête `Authorization` et renvoie l'identité, ou lève une erreur (→ 401). */
export type AuthVerify = (authorization: string | undefined) => Promise<Claims>;

export type OidcConfig = {
  issuer: string;
  clientId: string;
  audience?: string;
};

function keycloakJwksUrl(issuer: string): URL {
  return new URL(`${issuer.replace(/\/+$/, '')}/protocol/openid-connect/certs`);
}

/**
 * Vérificateur OIDC adossé à Keycloak : signature RS256 via JWKS (mis en cache et
 * rafraîchi automatiquement), `iss` vérifié, puis `aud` si configuré, sinon `azp`
 * doit correspondre au client id (comportement Keycloak pour un client public).
 */
export function makeOidcVerifier(config: OidcConfig): AuthVerify {
  const jwks = createRemoteJWKSet(keycloakJwksUrl(config.issuer));

  return async (authorization: string | undefined): Promise<Claims> => {
    if (!authorization || !authorization.startsWith('Bearer ')) {
      throw new Error('jeton manquant');
    }
    const token = authorization.slice('Bearer '.length).trim();
    if (!token) throw new Error('jeton vide');

    const { payload } = await jwtVerify(token, jwks, {
      issuer: config.issuer,
      ...(config.audience ? { audience: config.audience } : {})
    });

    if (!payload.sub) throw new Error('jeton sans sujet (sub)');

    if (!config.audience) {
      const azp = (payload as JWTPayload & { azp?: string }).azp;
      if (azp !== config.clientId) throw new Error('jeton émis pour un autre client');
    }

    return {
      sub: payload.sub,
      name: typeof payload.name === 'string' ? payload.name : undefined,
      email: typeof payload.email === 'string' ? payload.email : undefined
    };
  };
}
