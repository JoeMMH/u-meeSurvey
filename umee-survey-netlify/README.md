# u‑mee Survey Report — standalone "Ask the Survey" (Netlify)

This is a self-hosted version of the u‑mee customer survey report. Unlike
the claude.ai-published version, colleagues can open this **and use the AI
search feature without a Claude account** — access is controlled by a
single shared password you set yourself, not by individual logins.

## What's in this folder

- `index.html` — the full report page (charts, tables, Ask the Survey UI).
  It calls `/api/ask` for answers; a Netlify redirect (below) routes that to
  the real function, so this file needs no editing.
- `netlify/functions/ask.js` — the serverless function. Holds your
  Anthropic API key, checks the shared password, applies a light rate
  limit, and forwards each question to Anthropic's API with the survey
  data pack attached server-side.
- `netlify.toml` — tells Netlify where the functions live and redirects
  `/api/ask` → `/.netlify/functions/ask`.
- `.env.example` — the environment variables you need to set in Netlify.
- `package.json` — minimal project metadata (no dependencies to install).

## Deploy in about 10 minutes

1. **Get an Anthropic API key**
   Go to [console.anthropic.com](https://console.anthropic.com), create a
   key under API Keys, and add a payment method under Billing. This is
   separate from any claude.ai subscription — it's pay-as-you-go, billed
   per question (see cost note below).

2. **Push this folder to a GitHub repo**
   ```
   git init
   git add .
   git commit -m "u-mee survey report with standalone Ask the Survey"
   git remote add origin <your-new-repo-url>
   git push -u origin main
   ```

3. **Create the site in Netlify**
   - Go to [app.netlify.com](https://app.netlify.com) and click
     **Add new site → Import an existing project**.
   - Choose **Deploy with GitHub**, authorise Netlify if asked, and pick the
     repo you just pushed.
   - Build settings: leave **Build command** empty and **Publish directory**
     as `.` (or `/`) — there's no build step, `netlify.toml` already tells
     Netlify everything it needs, including where the function lives.
   - Don't click Deploy yet — first add the environment variables (next step).

4. **Set the environment variables**
   Still on the site setup screen (or afterwards under
   **Site configuration → Environment variables**), add:
   - `ANTHROPIC_API_KEY` — the key from step 1
   - `ASK_PASSWORD` — a password of your choice, e.g. `umee2026`

   Then click **Deploy site**.

5. **Done** — Netlify gives you a URL like `umee-survey-report.netlify.app`.
   Anyone with that link can read the full report with no login. To use
   "Ask the Survey", they enter the `ASK_PASSWORD` you set once per browser
   session.

6. **Optional: use your own domain**
   In Netlify, go to **Domain management** and add something like
   `survey.u-mee.com`, then follow Netlify's instructions to point that
   subdomain at your new site (usually a CNAME record).

## Changing the password later

Update `ASK_PASSWORD` under **Site configuration → Environment variables**
and redeploy (**Deploys → Trigger deploy**, or it picks up automatically on
your next git push). Anyone who already unlocked the tool in their browser
stays unlocked until their session ends or you change the password — there's
no way to revoke one specific person's access without changing it for
everyone.

## Cost

Anthropic bills per token. With the survey data pack (~23KB) sent as a
cached system prompt, a typical question costs roughly 1–3 US cents on
Claude Sonnet 5. Even at 50 questions/day across a whole team that's well
under $1/day. Set a spending alert in the Anthropic console if you want a
safety net. (Netlify's own free tier comfortably covers the hosting and
function-call volume for an internal tool like this.)

## Rate limiting caveat

`netlify/functions/ask.js` includes a simple in-memory rate limit (20
requests per 10 minutes per IP address). This resets whenever the function
cold-starts and isn't shared across Netlify's edge locations, so treat it
as reasonable abuse protection for an internal tool, not a hard guarantee.
If this ever gets wider use than "our own staff," swap it for a proper
store — Netlify Blobs or an external Redis (e.g. Upstash) both work well
from a Netlify Function.

## Updating the survey data later

The data pack and prompt instructions live inside
`netlify/functions/ask.js`, in the `RULES_AND_DATA` constant. If a future
survey wave needs adding, that's where the numbers live — ask Claude to
regenerate it from the updated source data, the same way this version was
built.

## Testing locally before you deploy (optional)

If you have Node installed and want to try it on your own machine first:
```
npm install -g netlify-cli
netlify dev
```
This runs the site and the function together at `http://localhost:8888`,
reading environment variables from a local `.env` file (copy
`.env.example` to `.env` and fill in real values — keep that file out of
git; it's already excluded by a typical Netlify `.gitignore`, but double
check before committing).
