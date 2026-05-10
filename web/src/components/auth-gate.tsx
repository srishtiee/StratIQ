"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { hasAuthSession, subscribeAuthSession } from "@/lib/service";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [, bump] = useState(0);

  useEffect(() => {
    queueMicrotask(() => setReady(true));
    return subscribeAuthSession(() => bump((n) => n + 1));
  }, []);

  const session = hasAuthSession();

  useEffect(() => {
    if (!ready) {
      return;
    }
    if (pathname !== "/login" && !session) {
      router.replace("/login");
    }
  }, [ready, session, pathname, router]);

  if (!ready) {
    return null;
  }

  if (pathname !== "/login" && !session) {
    return null;
  }
  return <>{children}</>;
}
