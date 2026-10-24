import { describe, expect, it } from "vitest";
import { emailConfig, notConfiguredReason } from "./config";
import { EmailProviderError, RATE_LIMITS, classifyResendError, deliver, type DeliverDeps, type DeliveryRecord, type EmailMessage } from "./deliver";

const msg: EmailMessage = { to: "Asha@College.edu", template: "verify-code", subject: "123456 is your code", html: "<p>123456</p>", text: "123456", reveal: { code: "123456" } };

function deps(over: Partial<DeliverDeps> = {}) {
  const rows: DeliveryRecord[] = [];
  const sent: unknown[] = [];
  const d: DeliverDeps = {
    transport: {
      async send(m) {
        sent.push(m);
        return { id: "re_1" };
      },
    },
    from: "Brand <noreply@example.test>",
    fallbackVisible: false,
    recentCount: async (to, template) => rows.filter((r) => r.to === to && r.template === template && r.status !== "rate_limited").length,
    record: async (r) => void rows.push(r),
    ...over,
  };
  return { d, rows, sent };
}

describe("emailConfig", () => {
  it("is configured only when RESEND_API_KEY and EMAIL_FROM are both set (no hardcoded sender)", () => {
    expect(emailConfig({ RESEND_API_KEY: "re_x", NODE_ENV: "production" }, false)).toMatchObject({ configured: false, from: null, fallbackVisible: false });
    expect(emailConfig({ EMAIL_FROM: "A <a@b.c>", NODE_ENV: "production" }, false).configured).toBe(false);
    expect(emailConfig({ RESEND_API_KEY: "re_x", EMAIL_FROM: "A <a@b.c>", NODE_ENV: "production" }, false).configured).toBe(true);
  });
  it("allows the on-screen fallback in demo mode or development only", () => {
    expect(emailConfig({ NODE_ENV: "production" }, true).fallbackVisible).toBe(true);
    expect(emailConfig({ NODE_ENV: "development" }, false).fallbackVisible).toBe(true);
    expect(emailConfig({ NODE_ENV: "production", NEXT_PUBLIC_DEMO_MODE: "true" }, false).fallbackVisible).toBe(true);
    expect(emailConfig({ NODE_ENV: "production" }, false).fallbackVisible).toBe(false);
  });
  it("explains what is missing", () => {
    expect(notConfiguredReason({ apiKey: "re_x", from: null })).toMatch(/EMAIL_FROM/);
    expect(notConfiguredReason({ apiKey: null, from: "a" })).toMatch(/RESEND_API_KEY/);
    expect(notConfiguredReason({ apiKey: "k", from: "a" })).toBeNull();
  });
});

describe("deliver", () => {
  it("sends through the transport and never stores the code", async () => {
    const { d, rows, sent } = deps();
    expect(await deliver(msg, d)).toEqual({ status: "sent", id: "re_1" });
    expect(sent).toHaveLength(1);
    expect(rows[0]).toMatchObject({ to: "asha@college.edu", status: "sent", reveal: null });
  });

  it("not configured + demo/dev: shows the code on screen", async () => {
    const { d, rows } = deps({ transport: null, fallbackVisible: true, notConfiguredReason: "EMAIL_FROM is not set" });
    const res = await deliver(msg, d);
    expect(res).toEqual({ status: "onscreen", reason: "EMAIL_FROM is not set", reveal: { code: "123456" } });
    expect(rows[0]).toMatchObject({ status: "onscreen", reveal: { code: "123456" } });
  });

  it("not configured in production: friendly failure, nothing revealed", async () => {
    const { d, rows } = deps({ from: null, fallbackVisible: false });
    const res = await deliver(msg, d);
    expect(res.status).toBe("failed");
    expect(res.status === "failed" && res.message).toMatch(/couldn't send/);
    expect(rows[0]!.reveal).toBeNull();
  });

  it("unverified sender domain falls back like a missing key", async () => {
    const transport = { send: async () => Promise.reject(new EmailProviderError("domain", "The example.test domain is not verified")) };
    const { d } = deps({ transport, fallbackVisible: true });
    const res = await deliver(msg, d);
    expect(res.status).toBe("onscreen");
    expect(res.status === "onscreen" && res.reason).toMatch(/not verified/);
    const { d: prod } = deps({ transport, fallbackVisible: false });
    expect((await deliver(msg, prod)).status).toBe("failed");
  });

  it("other provider errors are a friendly failure even in demo mode", async () => {
    const { d } = deps({ transport: { send: async () => Promise.reject(new Error("ECONNRESET")) }, fallbackVisible: true });
    expect(await deliver(msg, d)).toMatchObject({ status: "failed", reason: "ECONNRESET" });
  });

  it("rate-limits per recipient and template", async () => {
    const { d, sent } = deps();
    const max = RATE_LIMITS["verify-code"].max;
    for (let i = 0; i < max; i++) expect((await deliver(msg, d)).status).toBe("sent");
    const blocked = await deliver(msg, d);
    expect(blocked.status).toBe("rate_limited");
    expect(sent).toHaveLength(max);
    // A different recipient and a different template are unaffected.
    expect((await deliver({ ...msg, to: "other@college.edu" }, d)).status).toBe("sent");
    expect((await deliver({ ...msg, template: "password-reset" }, d)).status).toBe("sent");
  });
});

describe("classifyResendError", () => {
  it("maps Resend errors to fallback kinds", () => {
    expect(classifyResendError({ name: "validation_error", statusCode: 403, message: "The example.test domain is not verified. Please, add and verify your domain" }).kind).toBe("domain");
    expect(classifyResendError({ name: "validation_error", statusCode: 403, message: "You can only send testing emails to your own email address" }).kind).toBe("domain");
    expect(classifyResendError({ name: "invalid_api_key", statusCode: 401, message: "API key is invalid" }).kind).toBe("key");
    expect(classifyResendError({ name: "application_error", statusCode: 500, message: "boom" }).kind).toBe("other");
  });
});
