"use client";
// filename: admin/sign-out.tsx
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
export function SignOut() {
  const [error, setError] = useState(""),
    router = useRouter();
  return (
    <>
      <Button
        variant="outline"
        onClick={async () => {
          try {
            const r = await fetch("/api/auth/sign-out", { method: "POST" });
            if (!r.ok) throw new Error();
            router.push("/sign-in");
            router.refresh();
          } catch {
            setError("Sign out failed. Try again.");
          }
        }}
      >
        Sign out
      </Button>
      {error && <p role="alert">{error}</p>}
    </>
  );
}
