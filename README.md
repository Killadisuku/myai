# MyAI

Your AI. Your terms. A personal AI workspace with chats, custom assistants, models, and file attachments.

Live: https://myai-yasar9.vercel.app

## Finish the Vercel setup

The site is deployed. Accounts, saved chats, and AI replies need three project env vars. Add them for **Production** and **Preview**, then Redeploy.

1. **Database** — [Storage](https://vercel.com/yasar9/myai/stores) → Create Database → **Neon** (free) → connect to `myai`. This sets `DATABASE_URL`.
2. **Auth secret** — [Environment Variables](https://vercel.com/yasar9/myai/settings/environment-variables) → add `BETTER_AUTH_SECRET`.
3. **AI key** — same page → add `XAI_API_KEY` from [console.x.ai](https://console.x.ai) (or `EXPLABS_API_KEY`).

`BETTER_AUTH_URL` is already set in `vercel.json` to `https://myai-yasar9.vercel.app`.

Email and password work after those three are set. Google and X stay on the Grok auth broker and are not wired on this personal Vercel project.
