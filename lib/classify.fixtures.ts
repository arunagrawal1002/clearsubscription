import type { CandidateEmail, Classification } from "@/lib/types";

export type ClassificationFixture = Pick<CandidateEmail, "subject" | "sender" | "snippet"> & {
  name: string;
  expected: Pick<Classification, "serviceCategory" | "isSubscriptionEmail">;
};

/**
 * Anonymised real-mail patterns used to evaluate the classification policy.
 * These stay offline: no fixture ever calls the model or requires credentials.
 */
export const classificationFixtures: ClassificationFixture[] = [
  { name: "paid SaaS receipt", subject: "Your monthly plan receipt", sender: "Acme Notes <billing@acmenotes.example>", snippet: "We charged your card $12.00 for the Pro plan. Your monthly subscription renews on 15 August.", expected: { serviceCategory: "subscription", isSubscriptionEmail: true } },
  { name: "free newsletter", subject: "The weekly product digest", sender: "Example Digest <hello@digest.example>", snippet: "Free ideas for your team. Manage your subscription preferences or unsubscribe at any time.", expected: { serviceCategory: "other", isSubscriptionEmail: false } },
  { name: "broadband bill", subject: "Your fibre broadband bill", sender: "Northline Fibre <billing@northline.example>", snippet: "Your monthly broadband bill of Rs. 899 is due on 10 August.", expected: { serviceCategory: "utility", isSubscriptionEmail: true } },
  { name: "insurance renewal", subject: "Policy renewal premium due", sender: "Harbor Insurance <renewals@harbor.example>", snippet: "Your annual insurance premium of INR 14,200 is due before your policy renewal date.", expected: { serviceCategory: "utility", isSubscriptionEmail: true } },
  { name: "one-off invoice", subject: "Invoice for repair visit", sender: "City Repairs <invoices@repairs.example>", snippet: "This is a one-time invoice for the completed repair. Amount due: Rs. 1,500.", expected: { serviceCategory: "one_off", isSubscriptionEmail: false } },
  { name: "trial ending with conversion", subject: "Your trial ends in three days", sender: "SketchPad <team@sketchpad.example>", snippet: "Your free trial ends on 12 August. Your card will be charged $9 per month unless you cancel.", expected: { serviceCategory: "subscription", isSubscriptionEmail: true } },
  { name: "paid cancellation", subject: "Your membership has been cancelled", sender: "FitSpace <support@fitspace.example>", snippet: "We cancelled your paid monthly membership. No further payment of $29 will be taken.", expected: { serviceCategory: "subscription", isSubscriptionEmail: true } },
  { name: "music renewal", subject: "Membership renewal confirmation", sender: "Wave Music <receipts@wave.example>", snippet: "Your annual music membership renewed. Payment of $99 was successful.", expected: { serviceCategory: "subscription", isSubscriptionEmail: true } },
  { name: "electricity bill", subject: "Electricity bill for July", sender: "Metro Power <accounts@metropower.example>", snippet: "Your electricity charges for this billing period are Rs. 2,180. Pay by 20 August.", expected: { serviceCategory: "utility", isSubscriptionEmail: true } },
  { name: "account security notice", subject: "New sign-in to your account", sender: "Cloud Desk <security@clouddesk.example>", snippet: "We noticed a sign-in from a new device. Review your account security settings.", expected: { serviceCategory: "other", isSubscriptionEmail: false } },
  { name: "marketing offer", subject: "Save 40% on an upgrade", sender: "Code Tools <offers@codetools.example>", snippet: "Limited-time offer: save 40% when you start a plan today. No purchase has been made.", expected: { serviceCategory: "other", isSubscriptionEmail: false } },
  { name: "cloud storage renewal", subject: "Annual storage plan payment received", sender: "Boxed Storage <billing@boxed.example>", snippet: "We received your payment of $120 for 12 months of cloud storage.", expected: { serviceCategory: "subscription", isSubscriptionEmail: true } },
  { name: "water utility bill", subject: "Water service bill", sender: "River Water <billing@riverwater.example>", snippet: "Your water bill is INR 640 for the current monthly service period.", expected: { serviceCategory: "utility", isSubscriptionEmail: true } },
  { name: "gym membership charge", subject: "Monthly membership payment", sender: "Corner Gym <payments@cornergym.example>", snippet: "Your monthly gym membership payment of Rs. 1,999 was received.", expected: { serviceCategory: "subscription", isSubscriptionEmail: true } },
  { name: "shipping update", subject: "Your order is on its way", sender: "Parcel Shop <orders@parcelshop.example>", snippet: "Your one-time order has shipped. Track your delivery with the link below.", expected: { serviceCategory: "other", isSubscriptionEmail: false } },
];
