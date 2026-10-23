"use server";

import "server-only";
import { z } from "zod";
import { verifyPastedDocument, type VerifyView } from "./verify";

const pasteSchema = z.object({ document: z.string().trim().min(2, "Paste a credential JSON document.").max(64_000) });

/** Public (no session needed): checks a pasted credential JSON against what Proof issued. */
export async function verifyPastedCredential(input: { document: string }): Promise<VerifyView | { error: string }> {
  const parsed = pasteSchema.safeParse(input);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  return verifyPastedDocument(parsed.data.document);
}
