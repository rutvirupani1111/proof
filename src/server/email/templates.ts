/**
 * Branded transactional templates, hand-written HTML (table layout, inline styles, works in Gmail
 * and Outlook) plus a plain-text twin. Pure: every function returns { subject, html, text }.
 * Colours mirror the app tokens: ink #16151a, surface #fffdf8, line #e0dacd, lime #c6f432.
 */
import "server-only";

export type RenderedEmail = { subject: string; html: string; text: string };

const INK = "#16151a";
const MUTED = "#5c5850";
const LINE = "#e0dacd";
const SURFACE = "#fffdf8";
const LIME = "#c6f432";
const LIME_INK = "#0a0b10";
const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,Helvetica,Arial,sans-serif";
const MONO = "'JetBrains Mono',SFMono-Regular,Menlo,Consolas,monospace";

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

function layout(opts: { preheader: string; heading: string; body: string; footer?: string }): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${escapeHtml(opts.heading)}</title></head>
<body style="margin:0;padding:0;background:#f4f1ea;font-family:${FONT};color:${INK}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${escapeHtml(opts.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f1ea;padding:32px 12px">
<tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background:${SURFACE};border:1px solid ${LINE};border-radius:20px">
<tr><td style="padding:28px 32px 0">
<table role="presentation" cellpadding="0" cellspacing="0"><tr>
<td style="width:28px;height:28px;border-radius:999px;background:${LIME};color:${LIME_INK};font-weight:700;font-size:15px;text-align:center;line-height:28px">&#10003;</td>
<td style="padding-left:10px;font-size:18px;font-weight:700;letter-spacing:-0.02em;color:${INK}">Proof</td>
</tr></table>
</td></tr>
<tr><td style="padding:24px 32px 8px">
<h1 style="margin:0;font-size:24px;line-height:1.2;letter-spacing:-0.02em;font-weight:700;color:${INK}">${escapeHtml(opts.heading)}</h1>
</td></tr>
<tr><td style="padding:8px 32px 28px;font-size:15px;line-height:1.6;color:${INK}">${opts.body}</td></tr>
<tr><td style="padding:18px 32px;border-top:1px solid ${LINE};font-size:12px;line-height:1.5;color:${MUTED}">
${opts.footer ?? "You received this because someone used this address on Proof. If that wasn't you, you can ignore this email."}<br>Proof &middot; Hiring on verified work, not resumes.
</td></tr>
</table>
</td></tr></table>
</body></html>`;
}

function button(href: string, label: string): string {
  const h = escapeHtml(href);
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:20px 0"><tr><td style="border-radius:12px;background:${LIME}">
<a href="${h}" style="display:inline-block;padding:12px 22px;font-weight:600;font-size:15px;color:${LIME_INK};text-decoration:none;border-radius:12px">${escapeHtml(label)}</a>
</td></tr></table>
<p style="margin:0;font-size:12px;color:${MUTED}">Or paste this link into your browser:<br><a href="${h}" style="color:#5b3fd6;word-break:break-all">${h}</a></p>`;
}

function codeBlock(code: string): string {
  return `<div style="margin:20px 0;padding:16px;border:1px solid ${LINE};border-radius:14px;background:#ffffff;text-align:center;font-family:${MONO};font-size:32px;font-weight:700;letter-spacing:0.35em;color:${INK}">${escapeHtml(code)}</div>`;
}

const p = (s: string) => `<p style="margin:0 0 12px">${s}</p>`;
const muted = (s: string) => `<p style="margin:0 0 12px;font-size:13px;color:${MUTED}">${s}</p>`;

export function verifyCodeEmail({ code, minutes }: { code: string; minutes: number }): RenderedEmail {
  return {
    subject: `${code} is your Proof verification code`,
    html: layout({
      preheader: `Your code is ${code}. It expires in ${minutes} minutes.`,
      heading: "Confirm your email",
      body: p("Enter this code on Proof to verify your email address and open your portal.") + codeBlock(code) + muted(`The code expires in ${minutes} minutes and works once.`),
    }),
    text: `Confirm your email on Proof\n\nYour verification code: ${code}\n\nIt expires in ${minutes} minutes and works once.\nIf you didn't create a Proof account, ignore this email.`,
  };
}

