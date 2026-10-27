// filename: lib/config.ts
import { z } from "zod";
export function applicationEnvironment() {
  const value = z
    .enum(["development", "preview", "production"])
    .parse(
      process.env.APP_ENV ||
        (process.env.NODE_ENV === "production" ? "production" : "development"),
    );
  return process.env.NODE_ENV === "production" && value === "development"
    ? "production"
    : value;
}
