import dotenv from 'dotenv';
import path from 'path';

// Load env configuration
dotenv.config({ path: path.resolve('.env'), quiet: true });

export const ENV = {
  url: process.env.URL || 'https://qecore.github.io',
  testUser: process.env.TEST_USER || 'default',
  testPassword: process.env.TEST_PASSWORD || 'secret',
} as const;


// It's always best to prefer typesafe variables for .env
export const env = ENV

