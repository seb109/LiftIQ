'use client';

import React from 'react';
import { Button } from '@/components/ui/button';
import { InlineAlert } from '@/components/ui/state-panel';
import { EXERCISE_ICONS } from '@/components/ui/icons';

const EXERCISES = [
  { id: 'squat',          label: 'Squat',          description: 'Depth, knee position and torso lean' },
  { id: 'pushup',         label: 'Push-up',        description: 'Elbow angle, body line and depth' },
  { id: 'bicep_curl',     label: 'Bicep curl',     description: 'Range of motion and elbow drift' },
  { id: 'shoulder_press', label: 'Shoulder press', description: 'Lockout, bar path and lean' },
  { id: 'lunge',          label: 'Lunge',          description: 'Knee tracking, depth and balance' },
  { id: 'deadlift',       label: 'Deadlift',       description: 'Back angle, hip hinge and lockout' },
] as const;

type ExerciseId = typeof EXERCISES[number]['id'];

interface WorkoutSetupProps {
  onStart: (exercise: string, targetReps: number, targetSets: number) => void;
  isLoading: boolean;
  error: string | null;
}

function Stepper({
  id,
  label,
  value,
  min,
  max,
  onChange,
}: {
  id: string;
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (next: number) => void;
}) {
  const stepButton =
    'flex h-11 w-11 items-center justify-center text-xl text-ink-2 transition-colors hover:bg-sunken hover:text-ink active:bg-rule disabled:cursor-not-allowed disabled:text-ink-2/40 disabled:hover:bg-transparent';
  return (
    <div>
      <p id={`${id}-label`} className="text-sm font-medium">{label}</p>
      <div
        role="group"
        aria-labelledby={`${id}-label`}
        className="mt-1.5 inline-flex items-stretch divide-x divide-rule-strong rounded-control border border-rule-strong bg-surface"
      >
        <button
          id={`${id}-decrement`}
          type="button"
          aria-label={`Decrease ${label.toLowerCase()}`}
          disabled={value <= min}
          onClick={() => onChange(Math.max(min, value - 1))}
          className={stepButton}
        >
          &minus;
        </button>
        <output aria-live="polite" className="flex h-11 w-16 items-center justify-center font-display text-2xl tabular-nums">
          {value}
        </output>
        <button
          id={`${id}-increment`}
          type="button"
          aria-label={`Increase ${label.toLowerCase()}`}
          disabled={value >= max}
          onClick={() => onChange(Math.min(max, value + 1))}
          className={stepButton}
        >
          +
        </button>
      </div>
    </div>
  );
}

export function WorkoutSetup({ onStart, isLoading, error }: WorkoutSetupProps) {
  const [selectedExercise, setSelectedExercise] = React.useState<ExerciseId>('squat');
  const [targetReps, setTargetReps] = React.useState(10);
  const [targetSets, setTargetSets] = React.useState(3);

  return (
    <div className="mx-auto max-w-2xl space-y-10 pb-10">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Start a workout</h1>
        <p className="mt-1 text-ink-2">Choose an exercise and your targets. Your camera turns on when you start.</p>
      </div>

      {error && <InlineAlert title="Could not start the workout">{error}</InlineAlert>}

      <fieldset>
        <legend className="text-sm font-medium">Exercise</legend>
        <div
          role="radiogroup"
          aria-label="Exercise"
          className="mt-2 grid grid-cols-1 gap-px border border-rule bg-rule sm:grid-cols-2"
        >
          {EXERCISES.map((ex) => {
            const selected = selectedExercise === ex.id;
            const Pictogram = EXERCISE_ICONS[ex.id];
            return (
              <button
                key={ex.id}
                id={`exercise-${ex.id}`}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setSelectedExercise(ex.id)}
                className={`flex items-center gap-4 p-4 text-left transition-colors ${
                  selected ? 'bg-brand-tint' : 'bg-canvas hover:bg-sunken'
                }`}
              >
                <Pictogram className={`size-9 shrink-0 ${selected ? 'text-brand' : 'text-ink-2'}`} />
                <span className="min-w-0">
                  <span className="block font-medium">{ex.label}</span>
                  <span className="block text-sm text-ink-2">{ex.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-wrap gap-x-10 gap-y-6">
        <Stepper id="reps" label="Target reps" value={targetReps} min={1} max={100} onChange={setTargetReps} />
        <Stepper id="sets" label="Target sets" value={targetSets} min={1} max={20} onChange={setTargetSets} />
      </div>

      <div className="border-t border-rule pt-6 text-sm text-ink-2">
        <p>
          Place your camera side-on, about two metres away, with your whole body in frame. Your browser will ask for
          camera permission. Video is analysed on our server to find your pose and is not recorded or stored.
        </p>
      </div>

      <Button
        id="start-workout-btn"
        size="lg"
        isLoading={isLoading}
        onClick={() => onStart(selectedExercise, targetReps, targetSets)}
        className="w-full sm:w-auto sm:min-w-56"
      >
        {isLoading ? 'Starting' : 'Start workout'}
      </Button>
    </div>
  );
}
