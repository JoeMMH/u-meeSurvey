# u‑mee Survey Report — standalone "Ask the Survey"

This is a self-hosted version of the u‑mee customer survey report. Unlike the
claude.ai-published version, colleagues can open this **and use the AI search
feature without a Claude account** — access is controlled by a single shared
password you set yourself, not by individual logins.

## What's in this folder

- `index.html` — the full report page (charts, tables, Ask the Survey UI).
  This is a copy of the claude.ai artifact with one change: the AI feature
  calls `/api/ask` instead of Claude's built-in assistant capability.
- `api/ask.js` — a small serverless function that holds your Anthropic API
  key, checks the shared password, applies a light rate limit, and forwards
  the question to Anthropic's API with the survey data pack attached server-side.
- `.env.example` — the two environment variables you need to set.
- `package.json` — minimal project metadata (no dependencies to install).

## Deploy in about 10 minutes (Vercel)

1. **Get an Anthropic API key**
   Go to [console.anthropic.com](https://console.anthropic.com), create a key
   under API Keys, and add a payment method under Billing. This is separate
   from any claude.ai subscription — it's pay-as-you-go, billed per question
   (see cost note below).

2. **Push this folder to a GitHub repo**
   ```
   git init
   git add .
   git commit -m "u-mee survey report with standalone Ask the Survey"
   git remote add origin <your-new-repo-url>
   git push -u origin main
   ```

3. **Import into Vercel**
   - Go to [vercel.com/new](https://vercel.com/new), sign in (GitHub login is
     easiest), and import the repo you just pushed.
   - Framework preset: leave as "Other" / no build step — this is a static
     page plus one API function, nothing to build.
   - Before clicking Deploy, open **Environment Variables** and add:
     - `ANTHROPIC_API_KEY` — the key from step 1
     - `ASK_PASSWORD` — a password of your choice, e.g. `umee2026`
   - Click **Deploy**.

4. **Done** — Vercel gives you a URL like `umee-survey-report.vercel.app`.
   Anyone with that link can read the full report with no login. To use
   "Ask the Survey", they enter the `ASK_PASSWORD` you set once per browser
   session.

5. **Optional: use your own domain**
   In Vercel, go to the project's Domains tab and add something like
   `survey.u-mee.com`, then point that subdomain at Vercel per their
   instructions (a CNAME record, usually).

Netlify and Cloudflare Pages work the same way in outline — push to GitHub,
import the repo, set the same two environment variables, deploy. The exact
menu names differ slightly.

## Changing the password later

Update `ASK_PASSWORD` in your hosting platform's environment variable
settings and redeploy (Vercel redeploys automatically on a settings change,
or you can trigger one manually). Anyone who already unlocked the tool in
their browser stays unlocked until their session ends or you change the
password — there's no way to revoke one specific person's access without
changing the password for everyone.

## Cost

Anthropic bills per token. With the survey data pack (~23KB) sent as a
cached system prompt, a typical question costs roughly 1–3 US cents on
Claude Sonnet 5. Even at 50 questions/day across a whole team that's well
under $1/day. Set a spending alert in the Anthropic console if you want a
safety net.

## Rate limiting caveat

`api/ask.js` includes a simple in-memory rate limit (20 requests per 10
minutes per IP address). This resets whenever the serverless function cold
starts and isn't shared across regions, so treat it as reasonable abuse
protection for an internal tool, not a hard guarantee. If this ever gets
wider use than "our own staff," swap it for a proper store like Vercel KV
or Upstash Redis.

## Updating the survey data later

The data pack and prompt instructions live inside `api/ask.js`, in the
`RULES_AND_DATA` constant. If a future survey wave needs adding, that file
is where the numbers live — ask Claude to regenerate it from the updated
source data, the same way this version was built.
