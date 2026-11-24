/**
 * Domain vocabulary shared by the web app and the API.
 * Values mirror the legacy system exactly (see docs/spec); do not rename without a migration.
 */
import { z } from 'zod';

export const USER_ROLES = [
  'EMPLOYEE',
  'ADMIN_DEPT',
  'HOD',
  'HR',
  'PM',
  'GA',
  'SUPER_ADMIN',
] as const;
export const userRoleSchema = z.enum(USER_ROLES);
export type UserRole = z.infer<typeof userRoleSchema>;

export const TRF_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'ADMIN_DEPT_VERIFIED',
  'PENDING_APPROVAL',
  'HOD_APPROVED',
  'HR_APPROVED',
  'PM_APPROVED',
  'GA_PROCESSED',
  'REJECTED',
  'CANCELLED',
  'NEEDS_REVISION',
  'REVISED',
] as const;
export const trfStatusSchema = z.enum(TRF_STATUSES);
export type TrfStatus = z.infer<typeof trfStatusSchema>;

export const EARLY_RECALL_STATUSES = [
  'DRAFT',
  'PENDING_HR_VALIDATION',
  'NEEDS_REVISION',
  'HR_VALIDATED',
  'PENDING_PM_APPROVAL',
  'PM_APPROVED',
  'GA_PROCESSING',
  'TRAVEL_BOOKED',
  'RETURNED_TO_SITE',
  'OS_GENERATED',
  'REJECTED',
  'CANCELLED',
] as const;
export const earlyRecallStatusSchema = z.enum(EARLY_RECALL_STATUSES);
export type EarlyRecallStatus = z.infer<typeof earlyRecallStatusSchema>;
