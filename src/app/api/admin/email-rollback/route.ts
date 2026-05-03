import { NextResponse } from "next/server";
import { isAdminRequest, unauthorizedResponse } from "@/lib/adminAuth";
import { createAdminClient } from "@/lib/supabase/admin";

// Admin email rollback. Two endpoints behind the same path:
//
//   GET  ?email=alice@example.com
//        Look up which user_id has (or had) that email. Returns the
//        full email_change_audit history so the admin can see the
//        chain of swaps.
//
//   POST { user_id, target_email, reason }
//        Force the auth.users row's email back to target_email. The
//        existing log_email_change trigger writes a new audit row
//        for the revert — and we also stamp reverted_at + reason on
//        the most recent prior audit row for traceability.
//
// Auth is the standard ADMIN_SECRET header check (same pattern as
// /api/admin/reset-progress).

export async function GET(req: Request) {
  if (!isAdminRequest(req)) return unauthorizedResponse();

  const url = new URL(req.url);
  const email = url.searchParams.get("email")?.trim().toLowerCase();
  if (!email) {
    return NextResponse.json({ error: "missing email" }, { status: 400 });
  }

  const admin = createAdminClient();

  // Find via current email through the security-definer RPC.
  const { data: currentRow } = await admin.rpc("admin_find_user_by_email", {
    p_email: email,
  });

  // Audit history for any address that was attached at some point.
  const { data: history } = await admin
    .from("email_change_audit")
    .select("*")
    .or(`old_email.ilike.${email},new_email.ilike.${email}`)
    .order("changed_at", { ascending: false });

  return NextResponse.json({
    current: currentRow ?? [],
    history: history ?? [],
  });
}

export async function POST(req: Request) {
  if (!isAdminRequest(req)) return unauthorizedResponse();

  let body: { user_id?: string; target_email?: string; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const userId = body.user_id?.trim();
  const targetEmail = body.target_email?.trim().toLowerCase();
  const reason = body.reason?.trim() ?? "admin rollback";
  if (!userId || !targetEmail) {
    return NextResponse.json(
      { error: "user_id and target_email required" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Force the email back. updateUserById bypasses the user-confirmation
  // flow because it's running as service role.
  const { data, error } = await admin.auth.admin.updateUserById(userId, {
    email: targetEmail,
    email_confirm: true,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  // Stamp the most recent prior audit row as reverted.
  await admin
    .from("email_change_audit")
    .update({
      reverted_at: new Date().toISOString(),
      reason,
    })
    .eq("user_id", userId)
    .is("reverted_at", null)
    .order("changed_at", { ascending: false })
    .limit(1);

  return NextResponse.json({
    ok: true,
    user_id: data.user?.id,
    email: data.user?.email,
  });
}
