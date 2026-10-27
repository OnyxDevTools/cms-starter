// filename: tests/fixture/memory.ts
// Test-only repository. It is never selected by application configuration.
import { AppError, type Rows, type Table, schemas } from "../../lib/domain";
import type { Store } from "../../lib/repository";
export class MemoryStore implements Store {
  tables = new Map<Table, Map<string, unknown>>();
  documents = new Map<string, Buffer>();
  outage = false;
  private table(name: Table) {
    if (this.outage) throw new AppError(503, "Test outage");
    if (!this.tables.has(name)) this.tables.set(name, new Map());
    return this.tables.get(name)!;
  }
  async get<K extends Table>(name: K, id: string): Promise<Rows[K] | null> {
    const raw = this.table(name).get(id);
    return raw ? (structuredClone(raw) as Rows[K]) : null;
  }
  async insert<K extends Table>(name: K, row: Rows[K]) {
    const table = this.table(name);
    if (table.has(row.id)) throw new AppError(409, "Duplicate");
    table.set(row.id, structuredClone(schemas[name].parse(row)));
  }
  async update<K extends Table>(
    name: K,
    id: string,
    expected: Partial<Rows[K]>,
    updates: Partial<Rows[K]>,
  ) {
    const table = this.table(name),
      row = table.get(id) as Rows[K] | undefined;
    if (
      !row ||
      Object.entries(expected).some(
        ([key, value]) => row[key as keyof Rows[K]] !== value,
      )
    )
      return false;
    table.set(id, { ...row, ...structuredClone(updates) });
    return true;
  }
  async delete(name: Table, id: string) {
    this.table(name).delete(id);
  }
  async list<K extends Table>(
    name: K,
    options: {
      where?: Partial<Rows[K]>;
      cursor?: string;
      limit?: number;
      prefix?: string;
    } = {},
  ) {
    const all = Array.from(this.table(name).values()) as Rows[K][];
    const rows = all
      .filter(
        (row) =>
          (!options.prefix || row.id.startsWith(options.prefix)) &&
          Object.entries(options.where || {}).every(
            ([key, value]) => row[key as keyof Rows[K]] === value,
          ),
      )
      .sort((a, b) => a.id.localeCompare(b.id));
    const start = options.cursor ? Number(options.cursor) : 0,
      limit = options.limit || 20;
    return {
      items: structuredClone(rows.slice(start, start + limit)),
      ...(start + limit < rows.length ? { cursor: String(start + limit) } : {}),
    };
  }
  async saveDocument(id: string, _mime: string, bytes: Buffer) {
    this.documents.set(id, bytes);
  }
  async document(id: string) {
    const bytes = this.documents.get(id);
    if (!bytes) throw new AppError(404, "Not found");
    return bytes;
  }
}
