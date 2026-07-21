# ClearSubscription

ClearSubscription finds recurring subscriptions hiding in your Gmail, extracts the billing facts with GPT-5.6, and asks you to confirm every prediction before it counts. It never sends, deletes, edits, moves, or labels email.

The information was never hidden â€” it's sitting in receipts you already received and ignored. The problem is *timing*. Your bank tells you about a renewal two days before it happens, which is far too late to decide whether you still want the thing.

Built for OpenAI Build Week 2026, category **Apps for your life**.

## Product flow

1. Land on the privacy-first introduction.
2. Sign in with Google (identity scopes only).
3. Grant the separate `gmail.readonly` permission.
4. Watch the scan shortlist likely billing messages and classify them.
5. Review, filter, and confirm records on the dashboard.
6. Open a detail page to see every extracted fact beside the source snippet that produced it.

**Try Demo** runs the same experience on clearly labelled fictional data. It needs no account, no Gmail access and no OpenAI key â€” this is the intended path for evaluating the project, because the OAuth consent screen is in Testing mode and live Google sign-in is limited to registered test users.

## Architecture

- **Next.js App Router + TypeScript** â€” server routes, server-rendered entry pages, responsive client interactions.
- **Auth.js / NextAuth** â€” Google sign-in requests only `openid email profile`.
- **Incremental Gmail OAuth** â€” `/api/gmail/authorize` separately requests only `https://www.googleapis.com/auth/gmail.readonly`, with OAuth state and PKCE. You can hold an account and never grant inbox access. Tokens are AES-256-GCM encrypted in an HTTP-only, same-site cookie, unreachable from browser JavaScript.
- **Gmail REST API** â€” a 25-month window, fully paginated. Up to 1,500 messages are triaged on **headers only** (`format=metadata`, so Gmail never ships the body), grouped by sender domain, and bodies are fetched for at most two messages per vendor and 120 overall, under a 40-second budget. Cost scales with the number of vendors you use, not the size of your inbox: roughly 900 matching emails become about 30 model calls.
- **OpenAI Responses API** â€” each shortlisted email is classified independently with `gpt-5.6` at low reasoning effort. Structured output is parsed and validated with Zod; invalid responses are dropped rather than repaired, and an entirely invalid batch becomes a retryable error.
- **Local browser state** â€” results and confirmations live in `localStorage` for this database-free MVP. AI-predicted and user-confirmed status are separate fields.
- **Vendor identity** â€” records are grouped by *registrable sender domain*, so `replit.com`, `mail.replit.com` and `notifications.replit.com` are one vendor rather than three. Within a vendor, records merge when one subscription name contains another, which keeps distinct products behind a shared billing domain apart.

## What the model is and isn't asked to decide

The schema is where most of the engineering lives.

**Amounts, currencies and dates are explicitly nullable.** When an email doesn't state a price, the model must return `null` rather than produce a plausible number. `confidence` is bounded 0â€“1. `evidenceSnippet` must be a near-exact phrase from the supplied email, so every extracted claim is traceable to its source in the interface.

**`serviceCategory` separates spend you can reconsider from spend you can't.** Recurring payment alone doesn't make something a subscription: broadband, mobile, electricity and insurance recur, but cancelling them isn't a discretionary saving. Utilities are classified separately and excluded from the headline figure.

**Currency is never assumed silently.** An evidenced currency is used as fact. Where an email states an amount with no symbol â€” common in Indian mail, where `4723.00/-` is idiomatic â€” the viewer's locale currency is used *and marked as assumed* (`â‰ˆâ‚¹4,723.00`). Totals are computed within a single currency and report what they excluded, rather than adding rupees to dollars and labelling the result with whichever appeared first.

## Local setup

Prerequisites: Node.js 20+ and npm.

