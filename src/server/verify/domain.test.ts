import { describe, expect, it } from "vitest";
import {
  confirmPathFor,
  hashToken,
  identifierFor,
  institutionalEmailProblem,
  isFreeMailDomain,
  mintToken,
  parseToken,
  secretMatches,
} from "./domain-rules";

describe("free-mail detection", () => {
  it.each(["gmail.com", "yahoo.co.in", "outlook.in", "hotmail.co.uk", "proton.me", "protonmail.com", "rediffmail.com", "zoho.com", "gmx.net", "icloud.com", "live.com"])(
    "rejects %s",
    (d) => expect(isFreeMailDomain(d)).toBe(true),
  );
  it.each(["spit-surat.example", "kitecode.example", "iitb.ac.in", "company.co.in"])("accepts %s", (d) =>
    expect(isFreeMailDomain(d)).toBe(false),
  );
  it("explains why a personal address cannot prove an institution", () => {
    expect(institutionalEmailProblem("someone@gmail.com")).toMatch(/personal mailbox/);
    expect(institutionalEmailProblem("prof@spit-surat.example")).toBeNull();
    expect(institutionalEmailProblem("not-an-email")).toMatch(/valid email/);
  });
});

describe("magic-link tokens", () => {
  it("scopes the stored identifier by purpose and user", () => {
    expect(identifierFor("mentor", "u_123")).toBe("domain:mentor:u_123");
    expect(identifierFor("company", "u_123")).not.toBe(identifierFor("mentor", "u_123"));
  });

  it("round-trips purpose and user id, and never stores the secret", () => {
    const { token, hash } = mintToken("mentor", "4b1c-uuid-with-dashes");
    const parsed = parseToken(token)!;
    expect(parsed.purpose).toBe("mentor");
    expect(parsed.userId).toBe("4b1c-uuid-with-dashes");
    expect(hash).toBe(hashToken(parsed.secret));
    expect(hash).not.toContain(parsed.secret);
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it("matches only the right secret", () => {
    const { token, hash } = mintToken("college", "u1");
    const { secret } = parseToken(token)!;
    expect(secretMatches(secret, hash)).toBe(true);
    expect(secretMatches(`${secret}x`, hash)).toBe(false);
  });

  it("rejects malformed tokens", () => {
    expect(parseToken("")).toBeNull();
    expect(parseToken("admin.dTE.aaaaaaaaaaaaaaaaaaaaaaaa")).toBeNull();
    expect(parseToken("mentor.dTE.short")).toBeNull();
    expect(parseToken("mentor.dTE.aaaaaaaaaaaaaaaaaaaaaaaa.extra")).toBeNull();
  });

  it("mints a fresh token every time", () => {
    expect(mintToken("mentor", "u1").token).not.toBe(mintToken("mentor", "u1").token);
  });

  it("points each purpose at its confirm page", () => {
    expect(confirmPathFor("mentor")).toBe("/mentor/verify");
    expect(confirmPathFor("company")).toMatch(/^\/recruiter\//);
    expect(confirmPathFor("college")).toMatch(/^\/college\//);
  });
});
