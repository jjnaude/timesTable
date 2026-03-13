# Times Table Sprint

A lightweight browser app for grade 2 times-table practice.

## Run locally

Because this app stores leaderboard scores in `localStorage`, run it from a local web server:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` on your phone or desktop browser.


## Install as an Android app (PWA)

This project is now configured as a Progressive Web App:

- Installable on Android (Chrome menu → **Install app**)
- Works offline after the first successful load
- Includes app icons and standalone app display mode

If you deploy on HTTPS (for example GitHub Pages), Android users can install it to their home screen and run it like a native app.

## Host on GitHub Pages

This repository now includes a GitHub Actions workflow at `.github/workflows/deploy-pages.yml` that auto-deploys the site to GitHub Pages when you push to `main` or `master`.

### 1) Push this repo to GitHub

```bash
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin <your-default-branch>
```

### 2) Enable Pages in repository settings

1. Open your GitHub repo.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Source: GitHub Actions**.

### 3) Trigger deployment

- Push to `main`/`master`, or
- Open **Actions** tab and run **Deploy static site to GitHub Pages** manually.

### 4) Open your hosted app

Your app will be available at:

`https://<your-username>.github.io/<your-repo>/`

> Note: Leaderboards use browser `localStorage`, so scores are saved per device/browser profile.

## Gameplay

- Choose a table from 2 to 12.
- Switch between **English** and **Afrikaans** using the language picker.
- Edit all language strings in `translations.js` (`en` and `af` locales).
- Choose **Single** mode (just that table) or **Mixed** mode (2 up to your selected table).
- Hit start and wait for the dramatic 3-2-1 countdown.
- Answer as many questions as possible in 60 seconds.
  - Correct: score +1, positive sound, next question.
  - Wrong: score -1, negative sound, same question repeats.
- Top 5 scores are stored separately for each mode + table setting.


## Vehicle transform tuning

Vehicle sprite alignment and orientation are configured in `assets/vehicles/transforms.json` (keyed by variant id).

- `scale`: overall sprite scale.
- `translateX`: horizontal nudge in pixels.
- `translateY`: vertical nudge in pixels (positive is downward).
- `flipX`: set `true` for source art that faces left so it is mirrored to face right.
- `garageScale` (optional): override icon scale in the garage grid; garage icons stay centered and do not apply stage translation offsets.

To tune values, run the app locally, open the garage, and cycle all unlocked variants. Confirm each vehicle preview and stage sprite faces right and that wheels visually sit on the foreground grass baseline.
