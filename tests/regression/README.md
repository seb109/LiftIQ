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
