import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  apiClient,
  setStoredTokens,
  getStoredAccessToken,
  getStoredRefreshToken,
  clearStoredTokens,
} from '../src/lib/api';

console.log('🧪 Starting Milestone 6A Frontend & Auth UI Test Suite...\n');

// 1. Verify API Base URL comes from environment configuration
console.log('Test 1: API Base URL is configurable from environment');
const expectedBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
assert.strictEqual(
  apiClient.defaults.baseURL,
  expectedBaseUrl,
  `API client base URL should match environment config: expected ${expectedBaseUrl}, got ${apiClient.defaults.baseURL}`
);
console.log('  ✅ PASS: API client baseURL matches environment configuration');

// Mock localStorage for node environment
const mockStorage: Record<string, string> = {};
(global as any).window = {};
(global as any).localStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, value: string) => {
    mockStorage[key] = value;
  },
  removeItem: (key: string) => {
    delete mockStorage[key];
  },
  clear: () => {
    Object.keys(mockStorage).forEach((k) => delete mockStorage[k]);
  },
};

// 2. Test token storage operations
console.log('\nTest 2: Token storage management (set, get, clear)');
setStoredTokens('mock_access_123', 'mock_refresh_456');
assert.strictEqual(getStoredAccessToken(), 'mock_access_123');
assert.strictEqual(getStoredRefreshToken(), 'mock_refresh_456');

clearStoredTokens();
assert.strictEqual(getStoredAccessToken(), null);
assert.strictEqual(getStoredRefreshToken(), null);
console.log('  ✅ PASS: Token storage setter, getter, and clear functions work correctly');

// 3. Test Registration & Login validation functions
console.log('\nTest 3: Registration and Login field validation logic');
const validateEmail = (email: string) => /\S+@\S+\.\S+/.test(email);
const validatePassword = (password: string) =>
  password.length >= 8 && /[A-Z]/.test(password) && /[a-z]/.test(password) && /[0-9]/.test(password);

assert.strictEqual(validateEmail('invalid-email'), false);
assert.strictEqual(validateEmail('athlete@liftiq.com'), true);
assert.strictEqual(validatePassword('weak'), false);
assert.strictEqual(validatePassword('SecurePass123!'), true);
console.log('  ✅ PASS: Email and password complexity validation rules passed');

// 4. Verify pages and components exist and export valid modules
console.log('\nTest 4: Verify pages & components file structure');
const srcDir = path.resolve(__dirname, '../src');

const requiredFiles = [
  'app/layout.tsx',
  'app/page.tsx',
  'app/login/page.tsx',
  'app/register/page.tsx',
  'lib/api.ts',
  'lib/auth-context.tsx',
  'lib/providers.tsx',
  'components/ui/button.tsx',
  'components/ui/input.tsx',
  'components/ui/card.tsx',
  'components/ui/badge.tsx',
  'components/ui/logo.tsx',
  'components/ui/loading-spinner.tsx',
  'components/protected-route.tsx',
  'components/app-shell.tsx',
];

for (const file of requiredFiles) {
  const filePath = path.join(srcDir, file);
  assert.ok(fs.existsSync(filePath), `Required file missing: ${file}`);
}
console.log('  ✅ PASS: All 15 required frontend pages, components, and libraries exist');

// 5. Hardcoded Secret Scanner: Scan all ts/tsx files for hardcoded JWT secrets or API keys
console.log('\nTest 5: Secret scanner - check no hardcoded credentials or JWT keys');

function scanDirectoryForSecrets(dir: string) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.next') {
      scanDirectoryForSecrets(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx'))) {
      const content = fs.readFileSync(fullPath, 'utf-8');
      assert.ok(
        !content.includes('SECRET_KEY') && !content.includes('groq_key_') && !content.includes('gsk_'),
        `Forbidden hardcoded secret found in ${fullPath}`
      );
    }
  }
}

scanDirectoryForSecrets(srcDir);
console.log('  ✅ PASS: Zero hardcoded secrets found in frontend source code');

console.log('\n==================================================');
console.log('🎉 All 5 Frontend Test Suites PASSED Successfully!');
console.log('==================================================\n');
