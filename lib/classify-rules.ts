import type { CandidateEmail, Classification } from "@/lib/types";

type ClassificationDecision = Pick<Classification, "serviceCategory" | "isSubscriptionEmail">;
type ClassifiableEmail = Pick<CandidateEmail, "subject" | "sender" | "snippet">;

const UTILITY_TERMS = /\b(broadband|fibre|fiber|internet|insurance|electricity|water|gas|mobile|telecom|cable|dth|rent|maintenance|toll)\b/i;
const ONE_OFF_TERMS = /\b(one[- ]time|proforma|standalone|repair)\b/i;
const MONEY_TERMS = /(?:[₹$£€]\s*\d|\b(?:rs\.?|inr|usd|eur|gbp)\s*\d|\b(?:charged|payment|amount due|premium|invoice|bill)\b)/i;
const ONGOING_TERMS = /\b(monthly|annual|year|renew|membership|plan|subscription|trial|billing period|service period|policy)\b/i;

/**
 * Offline policy baseline for the fixture suite. It deliberately covers only
 * high-signal cases so tests can measure the classification contract without a
 * live model call; extraction remains the model's responsibility.
 */
export function classifyEmailByRules(email: ClassifiableEmail): ClassificationDecision {
  const text = `${email.subject} ${email.sender} ${email.snippet}`;
  const hasMoneyEvidence = MONEY_TERMS.test(text);

  if (hasMoneyEvidence && ONE_OFF_TERMS.test(text) && !ONGOING_TERMS.test(text)) {
    return { serviceCategory: "one_off", isSubscriptionEmail: false };
  }

  if (hasMoneyEvidence && UTILITY_TERMS.test(text)) {
    return { serviceCategory: "utility", isSubscriptionEmail: true };
  }

  if (hasMoneyEvidence && ONGOING_TERMS.test(text)) {
    return { serviceCategory: "subscription", isSubscriptionEmail: true };
  }

  return { serviceCategory: "other", isSubscriptionEmail: false };
}
