import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, Loader2 } from 'lucide-react';

interface RealtimeStatusProps {
  status: 'connecting' | 'connected' | 'disconnected';
  onReconnect?: () => void;
}

export function RealtimeStatus({ status, onReconnect }: RealtimeStatusProps) {
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: <Wifi className="h-3 w-3" />,
          text: 'Live',
          variant: 'default' as const,
          className: 'bg-green-500 text-white hover:bg-green-600'
        };
      case 'connecting':
        return {
          icon: <Loader2 className="h-3 w-3 animate-spin" />,
          text: 'Connecting',
          variant: 'secondary' as const,
          className: 'bg-yellow-500 text-white'
        };
      case 'disconnected':
        return {
          icon: <WifiOff className="h-3 w-3" />,
          text: 'Offline',
          variant: 'destructive' as const,
          className: 'bg-red-500 text-white hover:bg-red-600'
        };
    }
  };

  const config = getStatusConfig();

  if (status === 'disconnected' && onReconnect) {
    return (
      <Button
        size="sm"
        variant="outline"
        onClick={onReconnect}
        className={config.className}
      >
        {config.icon}
        Reconnect
      </Button>
    );
  }

  return (
    <Badge variant={config.variant} className={config.className}>
      {config.icon}
      {config.text}
    </Badge>
  );
}