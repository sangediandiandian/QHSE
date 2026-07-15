import { SetMetadata } from '@nestjs/common';
import type { Permission } from '../iam/iam.types';

export const REQUIRED_PERMISSIONS_KEY = 'requiredPermissions';
export const RequirePermissions = (...required: Permission[]) => (
  SetMetadata(REQUIRED_PERMISSIONS_KEY, required)
);
