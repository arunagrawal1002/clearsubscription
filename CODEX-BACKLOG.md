# ClearSubscription — Codex work queue

**Read this first, then work top to bottom. Stop at the freeze deadline.**

## Where the code lives

| | |
|---|---|
| **Working folder** | `F:\ClearSubWork` — the only folder to edit. All commands run from here. |
| **Canonical repo** | `https://github.com/arunagrawal1002/clearsubscription` |
| **Branch to work on** | `fix/extraction`, cut from `main` |
| **Frozen tag** | `video-build` — the exact build the demo video was recorded against |

`arunagrawal1002/clearsubscription` is the repository of record as of 21 July.
`shraddha0123-pixel/subscam1` holds the same code under the former product name
and is **no longer the target** — do not push there, and do not add it as a
remote.

`F:\ClearSub` is a documents-only folder holding submission material. Its `.git`
is broken. Never run git commands in it and never treat it as a source checkout.

Confirm the remote before your first push:

```
git remote -v          # expect origin -> arunagrawal1002/clearsubscription
git branch --show-current
```

If `origin` still points at `subscam1`, stop and tell the user rather than
repointing it yourself.

## Ground rules

1. **Work on a branch, never on `main`.** `main` is the build the demo video is
   recorded against and must stay exactly as it is until the video is uploaded.
   ```
   git checkout -b fix/extraction
   ```
2. **`npm run test` and `npm run build` must both pass before every commit.**
   38 tests currently pass. A change that breaks a test is not done.
3. **Do not touch `.env.local`.** It holds live credentials. Never print, echo,
   copy or commit its contents.
4. **Do not rename anything user-visible.** The product is ClearSubscription.
   The three remaining `subscam` strings in `lib/storage.ts` and
   `lib/gmail-token.ts` are deliberate legacy-compatibility keys — leave them.
5. Every item below has an acceptance test. Write it first if it doesn't exist.

## Context you need

Next.js App Router + TypeScript + Tailwind. Gmail read-only API for input,
OpenAI Responses API (`gpt-5.6`) with Zod structured outputs for extraction.
No database — results live in `localStorage`.

The pipeline: `lib/gmail.ts` searches 25 months of mail, triages on headers
only, fetches bodies for a small subset, and hands candidates to
`lib/classify.ts`, which returns a Zod-validated `Classification` per email.
`app/api/scan/route.ts` orchestrates and calls `lib/dedupe.ts`.

**Design principle that governs every change here: the app must never present an
inferred fact as an observed one.** Nullable fields exist so the model can say
"not stated" instead of inventing. Any fix that makes the dashboard look tidier
by guessing is the wrong fix.

---

## P0 — Amounts are missing on most cards

**Symptom.** On a real 22-record scan, most cards read "Amount unavailable".

**Root cause (diagnosed, not yet fixed).** `selectPerSender` in `lib/gmail.ts`
chooses which of a vendor's emails to read *by date* — newest and oldest. For
most vendors the newest email is a marketing blast and the actual receipt is
third or fifth. We extract carefully from the wrong messages.

**Fix.** Rank a vendor's candidate headers by billing signal and take the top
two by score rather than by recency. Signal lives in the subject line: strong
terms are `receipt`, `invoice`, `payment`, `charged`, `paid`, `debited`,
`renewal`, `order confirmation`, `bill`; weak or negative terms are `offer`,
`sale`, `save`, `deal`, `newsletter`, `digest`, `update`, `tips`, `webinar`.
Keep the existing two-per-sender cap so cost does not change.

**Acceptance.** A unit test where a vendor has five headers — a newest one
titled "Big summer offer" and an older one titled "Your payment receipt" — must
select the receipt. Cost characteristics must be unchanged: the existing
"900 emails -> 30 model calls" test in `lib/gmail.test.ts` must still pass.

**Already done, don't redo:** HTML entity decoding (`&#8377;` -> ₹), preferring
the richer MIME part over a stub `text/plain`, and `billingExcerpt`, which
replaced blind 1,200-char truncation with windows centred on money patterns.

---

## P1 — Classification accuracy on real mail

**Symptom.** A free newsletter was classified as a paid membership. Insurance
policies and broadband bills were initially treated as subscriptions.

**Partly fixed.** `serviceCategory` (`subscription` / `utility` / `one_off` /
`other`) now exists, and the prompt requires evidence that money is or will be
charged before `isSubscriptionEmail` is true.

**Remaining work.** The prompt has never been evaluated against real examples.
Build a small fixture set in `lib/classify.fixtures.ts` — roughly fifteen
anonymised real emails covering a paid SaaS receipt, a free newsletter, a
broadband bill, an insurance renewal, a one-off invoice, a trial-ending notice
and a cancellation — with the expected `serviceCategory` and
`isSubscriptionEmail` for each. Test the *rules*, not live API calls.

**Acceptance.** A documented pass rate on that fixture set, and any prompt
change measured against it rather than judged by eye.

---

## P2 — Vendor should be the unit, not the email

**Why.** The pipeline treats one email as one subscription and used
model-generated free text (`provider` + `subscriptionName`) as the dedupe key,
which is what produced three separate Replit cards. `lib/dedupe.ts` now groups
on registrable sender domain with name-containment matching, which patches the
symptom.

**The real fix.** Group deterministically by registrable domain *before*
classification. One vendor, one card, by construction. The model stops doing
identity resolution — a job it is poorly suited to — and only extracts facts.
This touches `lib/gmail.ts`, `lib/dedupe.ts`, `app/api/scan/route.ts` and the
dashboard.

**Acceptance.** Duplicate cards become structurally impossible. Distinct
products behind a shared billing domain (YouTube Premium and Google One both
arrive via Google) must still appear separately.

---

## P3 — README is stale

`README.md` still says "SubScam" throughout and still describes the pre-fix scan
behaviour ("up to 30 likely messages"). Current behaviour: a 25-month window,
up to 1,500 messages inspected by metadata, 120 bodies fetched, two per sender.

Replacement copy for the Codex collaboration section already exists at
`F:\ClearSub\README-codex-section.md` — use it rather than writing new text.

---

## Explicitly out of scope before the deadline

- The database and the 14-day pre-renewal alert. This is the actual product
  thesis and the most valuable thing to build, but it cannot be done well in the
  time remaining and a half-built version is worse than a documented plan.
- Vercel deployment. Judges evaluate via demo mode; the OAuth consent screen is
  in Testing so live Google sign-in will not work for them regardless.
- Any rename, restyle or refactor not listed above.
