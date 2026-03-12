# Times Table Sprint

A lightweight browser app for grade 2 times-table practice.

## Run locally

Because this app stores leaderboard scores in `localStorage`, run it from a local web server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` on your phone or desktop browser.

## Gameplay

- Choose a table from 2 to 12.
- Choose **Single** mode (just that table) or **Mixed** mode (2 up to your selected table).
- Hit start and wait for the dramatic 3-2-1 countdown.
- Answer as many questions as possible in 60 seconds.
  - Correct: score +1, positive sound, next question.
  - Wrong: score -1, negative sound, same question repeats.
- Top 5 scores are stored separately for each mode + table setting.
