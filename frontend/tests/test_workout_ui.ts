import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

console.log('🧪 Starting Milestone 6C Workout Experience Test Suite...\n');

const srcDir  = path.resolve(__dirname, '../src');
const libDir  = path.resolve(srcDir, 'lib');
const appDir  = path.resolve(srcDir, 'app');
const compDir = path.resolve(srcDir, 'components');

// ── 1. Supported exercises list ────────────────────────────────────────────────
console.log('Test 1: SUPPORTED_EXERCISES matches backend canonical identifiers');
const EXPECTED_EXERCISES = ['squat', 'pushup', 'bicep_curl', 'shoulder_press', 'lunge', 'deadlift'];
const setupSrc = fs.readFileSync(path.join(compDir, 'workout/workout-setup.tsx'), 'utf8');
for (const ex of EXPECTED_EXERCISES) {
  assert.ok(setupSrc.includes(`'${ex}'`) || setupSrc.includes(`"${ex}"`), `Missing exercise id: ${ex}`);
}
console.log('  ✅ PASS: All 6 canonical exercise IDs present in WorkoutSetup');

// ── 2. Workout component files exist ─────────────────────────────────────────
console.log('\nTest 2: Workout component files exist');
const workoutFiles = [
  'components/workout/workout-setup.tsx',
  'components/workout/live-workout-view.tsx',
  'components/workout/stats-panel.tsx',
  'components/workout/coaching-bar.tsx',
  'components/workout/connection-status.tsx',
  'components/workout/end-workout-dialog.tsx',
  'components/workout/workout-complete-view.tsx',
  'components/workout/camera-permission-error.tsx',
];
for (const file of workoutFiles) {
  const p = path.join(srcDir, file);
  assert.ok(fs.existsSync(p), `Missing component file: ${file}`);
}
console.log('  ✅ PASS: All 8 workout component files exist');

// ── 3. Workout page route exists ───────────────────────────────────────────────
console.log('\nTest 3: Workout page route exists at app/workout/page.tsx');
const workoutPagePath = path.join(appDir, 'workout/page.tsx');
assert.ok(fs.existsSync(workoutPagePath), 'Missing app/workout/page.tsx');
const workoutPageSrc = fs.readFileSync(workoutPagePath, 'utf8');
assert.ok(workoutPageSrc.includes('ProtectedRoute'), 'Workout page must use ProtectedRoute');
console.log('  ✅ PASS: Workout page route exists and uses ProtectedRoute');

// ── 4. API functions exist in api.ts ──────────────────────────────────────────
console.log('\nTest 4: API functions startWorkoutSession, stopWorkoutSession, getWorkoutStats exist');
const apiSrc = fs.readFileSync(path.join(libDir, 'api.ts'), 'utf8');
assert.ok(apiSrc.includes('export const startWorkoutSession'), 'Missing startWorkoutSession export');
assert.ok(apiSrc.includes('export const stopWorkoutSession'), 'Missing stopWorkoutSession export');
assert.ok(apiSrc.includes('export const getWorkoutStats'), 'Missing getWorkoutStats export');
console.log('  ✅ PASS: All 3 workout API functions exported from api.ts');

// ── 5. WorkoutStats interface shape ──────────────────────────────────────────
console.log('\nTest 5: WorkoutStats interface contains required fields');
assert.ok(apiSrc.includes('counter:'), 'Missing counter field in WorkoutStats');
assert.ok(apiSrc.includes('form_violations:'), 'Missing form_violations field in WorkoutStats');
assert.ok(apiSrc.includes('form_score:'), 'Missing form_score field in WorkoutStats');
assert.ok(apiSrc.includes('current_set:'), 'Missing current_set field in WorkoutStats');
assert.ok(apiSrc.includes('is_resting:'), 'Missing is_resting field in WorkoutStats');
console.log('  ✅ PASS: WorkoutStats interface has all required fields');

// ── 6. useWorkoutSession hook exists and exports correct API ──────────────────
console.log('\nTest 6: useWorkoutSession hook exists and exports correct lifecycle functions');
const hookPath = path.join(libDir, 'use-workout-session.ts');
assert.ok(fs.existsSync(hookPath), 'Missing use-workout-session.ts');
const hookSrc = fs.readFileSync(hookPath, 'utf8');
assert.ok(hookSrc.includes('export function useWorkoutSession'), 'Missing useWorkoutSession export');
assert.ok(hookSrc.includes('startSession'), 'Missing startSession in hook');
assert.ok(hookSrc.includes('endSession'), 'Missing endSession in hook');
assert.ok(hookSrc.includes('togglePause'), 'Missing togglePause in hook');
// New API: exposes stream not videoRef
assert.ok(hookSrc.includes('stream'), 'Missing stream in hook return');
assert.ok(hookSrc.includes('cameraErrorReason'), 'Missing cameraErrorReason in hook return');
console.log('  ✅ PASS: useWorkoutSession hook exports startSession, endSession, togglePause, stream, cameraErrorReason');

// ── 7. Stats poll interval constant ──────────────────────────────────────────
console.log('\nTest 7: STATS_POLL_INTERVAL_MS constant is defined and reasonable');
assert.ok(hookSrc.includes('STATS_POLL_INTERVAL_MS'), 'Missing STATS_POLL_INTERVAL_MS');
const match = hookSrc.match(/STATS_POLL_INTERVAL_MS\s*=\s*(\d+)/);
assert.ok(match, 'Cannot parse STATS_POLL_INTERVAL_MS value');
const interval = parseInt(match![1], 10);
assert.ok(interval >= 500 && interval <= 2000, `STATS_POLL_INTERVAL_MS=${interval} is outside 500–2000ms range`);
console.log(`  ✅ PASS: STATS_POLL_INTERVAL_MS=${interval}ms`);

