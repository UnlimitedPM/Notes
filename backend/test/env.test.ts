import { describe, expect, it } from 'vitest';
import { loadConfig } from '../src/env.js';

describe('loadConfig', () => {
  it('applique les valeurs par défaut sans OIDC', () => {
    const config = loadConfig({});

    expect(config.PORT).toBe(8080);
    expect(config.HOST).toBe('0.0.0.0');
    expect(config.DATA_DIR).toBe('./data');
    expect(config.MAX_UPLOAD_BYTES).toBe(25 * 1024 * 1024);
    expect(config.OIDC_ISSUER).toBeUndefined();
    expect(config.OIDC_CLIENT_ID).toBeUndefined();
  });

  it('accepte une configuration OIDC complète', () => {
    const config = loadConfig({
      OIDC_ISSUER: 'https://sso.example.com/realms/notes',
      OIDC_CLIENT_ID: 'notes-pwa'
    });

    expect(config.OIDC_ISSUER).toBe('https://sso.example.com/realms/notes');
    expect(config.OIDC_CLIENT_ID).toBe('notes-pwa');
  });

  it('refuse une configuration OIDC partielle', () => {
    expect(() => loadConfig({ OIDC_ISSUER: 'https://sso.example.com/realms/notes' })).toThrow(
      /OIDC_ISSUER et OIDC_CLIENT_ID/
    );
    expect(() => loadConfig({ OIDC_CLIENT_ID: 'notes-pwa' })).toThrow(
      /OIDC_ISSUER et OIDC_CLIENT_ID/
    );
  });

  it('traite les variables vides comme absentes (Compose)', () => {
    const config = loadConfig({ OIDC_ISSUER: '', OIDC_CLIENT_ID: '   ', OIDC_AUDIENCE: '' });

    expect(config.OIDC_ISSUER).toBeUndefined();
    expect(config.OIDC_CLIENT_ID).toBeUndefined();
    expect(config.OIDC_AUDIENCE).toBeUndefined();
  });

  it('refuse une URL OIDC invalide', () => {
    expect(() =>
      loadConfig({ OIDC_ISSUER: 'pas-une-url', OIDC_CLIENT_ID: 'notes-pwa' })
    ).toThrow(/OIDC_ISSUER/);
  });

  it('refuse une taille de téléversement non numérique', () => {
    expect(() => loadConfig({ MAX_UPLOAD_BYTES: 'beaucoup' })).toThrow(/MAX_UPLOAD_BYTES/);
  });
});
