// filename: app/sign-in/page.tsx
import { AuthForm } from "@/admin/auth-form";
export const metadata = {
  title: "Sign in · CMS Starter",
  robots: { index: false, follow: false },
};
export default function SignIn() {
  return (
    <main id="main" className="auth-shell">
      <a className="cms-brand" href="/">
        c / CMS Starter
      </a>
      <p className="eyebrow">The editorial desk</p>
      <h1>Welcome back.</h1>
      <p>Sign in with your verified editorial account.</p>
      <AuthForm />
      <p className="muted">
        Your administrator manages access. New sites: follow the Firebase setup
        and controlled administrator bootstrap in README.md.
      </p>
    </main>
  );
}
