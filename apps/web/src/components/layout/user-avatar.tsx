"use client";

import { useMe } from "@/lib/api/hooks";

function initials(name: string | null | undefined, email: string | undefined): string {
  if (name) {
    const parts = name.trim().split(/\s+/);
    return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
  }
  return (email?.[0] ?? "U").toUpperCase();
}

/** Signed-in user avatar, backed by /me (dev-bypass provides a dev user). */
export function UserAvatar() {
  const { data } = useMe();
  return (
    <div
      title={data?.email ?? "Not signed in"}
      className="from-primary to-accent flex size-9 items-center justify-center rounded-full bg-gradient-to-br text-xs font-semibold text-white"
    >
      {initials(data?.full_name, data?.email)}
    </div>
  );
}
