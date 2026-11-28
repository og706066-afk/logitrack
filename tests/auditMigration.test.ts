import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { migrateAuditLogs } from '../server/src/services/auditMigrationService';

function createFakeDb() {
  const store = new Map<string, Record<string, unknown>>();
  let lock: Promise<void> = Promise.resolve();
  const runExclusive = async <T,>(fn: () => Promise<T>): Promise<T> => {
    const prev = lock;
    let release!: () => void;
    lock = new Promise<void>((r) => { release = r; });
    await prev;
    try { return await fn(); } finally { release(); }
  };

  const db = {
    collection: (name: string) => ({
      doc: (id: string) => ({ id, path: `${name}/${id}` }),
      where: (field: string, _op: string, value: unknown) => ({
        limit: (_n: number) => ({
          get: async () => {
            const docs = [...store.entries()]
              .filter(([k, data]) => k.startsWith(`${name}/`) && data[field] === value)
              .map(([k, data]) => ({ exists: true, id: k.split('/')[1], data: () => data }));
            return { empty: docs.length === 0, docs };
          },
        }),
      }),
    }),
    runTransaction: async (fn: (tx: any) => Promise<any>) => runExclusive(async () => {
      const staged = new Map<string, Record<string, unknown>>();
      const tx = {
        get: async (ref: { path: string; id: string }) => {
          const data = staged.get(ref.path) ?? store.get(ref.path);
          return { exists: !!data, id: ref.id, data: () => data };
        },
        set: (ref: { path: string }, data: Record<string, unknown>) => {
          staged.set(ref.path, { ...(staged.get(ref.path) ?? store.get(ref.path) ?? {}), ...data });
        },
      };
      const result = await fn(tx);
      for (const [k, v] of staged.entries()) store.set(k, v);
      return result;
    }),
    _store: store,
  } as any;
  return db;
}

const actor = { uid: 'admin-1', displayName: 'Super Admin' };

describe('migrateAuditLogs', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-01T00:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('is idempotent for retry of same localId/fingerprint', async () => {
    const db = createFakeDb();
    const input = {
      logs: [{
        localId: 'log-1795826551289-964',
        action: 'UPDATE_USER_ROLE',
        module: 'Pengguna',
        description: 'Ubah role',
        createdAt: '2026-04-01T00:00:00.000Z',
        clientEventId: 'evt-1',
      }],
    };

    const first = await migrateAuditLogs(input, actor, db);
    const second = await migrateAuditLogs(input, actor, db);

    expect(first.migratedCount).toBe(1);
    expect(second.migratedCount).toBe(0);
    expect(second.skippedCount).toBe(1);
    expect([...db._store.keys()].filter((k) => k.startsWith('audit_logs/')).length).toBe(1);
  });

  it('does not duplicate during concurrent requests', async () => {
    const db = createFakeDb();
    const input = {
      logs: [{
        localId: 'log-1795826551289-111',
        action: 'CREATE_USER',
        module: 'Pengguna',
        description: 'Tambah user',
        createdAt: '2026-04-01T00:00:00.000Z',
      }],
    };

    const [a, b] = await Promise.all([migrateAuditLogs(input, actor, db), migrateAuditLogs(input, actor, db)]);
    expect(a.migratedCount + b.migratedCount).toBe(1);
    expect(a.skippedCount + b.skippedCount).toBe(1);
    expect([...db._store.keys()].filter((k) => k.startsWith('audit_logs/')).length).toBe(1);
  });

  it('uses verified actor and does not trust client attribution fields in payload object', async () => {
    const db = createFakeDb();
    const input = {
      logs: [{
        localId: 'log-1795826551289-222',
        action: 'LOGIN',
        module: 'Auth',
        description: 'Login',
        createdAt: '2026-04-01T00:00:00.000Z',
      }],
    };

    await migrateAuditLogs(input, actor, db);
    const saved = [...db._store.entries()].find(([k]) => k.startsWith('audit_logs/'))?.[1] as Record<string, unknown>;
    expect(saved.userId).toBe('admin-1');
    expect(saved.userName).toBe('Super Admin');
    expect(saved.migratedBy).toBe('admin-1');
    expect(saved.source).toBe('migrated_local');
  });
});
