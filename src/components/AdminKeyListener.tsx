"use client";

import { useAdminKeySequence } from "@/lib/admin";

export function AdminKeyListener() {
  useAdminKeySequence();
  return null;
}
