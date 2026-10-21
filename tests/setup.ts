import bcrypt from 'bcryptjs';

// Runs before every test file. Nothing here ever points at a real database:
// MONGODB_URI is intentionally empty, and DB tests connect only to an in-memory server.
process.env.NODE_ENV = 'test';
process.env.MONGODB_URI = '';
process.env.JWT_SECRET = 'test-secret-' + 'x'.repeat(40);
process.env.JWT_EXPIRES_IN = '1h';
process.env.ADMIN_USERNAME = 'test-admin';
process.env.ADMIN_PASSWORD_HASH = bcrypt.hashSync('correct-horse-battery', 4);
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.COOKIE_SAMESITE = 'lax';
process.env.TRUST_PROXY = '0';
// High limits so normal tests never trip them; rate-limit tests lower them explicitly.
process.env.SUBMIT_RATE_LIMIT_MAX = '1000';
process.env.LOGIN_RATE_LIMIT_MAX = '1000';
