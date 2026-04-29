# PantryPal

PantryPal is a mobile-first Expo app plus a custom Node backend for AI recipe ranking, meal deduction estimation, guest-to-account flow, and Redis-backed user memory.

## Workspace

- `mobile`: Expo Router app for iPhone and Android
- `backend`: Express API with memory refresh and AI endpoints

## Mobile highlights

- guest onboarding with `Demo Pantry` and `Start Fresh`
- dashboard with pantry health, top recipes, and undo
- shopping list -> bought -> pantry flow
- pantry inventory with expiry and low-stock states
- cook screen with filters, prompt box, and tailored rankings
- recipe detail and editable deduction review
- manual meal logging
- local breakfast/lunch/dinner reminders plus follow-up logging prompts

## Backend highlights

- `POST /auth/guest`
- `POST /auth/merge-guest`
- `POST /ai/recipe-query`
- `POST /ai/deduction-estimate`
- `POST /memory/refresh`
- Redis-backed memory profile store with in-memory fallback

## Commands

```bash
cd mobile
npm run start
```

```bash
cd backend
npm run start
```

## Environment

- Mobile env: copy `mobile/.env.example` to `mobile/.env` and fill values.
- Backend env: copy `backend/.env.example` to `backend/.env` and fill values.
- Supabase tables: run `backend/supabase.sql` in Supabase SQL editor.
