import { describe, expect, it } from 'vitest';
import { trfStatusSchema, userRoleSchema } from './domain';

describe('shared domain vocabulary', () => {
  it('accepts every legacy role and rejects unknown ones', () => {
    expect(userRoleSchema.parse('GA')).toBe('GA');
    expect(userRoleSchema.safeParse('ADMIN').success).toBe(false);
  });

  it('does not accept the undeclared APPROVED status', () => {
    // The legacy skip-approver path can write APPROVED; it is not a valid status.
    expect(trfStatusSchema.safeParse('APPROVED').success).toBe(false);
  });
});
