# Computer-vision regression baselines

`baselines.json` captures the current behavior of `gym_trainer.py` for the
canonical local videos listed in `tools/regression_baseline.py`. It records
the detected repetition count, average per-rep form score, correction events,
and source-video duration.

The videos remain local and ignored by Git. To verify the current engine
against the committed baseline, install `requirements-regression.txt` in a
local environment and run:

```powershell
python tools/regression_baseline.py --verify
```

To intentionally refresh a baseline after a reviewed behavior change:

```powershell
python tools/regression_baseline.py --write
```

Do not refresh baselines as part of a structural refactor. Any changed metric
must be reviewed as a possible behavior regression first.

Shoulder press has no local source video at the time this baseline was
created. The manifest records that absence explicitly; add a representative
video before claiming complete six-exercise regression coverage.

## Baseline change log

**Milestone 7.6 (rep-counting reliability fix):** primary rep-counting angle
now picks one consistent left/right side for all 3 landmarks (matching how
form checks already worked), and stage transitions require 2 consecutive
confirmed frames past a threshold instead of 1. Two values changed as a
result of this reviewed fix, not a silent re-baseline:

- `pushup` `corrections.event_count`: 176 → 172 (message breakdown shifted
  proportionally). Cause: form-check computation is gated on the primary
  landmarks' visibility; the stricter single-side selection occasionally
  yields marginally lower visibility for one joint on a handful of ambiguous
  frames (~4 of 501), skipping those frames entirely rather than computing
  form checks against a geometrically inconsistent (mixed-side) angle. `reps`
  (6) and `form_score` (83.33) are unchanged.
- `deadlift` `reps`: 2 → 1. Direct comparison of the old and new landmark
  selection on this clip showed the old code mixing left/right landmarks
  into a single angle calculation, producing errors up to ~40° in the region
  around the disputed second rep. Separately, the old state machine could
  transition directly from `None` to `"down"` (via its fallback branch)
  without ever confirming a starting "up"/lockout position — this video
  opens mid-descent, so the old engine's first counted rep was built from an
  unknown, unconfirmed starting depth. The new state machine only leaves
  `None` via a confirmed "up" position, so it doesn't count that phantom
  first rep. The remaining, well-formed cycle in the clip is unaffected
  (same rep, same 80.0 form score). This was not independently verified
  against the source video's true rep count — recommend a visual spot check
  of `vids/deadlift/deadlift1.mp4` if that assurance is needed.
