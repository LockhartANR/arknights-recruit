// E2E test server starter — sets env vars before loading the app.
// Must use dynamic import() because ESM static imports are hoisted
// and would run before the env var assignments below.
process.env.DB_PATH = ':memory:';
process.env.JWT_SECRET = 'e2e-test-secret-key';

const { default: _ignored } = await import('./index.js');
void _ignored;
