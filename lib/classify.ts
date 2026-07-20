import { classificationSchema, type CandidateEmail, type Classification } from "@/lib/types";
import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

const SYSTEM_PROMPT = `You classify a single shortlisted email for a subscription-management app.
Extract only facts supported by the supplied email. Never infer or invent an amount, currency, or date; use null when unavailable.
Status is only a prediction: cancellation messages are possibly_cancelled, strong recent billing/renewal evidence is possibly_active, and ambiguous evidence is needs_review.
The evidenceSnippet must be a brief exact or near-exact phrase from the supplied snippet and must not contain facts absent from it.`;

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
