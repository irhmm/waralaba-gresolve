import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

interface RealtimeStatusProps {
  status: 'connecting' | 'connected' | 'disconnected';
  onReconnect?: () => void;
}

export function RealtimeStatus({ status, onReconnect }: RealtimeStatusProps) {
  // Don't display any status - component returns null
  return null;
}