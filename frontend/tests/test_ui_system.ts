import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('🧪 Starting UI design-system guard tests...\n');

const root   = path.resolve(__dirname, '..');
const srcDir = path.join(root, 'src');

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/\.(tsx?|css)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** Source with comments removed, so rules apply to what ships, not to developer prose. */
function code(file: string): string {
  return fs
    .readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

const files = walk(srcDir);
const uiFiles = files.filter((f) => /\.(tsx)$/.test(f));
const rel = (f: string) => path.relative(srcDir, f).replace(/\\/g, '/');

// ── 1. Required pages and states exist ────────────────────────────────────────
console.log('Test 1: legal pages, 404 and error states exist');
for (const f of [
  'app/terms/page.tsx',
  'app/privacy/page.tsx',
  'app/not-found.tsx',
  'app/error.tsx',
  'app/global-error.tsx',
  'components/site-footer.tsx',
  'components/legal-document.tsx',
  'components/status-page.tsx',
  'components/ui/skeleton.tsx',
  'components/ui/state-panel.tsx',
]) {
  assert.ok(fs.existsSync(path.join(srcDir, f)), `Missing ${f}`);
}
console.log('  ✅ PASS: terms, privacy, not-found, error, global-error and shared state components exist');

// ── 2. Legal links reachable from the footer and the signup flow ──────────────
console.log('\nTest 2: Terms and Privacy are linked from the footer and the signup form');
const footer = fs.readFileSync(path.join(srcDir, 'components/site-footer.tsx'), 'utf8');
assert.ok(footer.includes('href="/terms"') && footer.includes('href="/privacy"'), 'Footer must link /terms and /privacy');
const register = fs.readFileSync(path.join(srcDir, 'app/register/page.tsx'), 'utf8');
assert.ok(register.includes('href="/terms"') && register.includes('href="/privacy"'), 'Register must link /terms and /privacy');
assert.ok(register.includes('id="accept-terms"') && register.includes('accept_terms: true'), 'Register must require and send terms acceptance');
const api = fs.readFileSync(path.join(srcDir, 'lib/api.ts'), 'utf8');
assert.ok(/accept_terms:\s*boolean/.test(api), 'RegisterRequest must carry accept_terms');
console.log('  ✅ PASS: footer and signup link both documents; acceptance is required and sent to the API');

// ── 3. No placeholder text in legal pages ─────────────────────────────────────
console.log('\nTest 3: legal pages contain no bracketed placeholders');
for (const f of ['app/terms/page.tsx', 'app/privacy/page.tsx']) {
  const text = code(path.join(srcDir, f));
  assert.ok(!/\[[A-Z][A-Za-z ]{3,}\]/.test(text), `${f} contains a bracketed placeholder`);
}
console.log('  ✅ PASS: operator details come from lib/legal.ts and are omitted, not faked, when unset');

// ── 4. No icon library, no default fonts ──────────────────────────────────────
console.log('\nTest 4: no lucide-react, no Inter/Geist/Space Grotesk');
const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
assert.ok(!('lucide-react' in (pkg.dependencies || {})), 'lucide-react must not be a dependency');
for (const f of uiFiles) {
  const text = code(f);
  assert.ok(!/lucide-react/.test(text), `${rel(f)} imports lucide-react`);
  assert.ok(!/\b(Geist|Geist_Mono|Inter|Space_Grotesk)\b/.test(text), `${rel(f)} uses a default font`);
}
console.log('  ✅ PASS: icons are the owned set; fonts are Archivo, Archivo Narrow and Newsreader');

// ── 5. Copy rules: no em dashes, no emoji in shipped UI source ────────────────
console.log('\nTest 5: no em dashes or emoji in UI source');
for (const f of uiFiles) {
  const text = code(f);
  assert.ok(!text.includes('—'), `${rel(f)} contains an em dash`);
  assert.ok(!/\p{Extended_Pictographic}/u.test(text), `${rel(f)} contains an emoji or pictograph`);
}
console.log('  ✅ PASS: none found');

// ── 6. Visual rules ───────────────────────────────────────────────────────────
console.log('\nTest 6: forbidden visual patterns are absent');
const banned: Array<[RegExp, string]> = [
  [/backdrop-blur/, 'backdrop blur'],
  [/gradient/i, 'gradient'],
  [/\bblur-(sm|md|lg|xl|2xl|3xl)\b/, 'blur orb'],
  [/\brounded-(md|lg|xl|2xl|3xl)\b/, 'ad hoc radius (use rounded-control, rounded-surface, rounded-media)'],
  [/\bshadow-(sm|md|lg|xl|2xl)\b/, 'default shadow (only shadow-overlay is allowed)'],
  [/(text|bg|border|ring|fill|stroke|divide|accent)-(zinc|slate|gray|neutral|stone|lime|red|rose|amber|yellow|emerald|green|sky|blue|violet|purple|orange|white|black)\b/, 'raw palette colour'],
  [/\[#[0-9A-Fa-f]{3,8}\]/, 'arbitrary hex colour'],
  [/animate-bounce/, 'bouncing animation'],
];
for (const f of uiFiles) {
  const text = code(f);
  for (const [re, label] of banned) {
    assert.ok(!re.test(text), `${rel(f)} uses ${label}`);
  }
}
console.log('  ✅ PASS: components use only semantic tokens, the radius system and the single overlay shadow');

// ── 7. Tokens ─────────────────────────────────────────────────────────────────
console.log('\nTest 7: design tokens are defined and the default palette is removed');
const css = fs.readFileSync(path.join(srcDir, 'app/globals.css'), 'utf8');
for (const token of ['--canvas', '--ink', '--brand', '--fail', '.stage', '--radius-control', '--shadow-overlay']) {
  assert.ok(css.includes(token), `globals.css missing ${token}`);
}
assert.ok(css.includes('--color-*: initial'), 'Default Tailwind palette must be cleared');
assert.ok(/prefers-reduced-motion/.test(css), 'Reduced-motion handling missing');
console.log('  ✅ PASS: tokens, stage surface, single elevation and reduced-motion handling present');

// ── 8. Async views have skeletons, not only spinners ──────────────────────────
console.log('\nTest 8: data views use skeleton loading states');
for (const f of [
  'components/dashboard/dashboard-skeleton.tsx',
  'app/history/page.tsx',
  'app/history/[sessionId]/page.tsx',
  'app/reports/[reportId]/page.tsx',
]) {
  const text = fs.readFileSync(path.join(srcDir, f), 'utf8');
  assert.ok(text.includes('LoadingRegion') && text.includes('Skeleton'), `${f} must render a skeleton`);
  assert.ok(!text.includes('<LoadingSpinner'), `${f} must not use a bare spinner for data loading`);
}
console.log('  ✅ PASS: dashboard, history, session detail and report use skeletons');

// ── 9. Workout test hooks survive the redesign ────────────────────────────────
console.log('\nTest 9: workout element ids used by automation are intact');
const ids = [
  'start-workout-btn', 'rep-count', 'coaching-text', 'connection-status', 'annotated-canvas', 'workout-video',
  'pause-workout-btn', 'end-workout-btn', 'confirm-end-workout', 'cancel-end-workout', 'new-workout-btn',
  'workout-complete-view',
];
const workoutSrc = files.filter((f) => rel(f).includes('workout')).map((f) => fs.readFileSync(f, 'utf8')).join('\n');
for (const id of ids) assert.ok(workoutSrc.includes(`id="${id}"`), `Missing id="${id}"`);
assert.ok(workoutSrc.includes('id={`exercise-${ex.id}`}'), 'Missing exercise option ids');
// Steppers build their ids as `${id}-increment` / `${id}-decrement`; the DOM ids are reps-increment etc.
assert.ok(workoutSrc.includes('id={`${id}-increment`}') && workoutSrc.includes('id={`${id}-decrement`}'), 'Missing stepper button ids');
assert.ok(workoutSrc.includes('id="reps"') && workoutSrc.includes('id="sets"'), 'Missing reps/sets stepper ids');
console.log('  ✅ PASS: all workout ids present');

// ── 10. Privacy page makes no claim the product cannot back up ────────────────
console.log('\nTest 10: privacy page states only what the application does');
const privacyText = code(path.join(srcDir, 'app/privacy/page.tsx')).replace(/\s+/g, ' ');
// Live coaching cues are shown on screen and never persisted; the page must say so, not claim otherwise.
assert.ok(!/form cues (raised|recorded|stored|saved)/i.test(privacyText), 'Privacy page must not say live form cues are collected');
assert.ok(/live coaching cues[^.]*are not saved/i.test(privacyText), 'Privacy page must say live coaching cues are not saved');
// There is no delete-account endpoint or purge job, so no fixed-retention or self-service deletion implication.
assert.ok(!/as long as your account exists/i.test(privacyText), 'Privacy page must not promise retention tied to the account');
assert.ok(!/(we|you can) (will )?(delete|erase|remove) (your|the) (data|account)/i.test(privacyText), 'Privacy page must not promise deletion');
assert.ok(/does not yet offer in-app account deletion/i.test(privacyText), 'Privacy page must say in-app deletion is not offered yet');
assert.ok(/do not currently delete data on a fixed schedule/i.test(privacyText), 'Privacy page must say there is no fixed retention schedule');
assert.ok(/does not yet have in-app tools/i.test(privacyText), 'Rights section must not imply self-service tools exist');
// The review notice comes from the shared document layout and must stay until counsel has reviewed the text.
const legalDoc = fs.readFileSync(path.join(srcDir, 'components/legal-document.tsx'), 'utf8');
assert.ok(legalDoc.includes('LEGAL.reviewedByCounsel') && legalDoc.includes('has not yet been reviewed by legal counsel'), 'Legal-review notice must remain');
const legalCfg = fs.readFileSync(path.join(srcDir, 'lib/legal.ts'), 'utf8');
assert.ok(/reviewedByCounsel:\s*false/.test(legalCfg), 'reviewedByCounsel must stay false until a lawyer has reviewed the documents');
console.log('  ✅ PASS: no cue-storage, retention or deletion claims; review notice intact');

console.log('\n==================================================');
console.log('🎉 All UI design-system guard tests PASSED!');
console.log('==================================================\n');
