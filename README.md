# Artist Manager Dashboard

Personal dashboard for managing artist outreach, contracts, files, and expenses.

## Stack

- React + Vite + TypeScript
- Tailwind CSS + custom shadcn/ui components
- Supabase (Auth + Postgres)
- React Router v6
- Vercel (deployment)

## Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run the migration in `supabase/migrations/001_initial_schema.sql` in the Supabase SQL editor
3. Create your account in Supabase → Authentication → Users
4. Copy `.env.example` to `.env` and fill in your Supabase URL and anon key
5. `npm install && npm run dev`

## Modules

- **Overview** — stats, follow-ups due, recent activity
- **Outreach** — venue tracker with full status pipeline, contacts, notes, deal terms
- **Templates** — build reusable document templates with `{{variable}}` placeholders
- **Files** — generate `.txt` files from templates, save and download
- **Expenses** — log costs by category, link to venues, running total

## Deployment (Vercel)

Push to GitHub → import repo in Vercel → set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` environment variables → deploy.

`vercel.json` handles SPA routing automatically.
