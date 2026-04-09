"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { hasDemoSession, subscribeDemoSession } from "@/lib/service";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [hasSession, setHasSession] = useState(() => hasDemoSession());

  useEffect(() => subscribeDemoSession(() => setHasSession(hasDemoSession())), []);

  useEffect(() => {
    if (pathname !== "/login" && !hasSession) {
      router.replace("/login");
    }
  }, [hasSession, pathname, router]);

  if (pathname !== "/login" && !hasSession) {
    return null;
  }
  return <>{children}</>;
}
