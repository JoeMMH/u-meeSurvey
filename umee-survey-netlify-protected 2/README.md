# u‑mee Survey Report — standalone, whole-site password protected (Netlify)

This version puts the **entire report** — not just the AI search feature —
behind a real password, enforced server-side with standard HTTP Basic Auth
(the browser's own login popup). Colleagues need no Claude account and no
Netlify account; they just need the one username/password you set.

## Why this looks a bit different from a normal static site

Netlify's own password-protection features (the dashboard toggle, and the
older `_headers` Basic-Auth trick) both now require a **Pro plan or above**
— they're no longer available on the Free plan. Rather than ask you to
upgrade, this version builds the same protection using a Netlify Function
(available on every plan, free included) — the same mechanism already
powering "Ask the Survey."

## What's in this folder

- `index.html` — the report page, kept here for reference/editing. It is
  **not** served directly — see "Updating the report" below, this matters.
- `netlify/functions/gate.js` — checks the `Authorization` header for
  correct Basic Auth credentials before returning the report's HTML at all.
  Wrong or missing credentials get a real 401 and the browser's login popup.
- `netlify/functions/ask.js` — the "Ask the Survey" AI function. Checks the
  *same* username/password (via the same Basic Auth header, which browsers
  resend automatically) and calls Anthropic's API server-side.
- `netlify.toml` — routes `/` and `/index.html` through `gate.js`, and
  `/api/ask` through `ask.js`.
- `.env.example` — the environment variables you need to set in Netlify.

## Deploy in about 10 minutes

1. **Get an Anthropic API key**
   [console.anthropic.com](https://console.anthropic.com) → API Keys →
   create one, and add a payment method under Billing. Pay-as-you-go,
   billed per question (see the cost note from earlier in our conversation
   — roughly 1–3 cents per question).

2. **Push this folder to a GitHub repo** — make sure `index.html`,
   `netlify.toml`, and the `netlify/` folder end up at the **root** of the
   repo, not nested inside another folder (this tripped us up last time —
   check the repo's file listing on GitHub looks like this folder's listing
   before moving on).

3. **Create the site in Netlify**
   Add new site → Import an existing project → GitHub → pick the repo.
   Leave Build command empty, Publish directory as `.` — `netlify.toml`
   handles the rest.

4. **Set the environment variables** (Site configuration → Environment
   variables), before or right after the first deploy:
   - `ANTHROPIC_API_KEY` — from step 1
   - `SITE_USERNAME` — anything, e.g. `umee`
   - `SITE_PASSWORD` — the one password everyone will use

5. **Deploy.** Visiting the site now shows the browser's own login prompt
   before anything else loads. Enter the username/password from step 4 —
   the whole report, including "Ask the Survey," is now unlocked for that
   browser session.

## Updating the report later — read this before editing index.html

This is the one real trade-off of this approach: because `gate.js` serves
the page from a **copy of the HTML baked into the function itself**
(so it can check the password before handing anything back), editing
`index.html` alone does **nothing** — the live site keeps serving the old
copy inside `gate.js` until that's regenerated too.

If you need to update the report content later, the simplest path is to
come back and ask Claude to regenerate `gate.js` from an updated
`index.html`, the same way this version was built — rather than
hand-editing the embedded copy yourself.

## Changing the password later

Update `SITE_USERNAME` / `SITE_PASSWORD` in Netlify's environment variable
settings and redeploy. This changes both the page login and the "Ask the
Survey" access in one place. Anyone who already has the old credentials
cached in their browser stays logged in until they clear it or restart
their browser — there's no way to revoke one specific person without
changing the password for everyone.

## Cost

Unchanged from before: roughly 1–3 US cents per question on Claude Sonnet
5, well under $1/day even at 50 questions/day across a team. Set a
spending alert in the Anthropic console if you want a safety net.

## Rate limiting caveat

`ask.js` still includes the same simple in-memory rate limit (20 requests
per 10 minutes per IP). Treat it as reasonable abuse protection for an
internal tool, not a hard guarantee — see the code comments for how to
upgrade it if this ever needs to scale beyond your own staff.
