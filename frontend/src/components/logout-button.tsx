"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={handleLogout}
      className="size-8 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
      aria-label="Sair"
    >
      <LogOut className="size-4" />
    </button>
  );
}
