import { describe, it, expect } from 'vitest';
import { isDangerous, dangerDescription } from '../src/safety.js';

const DANGEROUS = [22, 25, 80, 110, 143, 443, 3306, 5432, 5672, 6379, 9200, 27017];
const SAFE = [3000, 8080, 4200, 5000, 9000, 1337, 65535];

describe('isDangerous', () => {
  for (const port of DANGEROUS) {
    it(`port ${port} is dangerous`, () => {
      expect(isDangerous(port)).toBe(true);
    });
  }

  for (const port of SAFE) {
    it(`port ${port} is safe`, () => {
      expect(isDangerous(port)).toBe(false);
    });
  }
});

describe('dangerDescription', () => {
  it('returns description for SSH port 22', () => {
    expect(dangerDescription(22)).toBe('SSH');
  });

  it('returns description for HTTP port 80', () => {
    expect(dangerDescription(80)).toBe('HTTP');
  });

  it('returns description for PostgreSQL port 5432', () => {
    expect(dangerDescription(5432)).toBe('PostgreSQL');
  });

  it('returns undefined for a safe port', () => {
    expect(dangerDescription(3000)).toBeUndefined();
  });
});
