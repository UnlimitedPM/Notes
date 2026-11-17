import type { Claims } from './auth.js';

declare module 'fastify' {
  interface FastifyRequest {
    user?: Claims;
  }
}

export {};
