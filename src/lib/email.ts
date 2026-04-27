// Mailgun email service
const MAILGUN_API_KEY = process.env.MAILGUN_API_KEY || "";
const MAILGUN_DOMAIN = process.env.MAILGUN_DOMAIN || "";
const FROM_EMAIL = `Hostyo <noreply@${MAILGUN_DOMAIN}>`;

export async function sendEmail({ to, subject, html }: { to: string; subject: string; html: string }) {
  if (!MAILGUN_API_KEY || !MAILGUN_DOMAIN) {
    console.error("Mailgun not configured");
    return false;
  }

  try {
    const form = new URLSearchParams();
    form.append("from", FROM_EMAIL);
    form.append("to", to);
    form.append("subject", subject);
    form.append("html", html);

    const res = await fetch(`https://api.eu.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64"),
      },
      body: form,
    });

    if (!res.ok) {
      // Try US region if EU fails
      const resUS = await fetch(`https://api.mailgun.net/v3/${MAILGUN_DOMAIN}/messages`, {
        method: "POST",
        headers: {
          "Authorization": "Basic " + Buffer.from(`api:${MAILGUN_API_KEY}`).toString("base64"),
        },
        body: form,
      });
      if (!resUS.ok) {
        const err = await resUS.text();
        console.error("Mailgun error:", err);
        return false;
      }
    }

    return true;
  } catch (error) {
    console.error("Email send error:", error);
    return false;
  }
}

export function generateCode(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

export function verificationEmailHtml(code: string, name: string) {
  return `
    <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px">
      <div style="text-align:center;margin-bottom:30px">
        <div style="font-size:18px;font-weight:700;color:#80020E">HOSTYO</div>
      </div>
      <div style="background:#fff;border:1px solid #eee;border-radius:12px;padding:32px;text-align:center">
        <h2 style="font-size:20px;font-weight:700;color:#111;margin-bottom:8px">Verify your email</h2>
        <p style="font-size:14px;color:#666;margin-bottom:24px">Hi ${name}, use this code to verify your email address:</p>
        <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin-bottom:24px">
          <div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#111;font-family:monospace">${code}</div>
        </div>
        <p style="font-size:12px;color:#999">This code expires in 1 minute.</p>
      </div>
      <p style="text-align:center;font-size:11px;color:#bbb;margin-top:20px">HOSTYO LTD · 20 Dimotikis Agoras, Larnaca, Cyprus</p>
    </div>
  `;
}

export function loginCodeEmailHtml(code: string, name: string) {
  return `
    <div style="font-family:-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:40px 20px">
      <div style="text-align:center;margin-bottom:30px">
        <div style="font-size:18px;font-weight:700;color:#80020E">HOSTYO</div>
      </div>
      <div style="background:#fff;border:1px solid #eee;border-radius:12px;padding:32px;text-align:center">
        <h2 style="font-size:20px;font-weight:700;color:#111;margin-bottom:8px">Login verification</h2>
        <p style="font-size:14px;color:#666;margin-bottom:24px">Hi ${name}, here&apos;s your login verification code:</p>
        <div style="background:#f8f8f8;border-radius:8px;padding:16px;margin-bottom:24px">
          <div style="font-size:32px;font-weight:700;letter-spacing:8px;color:#111;font-family:monospace">${code}</div>
        </div>
        <p style="font-size:12px;color:#999">This code expires in 1 minute. If you didn&apos;t request this, please ignore.</p>
      </div>
      <p style="text-align:center;font-size:11px;color:#bbb;margin-top:20px">HOSTYO LTD · 20 Dimotikis Agoras, Larnaca, Cyprus</p>
    </div>
  `;
}
