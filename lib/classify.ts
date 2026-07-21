import { classificationSchema, type CandidateEmail, type Classification } from "@/lib/types";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

const SYSTEM_PROMPT = `You classify a single shortlisted email for a subscription-management app.
Extract only facts supported by the supplied email. Never infer or invent an amount, currency, or date; use null when unavailable.

isSubscriptionEmail means the email is evidence of a paid, ongoing commercial relationship: a charge taken, a renewal due, a plan priced, a trial that converts to payment, or a cancellation of something paid. The word "subscription" appearing in the text is not enough on its own.
Set it false for free newsletters and mailing lists (including "manage your subscription preferences" footers), account or security notices, marketing and offers, order shipping updates, and anything with no evidence that money is or will be charged.

billingFrequency should use the period the email evidences: weekly, monthly, quarterly (including plans described as 3 months or 90 days), yearly (including annual and 12 months). Use unknown only when no period is stated or implied.
Status is only a prediction: cancellation messages are possibly_cancelled, strong recent billing/renewal evidence is possibly_active, and ambiguous evidence is needs_review.
The evidenceSnippet must be a brief exact or near-exact phrase from the supplied snippet and must not contain facts absent from it.

serviceCategory separates spend the user can reconsider from spend they cannot. Recurring payment is NOT sufficient to make something a subscription.
- subscription: optional recurring access the user chose and could cancel without losing an essential service. Streaming, music, software and SaaS seats, cloud storage, news and publications, gyms, memberships, food or grooming boxes, gaming passes.
- utility: an essential or infrastructure service billed on a recurring basis, where cancelling is not a discretionary saving. Mobile and broadband (for example Airtel, Jio, Tata Play, Vodafone, BSNL, Comcast, BT), electricity, water, gas, piped services, DTH and cable, rent and maintenance, tolls, and insurance premiums.
- one_off: a single purchase, invoice or payment with no recurring commitment, including proforma invoices, one-time orders, and standalone service bills.
- other: anything that does not fit the above, including account notices with no clear spend.
When an email is genuinely ambiguous between subscription and utility, choose utility only if the provider is a telecom, internet, energy, water or insurance company; otherwise prefer subscription.

The snippet may be an excerpt with " … " marking omitted sections; treat each fragment as genuine text from the same email.

Currency must be the ISO code actually evidenced in the email (INR, USD, GBP, EUR...). Treat 'Rs', 'Rs.', '₹', 'INR' and a trailing '/-' as INR. Never default to USD; if no currency is evidenced anywhere in the email, return null.`;

export async function classifyEmail(email: CandidateEmail, safetyIdentifier: string): Promise<Classification> {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_NOT_CONFIGURED");
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.parse({
    model: "gpt-5.6",
    reasoning: { effort: "low" },
    safety_identifier: safetyIdentifier,
    input: [
      { role: "developer", content: SYSTEM_PROMPT },
      { role: "user", content: JSON.stringify({ subject: email.subject, sender: email.sender, receivedDate: email.receivedDate, snippet: email.snippet }) },
    ],
    text: { format: zodTextFormat(classificationSchema, "subscription_email") },
  });
  if (!response.output_parsed) throw new Error("INVALID_GPT_RESPONSE");
  return classificationSchema.parse(response.output_parsed);
}
