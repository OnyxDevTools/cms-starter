// filename: app/(public)/layout.tsx
import type { ReactNode } from "react";
import { PublicShell } from "@/components/shell";
export const dynamic = "force-dynamic";
export const revalidate = 0;
export default function Layout({ children }: { children: ReactNode }) {
  return <PublicShell>{children}</PublicShell>;
}
