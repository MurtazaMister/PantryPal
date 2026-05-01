# PantryPal

**Demo Video:** [https://youtu.be/aCigceUEehA](https://youtu.be/aCigceUEehA)

PantryPal is a mobile app built to reduce food waste and daily meal decision fatigue by turning your groceries into a live pantry that stays accurate over time. Instead of making users manually track inventory after every meal, PantryPal connects shopping, pantry, recipe generation, and cooking logs into one practical loop: items you buy move into pantry, recipes are suggested from what you actually have, and after you cook, AI prepares an editable deduction draft so pantry quantities can be updated in seconds. The result is a kitchen assistant that is useful in real life, not just a recipe browser.

## What this app does

PantryPal closes the full kitchen loop in one app:

`Shopping list -> Mark bought -> Pantry updates -> Generate recipes -> Cook/log meal -> AI deduction draft -> Edit/confirm -> Pantry updates again`

This is not a generic recipe app. The core value is a self-updating pantry with practical meal decisions and food-waste reduction.

## Core product capabilities

- **Shopping list management:** add/edit/delete groceries, mark as bought, and move them into pantry.
- **Pantry editor:** add/edit/delete pantry items, search, expiry-aware display, and low-stock handling.
- **Cook tab with prompt + filters:** prompt-driven recommendations with meal/time/availability filters.
- **Recipe chat + finalize:** open a recipe chat session, refine recipe details, then finalize into a deduction draft.
- **Deduction review guardrails:** prefilled ingredient usage, editable rows, overuse validation against current pantry.
- **Reminders + recovery:** meal reminders, post-meal logging nudges, and undo for recent pantry updates.

## Architecture (concise)

- **Mobile:** Expo + React Native + TypeScript + Expo Router + Zustand
- **Backend:** Node.js + Express
- **Data/Auth:** Supabase
- **Personalization cache:** Redis
- **AI integration:** OpenAI via backend-only endpoints with strict JSON contracts

## Challenge scoring alignment

### Clarity
- Single-sentence value prop: live pantry + cook-now guidance + auto-updates after meals.
- Demo flow is linear and easy to understand in under 3 minutes.

### Usefulness
- Reduces food waste by prioritizing what is already in pantry.
- Reduces grocery duplication through suggestion reuse and bought-to-pantry flow.
- Reduces manual work with AI-prefilled deduction review before inventory changes.

### Creativity
- Creative core is AI-assisted pantry reconciliation, not only recipe generation.
- Natural language cooking logs convert into structured, editable pantry deductions.

### Execution
- End-to-end flow is implemented: shopping -> pantry -> recipe -> cooked -> deduction confirm -> updated pantry.
- Server-side AI integration keeps keys secure and responses normalized.

### Polish
- Mobile-first UX with empty/loading/error states.
- Guardrails on destructive actions and quantity validity checks.
- Reminder and undo touches for real-world daily use.

## Repository structure

- `mobile`: Expo mobile app (Android + iPhone)
- `backend`: Express API for AI orchestration and persistence helpers

## Environment setup

### Hosted backend (recommended for quick testing)

If you do not want to run backend locally, use:

`https://pantrypal-jfku.onrender.com`

### 1) Mobile env (`mobile/.env`)

```env
EXPO_PUBLIC_BACKEND_URL=https://pantrypal-jfku.onrender.com
EXPO_PUBLIC_USE_TUNNEL=false
EXPO_PUBLIC_BACKEND_URL_TUNNEL=https://<OPTIONAL_TUNNEL_URL>
EXPO_PUBLIC_SUPABASE_URL=https://<YOUR_SUPABASE_PROJECT>.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=<YOUR_SUPABASE_ANON_KEY>
```

### 2) Backend env (`backend/.env`)

```env
PORT=4000
OPENAI_API_KEY=<YOUR_OPENAI_API_KEY>
OPENAI_MODEL=gpt-4.1-mini
SUPABASE_URL=https://<YOUR_SUPABASE_PROJECT>.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<YOUR_SUPABASE_SERVICE_ROLE_KEY>
REDIS_URL=<YOUR_REDIS_URL>
```

## Run locally

### Start backend

```bash
cd backend
npm install
npm run start
```

### Start mobile

```bash
cd mobile
npm install
npx expo start --clear
```

## Run on real phones

### Android users (APK install)

1. Download the latest APK from GitHub Releases (see Links section below).
2. Transfer APK to Android phone.
3. Enable install from unknown apps for your browser/files app.
4. Install APK and open PantryPal.
5. Ensure backend is reachable from device network.

### iPhone users (Expo Go path)

1. Install **Expo Go** from App Store.
2. Clone this repo on your development machine.
3. Configure `mobile/.env` with hosted backend + Supabase values.
4. Run:
   ```bash
   cd mobile
   npm install
   npx expo start --clear
   ```
5. Scan the QR code from Expo CLI using Expo Go.
6. App opens on iPhone and uses your configured backend.

## Build Android APK (exact commands)

Run these commands from `mobile`:

```bash
npm install
npx eas login
npx eas build:configure
```

If `mobile/eas.json` does not exist, create it with:

```json
{
  "cli": { "version": ">= 10.0.0" },
  "build": {
    "preview": {
      "distribution": "internal",
      "android": { "buildType": "apk" }
    }
  }
}
```

Then build APK:

```bash
npx eas build -p android --profile preview --clear-cache
```

EAS will output a build URL. Download the `.apk` artifact from that link.

## Upload APK to GitHub for distribution

1. Go to your GitHub repo -> **Releases** -> **Draft a new release**.
2. Tag version (example: `v1.0.0`).
3. Title (example: `PantryPal v1.0.0`).
4. Drag/drop the built `.apk` into release assets.
5. Publish release.
6. Copy the public asset URL and share it for judging/install.

## Links for judges (copy-paste block)

- Demo video: [https://youtu.be/aCigceUEehA](https://youtu.be/aCigceUEehA)
- Repository: `<PASTE_GITHUB_REPO_LINK_HERE>`
- Backend health: `https://pantrypal-jfku.onrender.com/health`
- Android APK (GitHub Release asset): `<PASTE_APK_LINK_HERE>`
- iPhone run path: Expo Go instructions in this README
