import React from 'react';

import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type {
  EarlyRecallStatus,
} from '@/lib/earlyRecallApi';

import { EARLY_RECALL_STATUS_CONFIG } from './earlyRecallStatus';

interface EarlyRecallStatusBadgeProps {
  status: EarlyRecallStatus;
  className?: string;
}

const EarlyRecallStatusBadge: React.FC<
  EarlyRecallStatusBadgeProps
> = ({
  status,
  className,
}) => {
  const config =
    EARLY_RECALL_STATUS_CONFIG[status];

  return (
    <Badge
      variant="outline"
      className={cn(
        'whitespace-nowrap font-medium',
        config?.className,
        className,
      )}
      title={
        config?.description ??
        status
      }
    >
      {config?.label ?? status}
    </Badge>
  );
};

export default EarlyRecallStatusBadge;
