/**
 * Lightweight password strength estimate for the meter on /reset-password (client + server safe).
 * Not a security control: the server only enforces the 8-character minimum.
 */
export type Strength = { score: 0 | 1 | 2 | 3 | 4; label: string; hint: string };

const COMMON = ["password", "123456", "qwerty", "letmein", "welcome", "proof", "iloveyou", "admin", "abc123", "111111"];

export function passwordStrength(pw: string): Strength {
  if (!pw) return { score: 0, label: "", hint: "Use at least 8 characters." };
  if (pw.length < 8) return { score: 0, label: "Too short", hint: `${8 - pw.length} more character${8 - pw.length === 1 ? "" : "s"}.` };
  const lower = pw.toLowerCase();
  if (COMMON.some((c) => lower.includes(c)) || /^(.)\1+$/.test(pw)) {
    return { score: 1, label: "Weak", hint: "Avoid common words and repeated characters." };
  }
  let points = 0;
  if (pw.length >= 12) points++;
  if (pw.length >= 16) points++;
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
  if (classes >= 3) points++;
  if (classes === 4) points++;
  const score = Math.min(4, Math.max(1, points)) as Strength["score"];
  const labels = ["", "Weak", "Fair", "Good", "Strong"] as const;
  const hints: readonly string[] = ["", "Add length or mix in numbers and symbols.", "Longer is stronger: try a short phrase.", "Good. A few more characters makes it strong.", "Strong password."];
  return { score, label: labels[score], hint: hints[score] ?? "" };
}
