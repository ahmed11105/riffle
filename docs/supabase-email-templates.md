# Supabase email templates

Paste these into **Supabase Dashboard → Authentication → Email Templates** for a branded experience that doesn't look like phishing.

## Magic Link

**Subject**: `Your sign-in link for Riffle`

**Body** (HTML):

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Sign in to Riffle</title>
  </head>
  <body style="margin:0;padding:0;background-color:#1a140c;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#fef3c7;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#1a140c;">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;background-color:#fafaf9;border:4px solid #1c1917;border-radius:24px;box-shadow:0 8px 0 0 rgba(0,0,0,0.9);">
            <tr>
              <td style="padding:32px 32px 8px 32px;text-align:center;">
                <div style="display:inline-block;width:52px;height:52px;line-height:52px;border-radius:14px;border:2px solid #1c1917;background-color:#fbbf24;color:#1c1917;font-weight:900;font-size:28px;box-shadow:0 4px 0 0 rgba(0,0,0,0.9);">R</div>
                <h1 style="margin:20px 0 0 0;color:#1c1917;font-size:28px;font-weight:900;letter-spacing:-0.5px;">Sign in to Riffle</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:8px 32px 24px 32px;color:#44403c;font-size:16px;line-height:1.5;">
                <p style="margin:16px 0 0 0;">
                  Tap the button below to sign in to your Riffle account.
                  This link expires in <strong>1 hour</strong> and can only be used once.
                </p>
              </td>
            </tr>
            <tr>
              <td align="center" style="padding:0 32px 8px 32px;">
                <a href="{{ .ConfirmationURL }}"
                   style="display:inline-block;padding:14px 28px;background-color:#fbbf24;color:#1c1917;text-decoration:none;font-weight:900;font-size:16px;border:4px solid #1c1917;border-radius:999px;box-shadow:0 4px 0 0 rgba(0,0,0,0.9);">
                  Sign in to Riffle
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 8px 32px;color:#78716c;font-size:13px;line-height:1.5;">
                <p style="margin:0;">
                  Button not working? Copy this link into your browser:
                </p>
                <p style="margin:8px 0 0 0;word-break:break-all;color:#44403c;">
                  <a href="{{ .ConfirmationURL }}" style="color:#b45309;text-decoration:underline;">{{ .ConfirmationURL }}</a>
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:24px 32px 32px 32px;color:#78716c;font-size:12px;line-height:1.5;border-top:2px solid #e7e5e4;">
                <p style="margin:0;">
                  Didn't request this? You can safely ignore this email — no
                  one can sign in without clicking the link above.
                </p>
                <p style="margin:12px 0 0 0;">
                  Riffle · daily song-guessing game · <a href="https://riffle.cc" style="color:#b45309;text-decoration:underline;">riffle.cc</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
```

## Confirm signup

If you ever enable signups with email confirmation (you don't currently — magic links handle it), use the same shell with the heading "Confirm your Riffle account" and the body "Tap below to finish creating your account."

## Reset password

Same — only relevant if you add password auth later. Heading: "Reset your Riffle password".

## Custom SMTP (so the From address is support@riffle.cc)

Without custom SMTP, the From is a Supabase default like `noreply@mail.app.supabase.io` and emails get spam-flagged. To send from `support@riffle.cc`:

1. Sign up free at https://resend.com (3,000 emails/mo free, 100/day)
2. Resend → **Domains** → Add Domain → enter `riffle.cc`
3. Resend gives you 3 DNS records (SPF, DKIM, MX). Add them in Cloudflare DNS.
4. Wait for verification (1–10 min), test with Resend's "Send test email".
5. Resend → **API Keys** → create one.
6. Supabase → **Authentication → SMTP Settings**:
   - Enable Custom SMTP
   - Host: `smtp.resend.com`
   - Port: `587`
   - Username: `resend`
   - Password: your Resend API key
   - Sender email: `support@riffle.cc`
   - Sender name: `Riffle`
7. Save. Test by sending yourself another magic link.

After this, your magic-link emails arrive from `support@riffle.cc` with the branded HTML above and full SPF/DKIM auth → no more spam folder.
