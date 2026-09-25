import type { Express } from 'express';
import request from 'supertest';
import { createApp } from '../../src/app';
import { SEED, SEED_PASSWORD, type SeedUserKey } from './seedUsers';

let app: Express | undefined;

export function getApp(): Express {
  app ??= createApp();
  return app;
}

const tokenCache = new Map<SeedUserKey, string>();

export async function loginAs(who: SeedUserKey, options: { fresh?: boolean } = {}): Promise<string> {
  if (!options.fresh) {
    const cached = tokenCache.get(who);
    if (cached) return cached;
  }

  const response = await request(getApp())
    .post('/api/auth/login')
    .send({ email: SEED[who].email, password: SEED_PASSWORD });

  if (response.status !== 200) {
    throw new Error(
      `loginAs(${who}) expected 200, got ${response.status}: ${JSON.stringify(response.body)}`,
    );
  }

  const token = response.body.token as string;
  tokenCache.set(who, token);
  return token;
}

export function bearer(token: string): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}
