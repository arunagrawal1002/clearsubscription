import type { CandidateEmail, Subscription } from "@/lib/types";

function dateInDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

const demoRenewals: Record<string, string | null> = {
  "demo-fitlife": dateInDays(3),
  "demo-streamplus": dateInDays(8),
  "demo-designcloud-old": dateInDays(12),
  "demo-designcloud": dateInDays(12),
  "demo-cloudbox": null,
  "demo-learnnow": null,
};

export const demoEmails: CandidateEmail[] = [
  { id: "demo-fitlife", subject: "Your FitLife Gym membership is active", sender: "FitLife Gym <hello@fitlife.example>", receivedDate: "2026-07-03T09:00:00Z", snippet: "Thanks for being a FitLife member. Your monthly membership payment of $34.99 was received on July 3, 2026. Your next billing date is August 3, 2026." },
  { id: "demo-streamplus", subject: "Your StreamPlus renewal receipt", sender: "StreamPlus <billing@streamplus.example>", receivedDate: "2026-07-12T11:20:00Z", snippet: "We received your payment of $15.99 for StreamPlus Premium. Your monthly plan renews on August 12, 2026." },
  { id: "demo-designcloud-old", subject: "DesignCloud Pro price update", sender: "DesignCloud <team@designcloud.example>", receivedDate: "2026-06-14T08:15:00Z", snippet: "The yearly price for DesignCloud Pro will increase to $240.00 at your next renewal on September 2, 2026." },
  { id: "demo-designcloud", subject: "Reminder: DesignCloud Pro renews soon", sender: "DesignCloud <billing@designcloud.example>", receivedDate: "2026-07-15T08:15:00Z", snippet: "Your DesignCloud Pro yearly subscription is scheduled to renew for $240.00 on September 2, 2026." },
  { id: "demo-cloudbox", subject: "CloudBox Storage cancellation confirmed", sender: "CloudBox Storage <support@cloudbox.example>", receivedDate: "2026-07-08T16:40:00Z", snippet: "Your CloudBox Storage 2 TB plan has been cancelled. You will keep access until July 31, 2026 and will not be charged again." },
  { id: "demo-learnnow", subject: "Your LearnNow free trial ends soon", sender: "LearnNow Academy <trials@learnnow.example>", receivedDate: "2026-07-18T07:05:00Z", snippet: "Your LearnNow Academy trial ends July 25, 2026. After that, your selected monthly plan may begin. Visit your account to review your choice." },
];

const details = [
  ["demo-fitlife", "FitLife Gym", "All Access Membership", "payment_receipt", "subscription", 34.99, "USD", "monthly", "2026-07-03", "2026-08-03", null, "possibly_active", .98],
  ["demo-streamplus", "StreamPlus", "Premium", "renewal_reminder", "subscription", 15.99, "USD", "monthly", "2026-07-12", "2026-08-12", null, "possibly_active", .97],
  ["demo-designcloud-old", "DesignCloud Pro", "Professional Plan", "price_increase", "subscription", 240, "USD", "yearly", null, "2026-09-02", null, "possibly_active", .91],
  ["demo-designcloud", "DesignCloud Pro", "Professional Plan", "renewal_reminder", "subscription", 240, "USD", "yearly", null, "2026-09-02", null, "possibly_active", .96],
  ["demo-cloudbox", "CloudBox Storage", "2 TB Plan", "cancellation", "subscription", null, null, "monthly", null, null, null, "possibly_cancelled", .99],
  ["demo-learnnow", "LearnNow Academy", "Monthly Learning Plan", "trial_ending", "subscription", null, null, "unknown", null, null, "2026-07-25", "needs_review", .88],
] as const;

export const demoSubscriptions: Subscription[] = demoEmails.map((email, index) => {
  const row = details[index];
  return {
    id: row[0], sourceEmailId: email.id, subject: email.subject, sender: email.sender, receivedDate: email.receivedDate,
    isSubscriptionEmail: true, provider: row[1], subscriptionName: row[2], emailType: row[3], serviceCategory: row[4], amount: row[5], currency: row[6], billingFrequency: row[7],
    paymentDate: row[8], renewalDate: demoRenewals[email.id] ?? row[9], trialEndDate: row[10], possibleStatus: row[11], confidence: row[12], evidenceSnippet: email.snippet,
    userStatus: ["demo-fitlife", "demo-streamplus", "demo-designcloud"].includes(email.id) ? "active" : email.id === "demo-cloudbox" ? "not_sure" : null,
    duplicateCount: 1, isDemo: true,
  };
});