```bash
npm install
cp .env.example .env.local   # copy .env.example .env.local on Windows
npx auth secret              # generates AUTH_SECRET into .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). For a zero-configuration walkthrough, click **Try Demo** â€” demo mode needs no environment variables at all.

## Environment variables

| Variable | Purpose |
| --- | --- |
| `GOOGLE_CLIENT_ID` | Google OAuth web client ID used by sign-in and incremental Gmail authorization |
| `GOOGLE_CLIENT_SECRET` | Google OAuth web client secret |
| `AUTH_SECRET` | Long random secret used by Auth.js and for Gmail token encryption; generate with `npx auth secret` or `openssl rand -base64 32` |
| `NEXTAUTH_URL` | Canonical app URL, such as `http://localhost:3000` |
| `OPENAI_API_KEY` | Server-only OpenAI API key for live classification |

Never expose these through `NEXT_PUBLIC_*`, commit `.env.local`, or place secrets in client code.

## Google OAuth and Gmail API configuration

1. Create or select a project in Google Cloud Console.
2. Enable **Gmail API** under APIs & Services.
3. Configure the OAuth consent screen and add the sensitive scope `https://www.googleapis.com/auth/gmail.readonly`. While the app is in Testing, add each user as a test user â€” Owner access does not imply this, and missing it produces `access_denied`.
4. Create an **OAuth client ID** of type **Web application**.
5. Add the local authorized JavaScript origin: `http://localhost:3000`.
6. Add both local authorized redirect URIs:
   - `http://localhost:3000/api/auth/callback/google` (Auth.js identity sign-in)
   - `http://localhost:3000/api/gmail/callback` (incremental Gmail permission)

Google requires OAuth verification before `gmail.readonly` is available beyond registered test users.

## Testing and quality checks

```bash
npm run lint
npm run test
npm run build
```

Tests cover header triage and per-sender selection, the cost characteristics of the scan, HTML entity decoding and billing-aware body excerpting, vendor-identity deduplication, currency resolution and single-currency totals, cost normalization across billing periods, and rejection of malformed model output.

## Privacy and safety notes

- The Gmail scope is read-only, and the app contains no code to send, delete, edit, move, or label messages.
- Triage happens on headers alone. Bodies are downloaded only for messages that survive it â€” at most two per vendor.
- Promotional mail is filtered by deterministic local rules before any model call, so fewer emails leave the server.
- OpenAI receives only subject, sender, received date, and a billing-focused excerpt of up to 4,000 characters. The full inbox never leaves the server.
- Gmail tokens live in an encrypted, HTTP-only cookie.
- AI status is explicitly tentative. Your confirmation is stored separately and always wins.
- Totals are estimates over known amounts, and the interface states what has been excluded. Unknown values are never invented.
- This is an MVP, not financial advice. A production release needs a database with encryption at rest, token revocation, retention controls, account deletion, rate limiting, audit logs, a privacy policy, and completed Google verification.

## Known limitations

Honesty is cheaper than a surprise during evaluation.

- Some records show "Amount unavailable" because the emails read genuinely never state a figure. This is the nullable schema behaving correctly, not a parsing failure â€” though which emails get read is itself an open improvement, tracked in `CODEX-BACKLOG.md`.
- Category classification is a judgement call and will get some rows wrong. Confidence scores and per-row confirmation exist precisely because of this.
- Without a database, results persist only in the browser that produced them.

## What's next

The database, and then the feature the product actually exists for: **a renewal alert 14 days out**. The dashboard is table stakes â€” every bank has one. Being told in time to act is the part nobody does well, and it's currently blocked only on having nowhere to store a renewal date between sessions.

After that: a cancellation-policy library for the top few hundred platforms, and Google OAuth verification.

## How this project was built with Codex

The entire application was generated by Codex in a single session on 20 July 2026
(session `019f8018-a752-7591-8639-9dc9f172f4a0`). One product brief went in; a working
Next.js application came out. **45 files** were created or modified in that session,
covering every page, every API route, the classification layer, the test suite and the
deployment configuration.

