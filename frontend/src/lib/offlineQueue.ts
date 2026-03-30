import { openDB, type DBSchema, type IDBPDatabase } from "idb";

interface MentoolDB extends DBSchema {
  outbox: {
    key: number;
    value: {
      id?: number;
      method: string;
      path: string;
      body: string;
      headers: Record<string, string>;
      createdAt: number;
    };
  };
}

let dbPromise: Promise<IDBPDatabase<MentoolDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<MentoolDB>("mentool-outbox", 1, {
      upgrade(db) {
        db.createObjectStore("outbox", { keyPath: "id", autoIncrement: true });
      },
    });
  }
  return dbPromise;
}

export async function enqueueOutbox(
  method: string,
  path: string,
  body: unknown,
  headers: Record<string, string>
) {
  const db = await getDb();
  await db.add("outbox", {
    method,
    path,
    body: JSON.stringify(body),
    headers,
    createdAt: Date.now(),
  });
}

export async function outboxCount(): Promise<number> {
  const db = await getDb();
  return db.count("outbox");
}

export async function flushOutbox(
  baseUrl: string,
  onProgress?: (n: number) => void
): Promise<void> {
  const db = await getDb();
  const all = await db.getAll("outbox");
  for (const row of all) {
    if (row.id == null) continue;
    try {
      const res = await fetch(`${baseUrl}${row.path}`, {
        method: row.method,
        headers: { "Content-Type": "application/json", ...row.headers },
        body: row.body,
      });
      if (res.ok) await db.delete("outbox", row.id);
      onProgress?.(await db.count("outbox"));
    } catch {
      break;
    }
  }
}

export function onOnlineFlush(
  baseUrl: string,
  setPending: (n: number) => void
) {
  const run = async () => {
    await flushOutbox(baseUrl, setPending);
    setPending(await outboxCount());
  };
  window.addEventListener("online", run);
  return () => window.removeEventListener("online", run);
}