// ── 8. Frame quality constant ────────────────────────────────────────────────
console.log('\nTest 8: FRAME_JPEG_QUALITY constant is defined and within valid range');
assert.ok(hookSrc.includes('FRAME_JPEG_QUALITY'), 'Missing FRAME_JPEG_QUALITY');
const qMatch = hookSrc.match(/FRAME_JPEG_QUALITY\s*=\s*([\d.]+)/);
assert.ok(qMatch, 'Cannot parse FRAME_JPEG_QUALITY value');
const quality = parseFloat(qMatch![1]);
assert.ok(quality > 0 && quality <= 1, `FRAME_JPEG_QUALITY=${quality} must be between 0 and 1`);
console.log(`  ✅ PASS: FRAME_JPEG_QUALITY=${quality}`);

// ── 9. Camera cleanup on unmount ─────────────────────────────────────────────
console.log('\nTest 9: Camera tracks cleanup registered on component unmount');
assert.ok(hookSrc.includes('stopCamera'), 'Missing stopCamera call in cleanup');
assert.ok(hookSrc.includes("getTracks().forEach"), 'Missing getTracks cleanup in stopCamera');
console.log('  ✅ PASS: Camera stream cleanup is present');

// ── 10. Rate-limited frame sending (not unbounded RAF) ─────────────────────────
console.log('\nTest 10: Frame sending is rate-limited (not a runaway requestAnimationFrame loop)');
assert.ok(hookSrc.includes('FRAME_INTERVAL_MS'), 'Missing FRAME_INTERVAL_MS rate limit constant');
assert.ok(hookSrc.includes('setTimeout'), 'Frame loop must use setTimeout for rate limiting');
const rateMatch = hookSrc.match(/FRAME_INTERVAL_MS\s*=\s*(\d+)/);
assert.ok(rateMatch, 'Cannot parse FRAME_INTERVAL_MS value');
const frameInterval = parseInt(rateMatch![1], 10);
assert.ok(frameInterval >= 50, `FRAME_INTERVAL_MS=${frameInterval} is too fast (minimum 50ms / 20fps)`);
console.log(`  ✅ PASS: Frame interval=${frameInterval}ms — rate-limited, not a runaway RAF`);

// ── 11. Camera error classification ──────────────────────────────────────────
console.log('\nTest 11: Camera errors are classified by DOMException.name (not a generic catch-all)');
const cameraErrors = ['NotAllowedError', 'NotFoundError', 'NotReadableError', 'OverconstrainedError', 'SecurityError'];
for (const errName of cameraErrors) {
  assert.ok(hookSrc.includes(errName), `Missing camera error case: ${errName}`);
}
console.log('  ✅ PASS: All 5 DOMException camera error types are handled');

// ── 12. Video element has autoPlay, muted, playsInline ────────────────────────
console.log('\nTest 12: <video> element has autoPlay, muted, playsInline (required for camera preview)');
const liveViewSrc = fs.readFileSync(path.join(compDir, 'workout/live-workout-view.tsx'), 'utf8');
assert.ok(liveViewSrc.includes('autoPlay'), 'Missing autoPlay on <video>');
assert.ok(liveViewSrc.includes('muted'),    'Missing muted on <video>');
assert.ok(liveViewSrc.includes('playsInline'), 'Missing playsInline on <video>');
// Video must NOT be hidden — it's the preview
assert.ok(!liveViewSrc.includes('className="hidden"'), '<video> must not be hidden — it is the camera preview');
console.log('  ✅ PASS: <video> has autoPlay + muted + playsInline and is not hidden');

// ── 13. Stream attached via useEffect in LiveWorkoutView ──────────────────────
console.log('\nTest 13: Stream is attached to <video> via useEffect in LiveWorkoutView (not in hook)');
assert.ok(liveViewSrc.includes('srcObject = stream'), 'Missing srcObject assignment in LiveWorkoutView');
assert.ok(liveViewSrc.includes('useEffect'), 'Missing useEffect for stream attachment');
console.log('  ✅ PASS: Stream attached to <video> via useEffect after component mounts');

// ── 14. WorkoutCompleteView uses real backend fields ──────────────────────────
console.log('\nTest 14: WorkoutCompleteView displays real backend StopSessionResponse fields');
const completeSrc = fs.readFileSync(path.join(compDir, 'workout/workout-complete-view.tsx'), 'utf8');
assert.ok(completeSrc.includes('data.total_reps'), 'Missing total_reps display');
assert.ok(completeSrc.includes('data.duration_seconds'), 'Missing duration_seconds display');
assert.ok(completeSrc.includes('data.average_form_score'), 'Missing average_form_score display');
console.log('  ✅ PASS: Completion screen uses real backend fields');

// ── 15. Dashboard Start Workout navigates to /workout ─────────────────────────
console.log('\nTest 15: Dashboard Start Workout button navigates to /workout route');
const dashPageSrc = fs.readFileSync(path.join(appDir, 'page.tsx'), 'utf8');
assert.ok(dashPageSrc.includes("router.push('/workout')"), "Dashboard must call router.push('/workout')");
assert.ok(!dashPageSrc.includes('alert('), 'Dashboard must not use alert() placeholder');
console.log("  ✅ PASS: Dashboard routes to '/workout'");

console.log('\n==================================================');
console.log('🎉 All Milestone 6C Workout Experience Tests PASSED!');
console.log('==================================================\n');
