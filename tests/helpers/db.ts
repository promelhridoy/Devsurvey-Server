import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ResearchResponse } from '../../src/models/ResearchResponse';

let server: MongoMemoryServer | undefined;

/** Start an isolated in-memory MongoDB. Refuses to continue if the URI is not local. */
export async function startTestDb(): Promise<void> {
  server = await MongoMemoryServer.create();
  const uri = server.getUri('survey_test');
  if (!/^mongodb:\/\/127\.0\.0\.1[:/]/.test(uri)) {
    throw new Error('Safety check failed: test database must be local');
  }
  await mongoose.connect(uri);
  await ResearchResponse.init(); // build indexes (unique submissionId)
}

export async function stopTestDb(): Promise<void> {
  await mongoose.disconnect();
  await server?.stop();
}

export async function clearDb(): Promise<void> {
  await ResearchResponse.deleteMany({});
}
