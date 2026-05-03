# Riffle email templates

These five templates correspond to the Supabase Auth → Email Templates entries we use. Each one is standalone HTML, table-based, with all styles inlined so it renders consistently across Gmail, Outlook, Apple Mail, and ProtonMail.

## How to apply

1. Open the [Supabase dashboard](https://supabase.com/dashboard/project/fdmabluqxpmhgempvtig/auth/templates) for the Riffle project
2. For each template below, copy the **Subject** + the contents of the matching `.html` file into the Subject and Message fields
3. Click **Save**

## Templates

| File | Subject | When it fires |
|---|---|---|
| `magic-link.html` | Your sign-in link for Riffle | `signInWithOtp` — sign-in for an email that already exists |
| `confirm-signup.html` | Welcome to Riffle — confirm your email | `signUp` / `signInWithOtp` for a brand-new email |
| `invite-user.html` | A friend invited you to Riffle | `auth.admin.inviteUserByEmail` — used by the in-app invite-a-friend feature |
| `change-email.html` | Confirm your new email for Riffle | `updateUser({ email })` — sent to BOTH old and new addresses if Confirm-changes is on |
| `reauthentication.html` | Confirm it's you on Riffle | `reauthenticate()` — used as a step-up before account deletion |

We don't customize **Reset Password** because Riffle doesn't use passwords (magic-link only).

## Where each one comes from in the app

- `signInWithOtp` is called from `src/lib/auth/AuthProvider.tsx#signInWithEmail` when the user is fully signed out
- `updateUser({ email })` is called from the same function when an anonymous user provides an email (anonymous → permanent upgrade)
- `inviteUserByEmail` is called from `src/app/api/account/invite-friend/route.ts` (the email-input on the /invite page)
- `reauthenticate()` is called from `src/app/api/account/reauth/route.ts` before `account.delete` will execute
