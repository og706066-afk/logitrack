import { describe, expect, it } from 'vitest';
import { migrateAuditLogsSchema } from '../server/src/validators/auditLogValidators';

describe('migrateAuditLogsSchema', () => {
  it('rejects mass assignment/unknown fields', () => {
    const result = migrateAuditLogsSchema.safeParse({
      logs: [{
        localId: 'log-1-1',
        action: 'LOGIN',
        module: 'Auth',
        description: 'x',
        userId: 'victim',
        userName: 'Victim',
        role: 'Super Admin',
      }],
    } as any);
    expect(result.success).toBe(false);
  });

  it('rejects invalid localId format', () => {
    const result = migrateAuditLogsSchema.safeParse({ logs: [{ localId: 'bad-id', action: 'A', module: 'M' }] });
    expect(result.success).toBe(false);
  });
});
