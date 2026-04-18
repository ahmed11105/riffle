// Server-side admin authentication. Checks the Authorization header
// against the ADMIN_SECRET env var. Used by all admin-write API routes.

export function isAdminRequest(request: Request): boolean {
  const secret = process.env.ADMIN_SECRET;
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
