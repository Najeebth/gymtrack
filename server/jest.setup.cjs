// Runs before every test file. Pin the environment so tests never depend on a
// developer's local .env (dotenv does not override variables that are already set).
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'jest_test_secret';
process.env.CLIENT_URL = 'http://localhost:5173';
process.env.CF_ACCOUNT_ID = '';
process.env.CF_AI_TOKEN = '';
