import { describe, expect, it } from "vitest";
import { passwordStrength } from "@/lib/password-strength";
import { domainLinkEmail, escapeHtml, newMessageEmail, passwordResetEmail, verifyCodeEmail, welcomeEmail } from "./templates";

describe("email templates", () => {
  it("verify code: code in subject, html and text", () => {
    const e = verifyCodeEmail({ code: "482913", minutes: 10 });
    expect(e.subject).toBe("482913 is your Proof verification code");
    expect(e.html).toContain("482913");
    expect(e.html).toContain("<!doctype html>");
    expect(e.text).toContain("482913");
    expect(e.text).toContain("10 minutes");
  });

  it("password reset mentions signing out elsewhere", () => {
    const e = passwordResetEmail({ code: "000111", minutes: 10 });
    expect(e.subject).toMatch(/password reset code/);
    expect(e.text).toMatch(/every other device/);
  });

  it("domain link renders the button and the raw link, escaped", () => {
    const link = "https://app.example/mentor/verify?token=a&b=1";
    const e = domainLinkEmail({ link, domain: "college.edu", what: "your mentor domain", minutes: 30 });
    expect(e.html).toContain('href="https://app.example/mentor/verify?token=a&amp;b=1"');
    expect(e.text).toContain(link);
    expect(e.subject).toBe("Verify your mentor domain on Proof");
  });

  it("welcome uses the first name and the portal link", () => {
    const e = welcomeEmail({ name: "Ishita Varma", role: "student", portalUrl: "https://app.example/student" });
    expect(e.html).toContain("Welcome, Ishita");
    expect(e.text).toContain("https://app.example/student");
  });

  it("new message escapes user content and truncates long previews", () => {
    const e = newMessageEmail({ senderName: "Meera <script>", senderOrg: "Kitecode", preview: "x".repeat(400), threadUrl: "https://a/t", settingsUrl: "https://a/s" });
    expect(e.html).not.toContain("<script>");
    expect(e.html).toContain("Meera &lt;script&gt;");
    expect(e.text).toContain(`${"x".repeat(277)}...`);
    expect(e.text).toContain("https://a/s");
  });

  it("escapeHtml covers the five specials", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});

describe("passwordStrength", () => {
  it("scores short, common and strong passwords", () => {
    expect(passwordStrength("abc").score).toBe(0);
    expect(passwordStrength("password123").score).toBe(1);
    expect(passwordStrength("Tr0ub4dor&3-horse-staple").score).toBe(4);
  });
});
