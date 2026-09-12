'use client';

import React from 'react';

const EXERCISES = [
  { id: 'squat',          label: 'Squat',          icon: '🏋️', description: 'Quad, glute & core drive' },
  { id: 'pushup',         label: 'Push-up',         icon: '💪', description: 'Chest, triceps & shoulder' },
  { id: 'bicep_curl',     label: 'Bicep Curl',      icon: '🦾', description: 'Bicep isolation & control' },
  { id: 'shoulder_press', label: 'Shoulder Press',  icon: '🤸', description: 'Deltoid overhead strength' },
  { id: 'lunge',          label: 'Lunge',            icon: '🚶', description: 'Unilateral leg & balance' },
  { id: 'deadlift',       label: 'Deadlift',         icon: '⚡', description: 'Posterior chain power' },
] as const;

type ExerciseId = typeof EXERCISES[number]['id'];

interface WorkoutSetupProps {
  onStart: (exercise: string, targetReps: number, targetSets: number) => void;
  isLoading: boolean;
  error: string | null;
}

export function WorkoutSetup({ onStart, isLoading, error }: WorkoutSetupProps) {
  const [selectedExercise, setSelectedExercise] = React.useState<ExerciseId>('squat');
  const [targetReps, setTargetReps] = React.useState(10);
  const [targetSets, setTargetSets] = React.useState(3);

  const handleStart = () => {
    onStart(selectedExercise, targetReps, targetSets);
  };

  return (
    <div className="min-h-screen bg-[#09090B] flex flex-col items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <p className="text-lime-400 text-sm font-semibold tracking-widest uppercase">Live Workout</p>
          <h1 className="text-3xl sm:text-4xl font-bold text-white">Set Up Your Session</h1>
          <p className="text-slate-400 text-sm">
            Real-time AI form coaching powered by MediaPipe.{' '}
            <span className="text-slate-300">Camera access is required.</span>
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-950/50 border border-red-800/60 rounded-xl p-4 text-sm text-red-300 flex items-start gap-3">
            <span className="text-red-400 mt-0.5 shrink-0">⚠</span>
            <span>{error}</span>
          </div>
        )}

        {/* Exercise grid */}
        <div>
          <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">
            Select Exercise
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {EXERCISES.map((ex) => (
              <button
                key={ex.id}
                id={`exercise-${ex.id}`}
                onClick={() => setSelectedExercise(ex.id)}
                className={[
                  'rounded-xl border p-4 text-left transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-lime-500/50',
                  selectedExercise === ex.id
                    ? 'border-lime-500/60 bg-lime-950/40 shadow-[0_0_16px_rgba(132,204,22,0.08)]'
                    : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-600 hover:bg-zinc-900',
                ].join(' ')}
              >
                <span className="text-2xl">{ex.icon}</span>
                <p className={`mt-2 text-sm font-semibold ${selectedExercise === ex.id ? 'text-lime-300' : 'text-slate-200'}`}>
                  {ex.label}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">{ex.description}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Config row */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
              Target Reps
            </label>
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
              <button
                id="reps-decrement"
                onClick={() => setTargetReps((v) => Math.max(1, v - 1))}
                className="text-slate-400 hover:text-white w-6 text-lg font-bold transition-colors"
              >−</button>
              <span className="flex-1 text-center text-white font-bold text-lg tabular-nums">{targetReps}</span>
              <button
                id="reps-increment"
                onClick={() => setTargetReps((v) => Math.min(100, v + 1))}
                className="text-slate-400 hover:text-white w-6 text-lg font-bold transition-colors"
              >+</button>
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-400 uppercase tracking-widest mb-2">
              Target Sets
            </label>
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 rounded-xl px-4 py-3">
              <button
                id="sets-decrement"
                onClick={() => setTargetSets((v) => Math.max(1, v - 1))}
                className="text-slate-400 hover:text-white w-6 text-lg font-bold transition-colors"
              >−</button>
              <span className="flex-1 text-center text-white font-bold text-lg tabular-nums">{targetSets}</span>
              <button
                id="sets-increment"
                onClick={() => setTargetSets((v) => Math.min(20, v + 1))}
                className="text-slate-400 hover:text-white w-6 text-lg font-bold transition-colors"
              >+</button>
            </div>
          </div>
        </div>

        {/* Camera notice */}
        <div className="flex items-start gap-3 bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4 text-sm text-slate-400">
          <span className="text-lg mt-0.5">📷</span>
          <p>
            Your camera will be used for real-time pose detection.{' '}
            <span className="text-slate-300">Video is never recorded or stored.</span>{' '}
            A camera permission prompt will appear when you click Start.
          </p>
        </div>

        {/* CTA */}
        <button
          id="start-workout-btn"
          onClick={handleStart}
          disabled={isLoading}
          className="w-full py-4 rounded-xl bg-lime-500 hover:bg-lime-400 disabled:bg-lime-900 disabled:text-lime-600 text-zinc-950 font-bold text-base transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-lime-400/60 flex items-center justify-center gap-2"
        >
          {isLoading ? (
            <>
              <span className="w-4 h-4 border-2 border-zinc-950/30 border-t-zinc-950 rounded-full animate-spin" />
              Starting…
            </>
          ) : (
            'Start Workout'
          )}
        </button>
      </div>
    </div>
  );
}
