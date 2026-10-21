import 'dotenv/config';
import mongoose from 'mongoose';
import { assertEnv, getEnv } from './config/env';
import { createApp } from './app';

async function main() {
  assertEnv(); // fail fast on missing secrets
  const env = getEnv();

  await mongoose.connect(env.mongoUri, { serverSelectionTimeoutMS: 10000 });
  console.log('MongoDB connected');

  const app = createApp();
  const server = app.listen(env.port, () => console.log(`API listening on port ${env.port}`));

  const shutdown = async () => {
    server.close();
    await mongoose.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  console.error('Startup failed:', (err as Error).message);
  process.exit(1);
});