export function passwordResetEmail({ code, minutes }: { code: string; minutes: number }): RenderedEmail {
  return {
    subject: `${code} is your Proof password reset code`,
    html: layout({
      preheader: `Reset code ${code}. It expires in ${minutes} minutes.`,
      heading: "Reset your password",
      body:
        p("Someone (hopefully you) asked to reset the password on your Proof account. Enter this code to choose a new one.") +
        codeBlock(code) +
        muted(`The code expires in ${minutes} minutes. Resetting signs you out on every other device.`),
      footer: "If you didn't ask to reset your password, ignore this email: your password stays the same.",
    }),
    text: `Reset your Proof password\n\nYour reset code: ${code}\n\nIt expires in ${minutes} minutes. Resetting signs you out on every other device.\nIf you didn't ask for this, ignore this email.`,
  };
}

export function domainLinkEmail({ link, domain, what, minutes }: { link: string; domain: string; what: string; minutes: number }): RenderedEmail {
  return {
    subject: `Verify ${what} on Proof`,
    html: layout({
      preheader: `Confirm you can receive email at @${domain}.`,
      heading: `Verify @${domain}`,
      body:
        p(`Open this link within ${minutes} minutes to verify <strong>@${escapeHtml(domain)}</strong> as ${escapeHtml(what)} on Proof. Open it in the browser where you're signed in.`) +
        button(link, `Verify @${domain}`) +
        muted("The link works once."),
    }),
    text: `Verify @${domain} on Proof\n\nOpen this link within ${minutes} minutes to verify ${what}:\n${link}\n\nThe link works once. If you didn't ask for this, ignore this email.`,
  };
}

export function welcomeEmail({ name, portalUrl, role }: { name: string; portalUrl: string; role: string }): RenderedEmail {
  const first = name.trim().split(/\s+/)[0] || "there";
  const next: Record<string, string> = {
    student: "Connect GitHub, add a repo and watch your Proof Score build from verified work.",
    recruiter: "Verify your company domain, then search candidates by what they've actually built.",
    college: "Verify your college domain, then invite your cohort and plan drives.",
    mentor: "Verify your institutional domain so your endorsements carry weight.",
  };
  return {
    subject: "Welcome to Proof",
    html: layout({
      preheader: "Your email is verified. Here's where to start.",
      heading: `Welcome, ${first}`,
      body: p("Your email is verified and your account is ready.") + p(escapeHtml(next[role] ?? "Open your portal to get started.")) + button(portalUrl, "Open Proof"),
      footer: "You're receiving this one-time welcome because you created a Proof account.",
    }),
    text: `Welcome to Proof, ${first}\n\nYour email is verified and your account is ready.\n${next[role] ?? "Open your portal to get started."}\n\n${portalUrl}`,
  };
}

export function newMessageEmail({ senderName, senderOrg, preview, threadUrl, settingsUrl }: { senderName: string; senderOrg?: string | null; preview: string; threadUrl: string; settingsUrl: string }): RenderedEmail {
  const from = senderOrg ? `${senderName} (${senderOrg})` : senderName;
  const short = preview.length > 280 ? `${preview.slice(0, 277)}...` : preview;
  return {
    subject: `New message from ${from} on Proof`,
    html: layout({
      preheader: short.slice(0, 120),
      heading: "You have a new message",
      body:
        p(`<strong>${escapeHtml(from)}</strong> wrote to you:`) +
        `<blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid ${LIME};background:#ffffff;border-radius:8px;color:${INK};white-space:pre-wrap">${escapeHtml(short)}</blockquote>` +
        button(threadUrl, "Reply on Proof"),
      footer: `Turn off message emails in <a href="${escapeHtml(settingsUrl)}" style="color:${MUTED}">notification settings</a>.`,
    }),
    text: `${from} wrote to you on Proof:\n\n${short}\n\nReply: ${threadUrl}\n\nTurn off message emails: ${settingsUrl}`,
  };
}
