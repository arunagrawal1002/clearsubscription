# SubScam

SubScam is a competition-ready personal-finance and consumer-protection MVP that finds likely recurring subscriptions in Gmail, extracts billing facts with GPT-5.6, and asks the user to confirm every prediction. It never sends, deletes, edits, moves, or labels email.

## Product flow

1. Land on the privacy-first introduction.
2. Sign in with Google (identity scopes only).
3. Grant the separate `gmail.readonly` permission.
4. Watch the secure scan shortlist likely billing messages and classify them.
5. Review, filter, and confirm subscriptions on the dashboard.
6. Open a detail page to see all extracted facts and the source snippet.

“Try Demo” runs the same scanning/dashboard experience with clearly labelled fictional data for FitLife Gym, StreamPlus, DesignCloud Pro, CloudBox Storage, and LearnNow Academy. It needs no account, Gmail access, or OpenAI key.

## Architecture

- **Next.js App Router + TypeScript:** server routes, server-rendered entry pages, and responsive client interactions.
- **Auth.js / NextAuth:** Google sign-in requests only `openid email profile`.
- **Incremental Gmail OAuth:** `/api/gmail/authorize` separately requests only `https://www.googleapis.com/auth/gmail.readonly`, with OAuth state and PKCE. Tokens are AES-256-GCM encrypted in an HTTP-only, same-site cookie.
- **Gmail REST API:** searches up to 30 likely messages with a targeted Gmail query. Local rules remove obvious promotions before classification.
- **OpenAI Responses API:** each shortlisted email is independently classified with `gpt-5.6` at low reasoning effort. Only subject, sender, received date, and a short body/snippet are sent. Structured output is parsed and validated with Zod. Invalid responses are dropped and surfaced; an entirely invalid batch becomes a retryable error.
- **Local browser state:** scan results and user confirmations are kept in local storage for this database-free MVP. AI-predicted and user-confirmed status remain separate fields.
- **Duplicate detection:** normalized provider + subscription name records are grouped, the newest evidence is retained, and the number of matching emails is shown.

## Local setup

Prerequisites: Node.js 20+ and npm.

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). For a zero-configuration walkthrough, click **Try Demo**.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Google OAuth web client ID used by sign-in and incremental Gmail authorization |
| `GOOGLE_CLIENT_SECRET` | Google OAuth web client secret |
| `AUTH_SECRET` | Long random secret used by Auth.js and Gmail token encryption; generate with `npx auth secret` or `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Canonical app URL, such as `http://localhost:3000` or the production Vercel URL |
| `OPENAI_API_KEY` | Server-only OpenAI API key for live classification |

Never expose these values through `NEXT_PUBLIC_*`, commit `.env.local`, or place secrets in client code.

## Google OAuth and Gmail API configuration

1. Create or select a project in Google Cloud Console.
2. Enable **Gmail API** under APIs & Services.
3. Configure the OAuth consent screen. Add the sensitive Gmail read-only scope: `https://www.googleapis.com/auth/gmail.readonly`. While the app is in testing, add each demo user as a test user.
4. Create an **OAuth client ID** of type **Web application**.
5. Add local authorized JavaScript origin: `http://localhost:3000`.
6. Add both local authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (Auth.js identity sign-in)
   - `http://localhost:3000/api/gmail/callback` (incremental Gmail permission)
7. For production, add the matching two HTTPS URLs on the final domain.

Google may require OAuth app verification before Gmail access is available broadly outside configured test users.

## OpenAI GPT-5.6 usage

The classifier in `lib/classify.ts` uses the Responses API with the `gpt-5.6` alias, which routes to GPT-5.6 Sol, and the official Zod structured-output helper. Low reasoning effort fits bounded email classification. The schema requires explicit `null` for unsupported amounts and dates, strict enums, confidence from 0–1, and a source-grounded evidence snippet. The server sends one shortlisted email at a time, never the whole inbox.

Live scanning incurs Google and OpenAI API usage. Demo mode never calls either provider.

## Testing and quality checks

```bash
npm run lint
npm run test
npm run build
```

Tests cover code-based email shortlisting, duplicate subscription grouping, cost normalization, and rejection of malformed GPT output.

## Privacy and safety notes

- Gmail scope is read-only; the app contains no code to send, delete, edit, move, or label messages.
- Gmail is searched before content is fetched; at most 30 likely messages are inspected per scan.
- Promotions are filtered with deterministic local rules before GPT classification.
- OpenAI receives only subject, sender, received date, and at most 1,200 characters of plain text/snippet.
- Gmail tokens live in an encrypted, HTTP-only cookie. They are not available to browser JavaScript.
- AI status is explicitly tentative. The user’s confirmation is stored separately and always wins in their own review workflow.
- Currency totals are estimates based only on known active-like amounts. Unknown values are never invented.
- This is an MVP, not financial advice. A production release should add a database with encryption at rest, token revocation, retention controls, account deletion, rate limiting, audit logs, a privacy policy, and a completed Google verification review.

## Deploy to Vercel

1. Push this repository to a Git provider and import it into Vercel.
2. Add all five environment variables in Project Settings → Environment Variables. Set `NEXTAUTH_URL` to the production URL.
3. Add the production origin and both callback URLs to the Google OAuth web client.
4. Deploy. `vercel.json` and the route-level export give the scan function a 60-second maximum where the Vercel plan permits it.
5. Smoke-test demo mode first, then sign-in, Gmail consent, live scan, confirmation persistence, and a subscription detail page.

For preview deployments, OAuth is simplest with a stable custom domain; otherwise every preview hostname must be registered with Google and reflected in `NEXTAUTH_URL`.

## Competition demo flow

1. Open the landing page and point out the three trust commitments.
2. Click **Try Demo** to avoid live credentials and narrate the four scan stages.
3. Show the fictional-data banner, summary metrics, cost estimate, filters, and duplicate-email merge note.
4. Confirm one record as Active and another as Not Mine; emphasize that user status stays separate from AI status.
5. Open a detail page and show null-safe extracted fields plus the exact source snippet.
6. Return to the landing page and explain how the live path adds Google identity, separate Gmail read-only consent, local shortlisting, and GPT-5.6 structured extraction.

## How Codex accelerated development

Codex turned the product brief into a complete App Router architecture, implemented the privacy boundary and OAuth split, built a visual system and responsive workflow, added deterministic preprocessing and Zod validation, wrote tests and deployment documentation, and ran the full install/lint/test/build verification loop. The human remains responsible for credential ownership, provider configuration, security review, and product-policy decisions.