The session transcript is the honest record of how this was made, so it is worth being
specific about what came from the model and what came from us.

### What Codex generated

**The architecture.** From a prose brief describing a category, a tech stack and a
page-by-page flow, Codex produced the full App Router structure: the landing, connect,
scan, dashboard and subscription-detail pages, plus five API routes
(`/api/auth/[...nextauth]`, `/api/gmail/authorize`, `/api/gmail/callback`,
`/api/gmail/status`, `/api/scan`). No scaffolding template was used.

**The privacy architecture â€” the part we are most pleased with.** The brief asked for
read-only Gmail access. Codex implemented something considerably stronger without being
asked for the mechanism: Google sign-in requests only `openid email profile`, and
`gmail.readonly` is requested *separately*, later, from `/api/gmail/authorize` with OAuth
state and PKCE. A user can create an account and never grant inbox access. The resulting
tokens are AES-256-GCM encrypted inside an HTTP-only, same-site cookie, so they are never
reachable from browser JavaScript.

**The prediction/confirmation split.** `possibleStatus` (what the model thinks) and
`userStatus` (what the person has confirmed) are separate fields in `lib/types.ts`, and
the user's value always wins. For a product that tells people when their money is about
to leave their account, this is the difference between a suggestion and an assertion.

**Deterministic pre-filtering.** Before any model call, `lib/gmail.ts` applies a sender
denylist, promotional-header patterns and a subscription-term match. Emails that obviously
are not billing messages never reach the API. This is cost control and privacy control at
once â€” fewer emails leave the server.

**The test suite.** Four test files written alongside the implementation, covering
shortlisting, duplicate grouping, cost normalisation, and â€” most usefully â€” rejection of
malformed model output.

### How GPT-5.6 is used

Extraction runs through the Responses API (`lib/classify.ts`) with a Zod schema supplied
via `zodTextFormat`, at low reasoning effort, one email at a time.

The schema is where the engineering actually lives. `amount`, `currency`, `paymentDate`,
`renewalDate` and `trialEndDate` are all **explicitly nullable**, so when the model cannot
find a price in an email it is required to say `null` rather than produce a plausible
number. `confidence` is bounded 0â€“1. `evidenceSnippet` must be a near-exact phrase from
the supplied email, which makes every extracted claim traceable back to its source in the
UI. Anything failing `classificationSchema.parse()` is dropped, not repaired â€” a batch
that fails entirely becomes a retryable error rather than a half-invented dashboard.

Only subject, sender, received date and a short snippet are ever transmitted. The full
inbox never leaves the server.

### What we decided, rather than the model

- **The product itself.** The repositioning from an adversarial contract-audit tool to a
  calm subscription monitor was a human judgement about where the pain actually is â€” the
  problem is *timing*, finding out two days before a renewal, not hidden fine print.
- **The scan-window bug.** Codex's first implementation capped the scan at 30 newest
  messages with no date filter at all. Finding that, deciding it mattered, and specifying
  the fix â€” a 25-month window, full pagination, metadata-only triage, and bodies fetched
  only for the newest and oldest email per sender domain â€” was our call. Codex then
  implemented it. Cost now scales with the number of vendors, not the number of emails:
  roughly 900 emails collapse to about 30 model calls.
- **Credential ownership, provider configuration, and the security posture** around what
  ships to a real user.

### Where Codex needed steering

Worth recording, because "the model wrote it all" would be a less useful claim than the
truth. The initial Gmail query had no date filter and an unbounded concurrency pattern,
and it downloaded full message bodies before the filtering step discarded half of them.
The bug was not visible in the tests, because the tests asserted the behaviour as built.
Catching it required reading the query and asking what it would do against a real
five-year inbox â€” which remains a human job.

Codex also handled the unglamorous middle of the session well: diagnosing an Auth.js
`Configuration` error from server logs, writing `.env.local` without ever echoing a secret
value to the terminal, and verifying `.gitignore` coverage before the first commit.
