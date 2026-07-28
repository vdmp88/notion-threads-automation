import { describe, expect, it } from 'vitest';

import { parseEnv } from '../src/config/env.js';

describe('parseEnv', () => {
  it('uses safe development defaults', () => {
    expect(parseEnv({})).toEqual({
      NODE_ENV: 'development',
      LOG_LEVEL: 'info',
      HOST: '127.0.0.1',
      PORT: 3000,
      DRY_RUN: true,
    });
  });

  it('parses explicit values', () => {
    expect(
      parseEnv({
        NODE_ENV: 'production',
        LOG_LEVEL: 'warn',
        HOST: '0.0.0.0',
        PORT: '8080',
        DRY_RUN: 'false',
      }),
    ).toEqual({
      NODE_ENV: 'production',
      LOG_LEVEL: 'warn',
      HOST: '0.0.0.0',
      PORT: 8080,
      DRY_RUN: false,
    });
  });

  it('rejects an invalid port', () => {
    expect(() => parseEnv({ PORT: '70000' })).toThrow(/PORT/);
  });

  it('rejects an ambiguous dry-run value', () => {
    expect(() => parseEnv({ DRY_RUN: 'yes' })).toThrow(/DRY_RUN/);
  });
});
