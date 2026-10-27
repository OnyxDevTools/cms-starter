// filename: lib/errors.ts
export { AppError } from "./domain";
import { AppError } from "./domain";
export function ensure(
  value: unknown,
  status: number,
  message: string,
): asserts value {
  if (!value) throw new AppError(status, message);
}
export function safeMessage(error: unknown) {
  return error instanceof AppError
    ? error.message
    : "The operation could not complete. Check server configuration.";
}
