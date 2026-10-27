// filename: lib/auth/provider.ts
import "server-only";
import { cookies } from "next/headers";
import { firebaseAdmin } from "./admin";
import { OnyxStore } from "../repository";
import { AppError } from "../domain";
export const sessionCookie = "cms_session";
export type EditorSession = {
  userId: string;
  name: string;
  roles: ("administrator" | "editor" | "author")[];
};
export async function readVerifiedSession(): Promise<EditorSession | null> {
  if (
    !process.env.FIREBASE_PROJECT_ID &&
    !process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
  )
    throw new AppError(
      503,
      "Configure application Firebase and bootstrap an administrator before opening the CMS.",
    );
  const token = (await cookies()).get(sessionCookie)?.value;
  if (!token) return null;
  let user;
  try {
    const auth = firebaseAdmin(),
      claims = await auth.verifySessionCookie(token, true);
    user = await auth.getUser(claims.uid);
  } catch {
    return null;
  }
  if (user.disabled || !user.emailVerified || !user.email) return null;
  const grant = await new OnyxStore().get("CMSUser", user.uid);
  if (!grant?.active || grant.email.toLowerCase() !== user.email.toLowerCase())
    throw new AppError(
      403,
      "Your verified account needs an active CMS role. Ask the site administrator.",
    );
  return { userId: user.uid, name: grant.name, roles: [grant.role] };
}
