// filename: lib/repository.ts
import "server-only";
import {
  asc,
  eq,
  startsWith,
  onyx,
  type IOnyxDatabase,
  type IQueryBuilder,
} from "@onyx.dev/onyx-database";
import { AppError, schemas, type Rows, type Table } from "./domain";

export interface Store {
  get<K extends Table>(table: K, id: string): Promise<Rows[K] | null>;
  delete(table: Table, id: string): Promise<void>;
  insert<K extends Table>(table: K, row: Rows[K]): Promise<void>;
  update<K extends Table>(
    table: K,
    id: string,
    expected: Partial<Rows[K]>,
    updates: Partial<Rows[K]>,
  ): Promise<boolean>;
  list<K extends Table>(
    table: K,
    options?: {
      where?: Partial<Rows[K]>;
      cursor?: string;
      limit?: number;
      fields?: string[];
      prefix?: string;
    },
  ): Promise<{ items: Rows[K][]; cursor?: string }>;
  saveDocument(id: string, mime: string, bytes: Buffer): Promise<void>;
  document(id: string): Promise<Buffer>;
}
function storageError(error: unknown): never {
  if (error instanceof AppError) throw error;
  if (
    error &&
    typeof error === "object" &&
    "status" in error &&
    error.status === 409
  )
    throw new AppError(409, "That identifier or route is already in use.");
  throw new AppError(
    503,
    "Onyx is unavailable or not configured. Check the downloaded database config and schema.",
  );
}
export class OnyxStore implements Store {
  private db: IOnyxDatabase<Rows>;
  constructor() {
    // Official resolver: explicit SDK config -> environment -> existing downloaded
    // configuration/project files -> home profile. No application credential flow.
    this.db = onyx.init<Rows>({
      wireFormat: "json",
      requestLoggingEnabled: false,
      responseLoggingEnabled: false,
      retry: { enabled: false },
      fetch: async (input, init) => {
        const body =
          init?.body instanceof Uint8Array
            ? new Uint8Array(init.body).buffer
            : init?.body;
        const response = await fetch(input, {
          ...init,
          body,
          cache: "no-store",
          signal: AbortSignal.timeout(8000),
        });
        return response;
      },
    });
  }
  async get<K extends Table>(table: K, id: string): Promise<Rows[K] | null> {
    try {
      const row = await this.db.findById(table, id);
      return row == null ? null : (schemas[table].parse(row) as Rows[K]);
    } catch (error) {
      return storageError(error);
    }
  }
  async delete(table: Table, id: string) {
    try {
      await this.db.delete(table, id);
    } catch (error) {
      storageError(error);
    }
  }
  async insert<K extends Table>(table: K, row: Rows[K]) {
    try {
      await this.db.insert(table, schemas[table].parse(row) as Rows[K]);
    } catch (error) {
      storageError(error);
    }
  }
  async update<K extends Table>(
    table: K,
    id: string,
    expected: Partial<Rows[K]>,
    updates: Partial<Rows[K]>,
  ) {
    try {
      let query = this.db.from(table).where(eq("id", id));
      for (const [field, value] of Object.entries(expected))
        query = query.and(eq(field, value));
      const count = await query.setUpdates(updates).update();
      if (
        typeof count !== "number" ||
        !Number.isSafeInteger(count) ||
        count < 0
      )
        throw new AppError(503, "Unexpected Onyx update response.");
      return count === 1;
    } catch (error) {
      return storageError(error);
    }
  }
  async list<K extends Table>(
    table: K,
    options: {
      where?: Partial<Rows[K]>;
      cursor?: string;
      limit?: number;
      fields?: string[];
      prefix?: string;
    } = {},
  ) {
    try {
      let query: IQueryBuilder<Rows[K]> = this.db.from(table);
      let filtered = false;
      for (const [field, value] of Object.entries(options.where || {})) {
        query = filtered
          ? query.and(eq(field, value))
          : query.where(eq(field, value));
        filtered = true;
      }
      if (options.prefix) {
        const condition = startsWith("id", options.prefix);
        query = filtered ? query.and(condition) : query.where(condition);
      }
      if (options.fields) query = query.select(...options.fields);
      const limit = options.limit || 20;
      if (limit < 1 || limit > 300)
        throw new AppError(422, "Invalid query size.");
      const result = await query.orderBy(asc("id")).page({
        pageSize: limit,
        ...(options.cursor ? { nextPage: options.cursor } : {}),
      });
      return {
        items: result.records.map((row) =>
          options.fields ? row : (schemas[table].parse(row) as Rows[K]),
        ),
        ...(result.nextPage ? { cursor: result.nextPage } : {}),
      };
    } catch (error) {
      return storageError(error);
    }
  }
  async saveDocument(id: string, mime: string, bytes: Buffer) {
    try {
      await this.db.saveDocument({
        documentId: id,
        path: `/seo-media/${id}`,
        mimeType: mime,
        content: bytes.toString("base64"),
      });
    } catch (error) {
      storageError(error);
    }
  }
  async document(id: string) {
    try {
      const result = await this.db.getDocument(id);
      if (
        !result ||
        typeof result !== "object" ||
        !("content" in result) ||
        typeof result.content !== "string"
      )
        throw new AppError(503, "Invalid media document.");
      return Buffer.from(result.content, "base64");
    } catch (error) {
      return storageError(error);
    }
  }
}
