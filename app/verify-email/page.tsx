// filename: app/verify-email/page.tsx
import { VerificationControls } from "@/admin/auth-form";
export const metadata = { robots: { index: false, follow: false } };
export default function Verify() {
  return (
    <main className="auth-shell">
      <h1>Verify your email</h1>
      <VerificationControls />
    </main>
  );
}
