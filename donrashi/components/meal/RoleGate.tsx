/**
 * Conditionally renders children only when the user has the required role.
 * Uses a locked banner as fallback instead of hiding (unless hideFallback is true).
 */
import React from 'react';

import { LockBadge } from './LockBadge';

interface Props {
  role: 'manager' | 'member';
  required: 'manager';
  children: React.ReactNode;
  hideFallback?: boolean;
  fallbackReason?: string;
}

export function RoleGate({ role, required, children, hideFallback, fallbackReason }: Props) {
  if (role === required) return <>{children}</>;
  if (hideFallback) return null;
  return (
    <LockBadge
      reason={fallbackReason ?? 'Only the manager can perform this action.'}
      color="#94A3B8"
    />
  );
}
