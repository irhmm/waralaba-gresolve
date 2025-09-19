import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { useToast } from './use-toast';

interface RealtimeConfig {
  table: string;
  franchiseId?: string;
  onInsert?: (payload: any) => void;
  onUpdate?: (payload: any) => void;
  onDelete?: (payload: any) => void;
}

export function useRealtimeData(config: RealtimeConfig) {
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('disconnected');
  const channelRef = useRef<RealtimeChannel | null>(null);
  const { toast } = useToast();

  const setupRealtimeSubscription = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
    }

    setConnectionStatus('connecting');

    const channel = supabase.channel(`${config.table}-changes`, {
      config: {
        broadcast: { self: false }
      }
    });

    // Listen for INSERT events
    channel.on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: config.table,
        filter: config.franchiseId ? `franchise_id=eq.${config.franchiseId}` : undefined
      },
      (payload) => {
        console.log(`New ${config.table} insert:`, payload);
        config.onInsert?.(payload);
        toast({
          title: "Data Baru",
          description: `Data baru ditambahkan ke ${config.table}`,
        });
      }
    );

    // Listen for UPDATE events
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: config.table,
        filter: config.franchiseId ? `franchise_id=eq.${config.franchiseId}` : undefined
      },
      (payload) => {
        console.log(`${config.table} update:`, payload);
        config.onUpdate?.(payload);
        toast({
          title: "Data Diperbarui",
          description: `Data di ${config.table} telah diperbarui`,
        });
      }
    );

    // Listen for DELETE events
    channel.on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: config.table,
        filter: config.franchiseId ? `franchise_id=eq.${config.franchiseId}` : undefined
      },
      (payload) => {
        console.log(`${config.table} delete:`, payload);
        config.onDelete?.(payload);
        toast({
          title: "Data Dihapus",
          description: `Data di ${config.table} telah dihapus`,
        });
      }
    );

    channel.subscribe((status) => {
      console.log(`Realtime subscription status for ${config.table}:`, status);
      
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
        setConnectionStatus('connected');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setIsConnected(false);
        setConnectionStatus('disconnected');
        // Retry connection after 3 seconds
        setTimeout(() => {
          if (channelRef.current) {
            setupRealtimeSubscription();
          }
        }, 3000);
      }
    });

    channelRef.current = channel;
  }, [config, toast]);

  useEffect(() => {
    setupRealtimeSubscription();

    return () => {
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [setupRealtimeSubscription]);

  const disconnect = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    setIsConnected(false);
    setConnectionStatus('disconnected');
  }, []);

  const reconnect = useCallback(() => {
    setupRealtimeSubscription();
  }, [setupRealtimeSubscription]);

  return {
    isConnected,
    connectionStatus,
    disconnect,
    reconnect
  };
}