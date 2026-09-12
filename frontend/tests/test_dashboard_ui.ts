import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';
import {
  processDashboardData,
  formatExerciseName,
  formatDuration,
  formatDate,
  formatShortDate,
} from '../src/lib/use-dashboard-data';
import { WorkoutSessionItem, AIReportItem } from '../src/lib/api';

console.log('🧪 Starting Milestone 6B Dashboard UI & Data Test Suite...\n');

// 1. Test formatting helpers
console.log('Test 1: Data formatting helpers');
assert.strictEqual(formatExerciseName('squat'), 'Squat');
assert.strictEqual(formatExerciseName('bicep_curl'), 'Bicep Curl');
assert.strictEqual(formatExerciseName('shoulder_press'), 'Shoulder Press');

assert.strictEqual(formatDuration(0), '0 min');
assert.strictEqual(formatDuration(45), '45 sec');
assert.strictEqual(formatDuration(900), '15 min');
assert.strictEqual(formatDuration(4500), '1h 15m');

assert.strictEqual(formatDate(null), 'Recent');
assert.strictEqual(formatShortDate(null), '');
console.log('  ✅ PASS: Formatting helpers perform cleanly');

// 2. Test KPI calculations and data transformation with real mock data
console.log('\nTest 2: KPI & Dashboard Data Aggregation from sessions & reports');

const mockSessions: WorkoutSessionItem[] = [
  {
    id: 'sess-1',
    exercise: 'squat',
    started_at: '2026-09-10T10:00:00Z',
    ended_at: '2026-09-10T10:15:00Z',
    duration_seconds: 900,
    total_reps: 30,
    average_form_score: 85.0,
    status: 'completed',
  },
  {
    id: 'sess-2',
    exercise: 'pushup',
    started_at: '2026-09-11T14:00:00Z',
    ended_at: '2026-09-11T14:20:00Z',
    duration_seconds: 1200,
    total_reps: 50,
    average_form_score: 92.0,
    status: 'completed',
  },
  {
    id: 'sess-3',
    exercise: 'squat',
    started_at: '2026-09-12T09:00:00Z',
    ended_at: '2026-09-12T09:10:00Z',
    duration_seconds: 600,
    total_reps: 20,
    average_form_score: 88.0,
    status: 'completed',
  },
  {
    id: 'sess-4-incomplete',
    exercise: 'lunge',
    started_at: '2026-09-12T10:00:00Z',
    ended_at: null,
    duration_seconds: null,
    total_reps: 0,
    average_form_score: null,
    status: 'in_progress',
  },
];

const mockReports: AIReportItem[] = [
  {
    id: 'rep-1',
    session_id: 'sess-3',
    overall_score: 88.0,
    form_score: 88.0,
    strengths: ['Great squat depth', 'Stable core alignment'],
    mistakes: ['Slight knee cave on rep 15'],
    improvements: ['Maintain outward knee pressure'],
    coach_summary: 'Excellent session overall with strong stance consistency.',
    next_session_focus: 'Focus on knee tracking over toes during bottom phase.',
    motivation: 'Keep pushing your boundaries!',
    report_markdown: '# Report',
    model_name: 'llama-3.3-70b-versatile',
    created_at: '2026-09-12T09:11:00Z',
  },
];

const result = processDashboardData(mockSessions, mockReports);

assert.strictEqual(result.hasWorkouts, true);
assert.strictEqual(result.kpis.totalWorkouts, 3, 'Should only count completed sessions');
assert.strictEqual(result.kpis.totalReps, 100, 'Total reps should equal sum of completed reps (30+50+20)');
assert.strictEqual(result.kpis.avgFormScore, 88.3, 'Avg form score should equal (85+92+88)/3 = 88.3');
assert.strictEqual(result.kpis.totalDurationSeconds, 2700, 'Total duration should equal 900+1200+600');
assert.strictEqual(result.kpis.formattedDuration, '45 min');

// Verify recent workout is the latest completed session (sess-3)
assert.strictEqual(result.recentWorkout?.id, 'sess-3');
assert.strictEqual(result.recentWorkout?.exercise, 'squat');

// Verify trend points are sorted chronologically (oldest to newest: sess-1, sess-2, sess-3)
assert.strictEqual(result.trendPoints.length, 3);
assert.strictEqual(result.trendPoints[0].sessionId, 'sess-1');
assert.strictEqual(result.trendPoints[2].sessionId, 'sess-3');

// Verify exercise breakdown
assert.strictEqual(result.exerciseDistribution.length, 2);
assert.strictEqual(result.exerciseDistribution[0].exercise, 'squat');
assert.strictEqual(result.exerciseDistribution[0].count, 2);
assert.strictEqual(result.exerciseDistribution[0].percentage, 67); // Math.round(2/3 * 100)

// Verify AI report selection
assert.strictEqual(result.latestReport?.id, 'rep-1');
assert.strictEqual(result.latestReport?.coach_summary, 'Excellent session overall with strong stance consistency.');

console.log('  ✅ PASS: All KPI, session sorting, trend chronological ordering, and AI report binding logic passed');

// 3. Test Empty State handling (0 sessions, 0 reports)
console.log('\nTest 3: Empty State Handling (0 sessions, 0 reports)');
const emptyResult = processDashboardData([], []);

assert.strictEqual(emptyResult.hasWorkouts, false);
assert.strictEqual(emptyResult.kpis.totalWorkouts, 0);
assert.strictEqual(emptyResult.kpis.totalReps, 0);
assert.strictEqual(emptyResult.kpis.avgFormScore, null);
assert.strictEqual(emptyResult.kpis.formattedDuration, '0 min');
assert.strictEqual(emptyResult.recentWorkout, null);
assert.strictEqual(emptyResult.recentActivity.length, 0);
assert.strictEqual(emptyResult.trendPoints.length, 0);
assert.strictEqual(emptyResult.exerciseDistribution.length, 0);
assert.strictEqual(emptyResult.latestReport, null);
console.log('  ✅ PASS: Empty state handles zero records without throwing or generating fake stats');

// 4. Verify Dashboard Component Files exist
console.log('\nTest 4: Verify Dashboard Component Files');
const srcDir = path.resolve(__dirname, '../src');
const dashboardFiles = [
  'components/dashboard/dashboard-header.tsx',
  'components/dashboard/dashboard-stats.tsx',
  'components/dashboard/recent-workout.tsx',
  'components/dashboard/performance-chart.tsx',
  'components/dashboard/exercise-breakdown.tsx',
  'components/dashboard/recent-activity.tsx',
  'components/dashboard/coach-insight.tsx',
  'components/dashboard/dashboard-skeleton.tsx',
  'lib/use-dashboard-data.ts',
];

for (const file of dashboardFiles) {
  const filePath = path.join(srcDir, file);
  assert.ok(fs.existsSync(filePath), `Required dashboard file missing: ${file}`);
}
console.log('  ✅ PASS: All 9 required dashboard component and hook files exist');

console.log('\n==================================================');
console.log('🎉 All Milestone 6B Dashboard Tests PASSED Successfully!');
console.log('==================================================\n');
