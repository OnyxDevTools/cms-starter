// filename: lib/auth/index.ts
import "server-only";
import { cache } from "react";
import { readVerifiedSession } from "./provider";
import { AppError } from "../domain";
export const requireEditor = cache(async () => {
  const session = await readVerifiedSession();
  if (!session) throw new AppError(401, "Sign in to continue.");
  return session;
});
