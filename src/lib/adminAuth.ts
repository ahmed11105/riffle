// Server-side admin authentication. Checks the Authorization header
// against the ADMIN_SECRET env var. Used by all admin-write API routes.
//
// Trims the env value before comparing because pasting a secret into
// the Vercel dashboard can leave a trailing newline that silently
// breaks every admin endpoint until someone notices the off-by-one
// mismatch.

export function isAdminRequest(request: Request): boolean {
  const secret = process.env.ADMIN_SECRET?.trim();
  if (!secret) return false;
  const auth = request.headers.get("Authorization");
  if (!auth) return false;
  return auth === `Bearer ${secret}`;
}

export function unauthorizedResponse() {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "Content-Type": "application/json" },
  });
}
