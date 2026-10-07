"use client";

import { SessionProvider } from "next-auth/react";
import type { ReactNode } from "react";

/**
 * PROVIDERS — klientni SessionProvider (NextAuth v4) za celotno aplikacijo.
 * "use client" ne moti ThemeProviderja (next-themes), ki ostaja v
 * [locale]/layout.tsx zunaj te komponente.
 */
export function Providers({ children }: { children: ReactNode }) {
  return <SessionProvider>{children}</SessionProvider>;
}
