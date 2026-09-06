# MyAI

Your AI. Your terms. A personal AI workspace with chats, custom assistants, models, and file attachments.

Live: https://myai-yasar9.vercel.app

## Vercel environment

Set these in the Vercel project (Production + Preview). Do not commit them.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Neon Postgres connection string |
| `BETTER_AUTH_SECRET` | Session signing secret (`openssl rand -hex 32`) |
| `BETTER_AUTH_URL` | `https://myai-yasar9.vercel.app` (also in `vercel.json`) |
| `XAI_API_KEY` | xAI API key for chat (or `EXPLABS_API_KEY`) |

Email and password work once the database and auth secret are set. Google and X need the Grok auth broker and are not wired on a personal Vercel project.
