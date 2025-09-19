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
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const { toast } = useToast();

  const { table, franchiseId, onInsert, onUpdate, onDelete } = config;

  const setupRealtimeSubscription = useCallback(() => {
    // Clear any existing subscription and retry timeout
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    setConnectionStatus('connecting');

    const channelName = `${table}-changes-${Date.now()}`;
    const channel = supabase.channel(channelName, {
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
        table: table,
        filter: franchiseId ? `franchise_id=eq.${franchiseId}` : undefined
      },
      (payload) => {
        console.log(`New ${table} insert:`, payload);
        onInsert?.(payload);
        toast({
          title: "Data Baru",
          description: `Data baru ditambahkan ke ${table}`,
        });
      }
    );

    // Listen for UPDATE events
    channel.on(
      'postgres_changes',
      {
        event: 'UPDATE',
        schema: 'public',
        table: table,
        filter: franchiseId ? `franchise_id=eq.${franchiseId}` : undefined
      },
      (payload) => {
        console.log(`${table} update:`, payload);
        onUpdate?.(payload);
        toast({
          title: "Data Diperbarui",
          description: `Data di ${table} telah diperbarui`,
        });
      }
    );

    // Listen for DELETE events
    channel.on(
      'postgres_changes',
      {
        event: 'DELETE',
        schema: 'public',
        table: table,
        filter: franchiseId ? `franchise_id=eq.${franchiseId}` : undefined
      },
      (payload) => {
        console.log(`${table} delete:`, payload);
        onDelete?.(payload);
        toast({
          title: "Data Dihapus",
          description: `Data di ${table} telah dihapus`,
        });
      }
    );

    channel.subscribe((status) => {
      console.log(`Realtime subscription status for ${table}:`, status);
      
      if (status === 'SUBSCRIBED') {
        setIsConnected(true);
        setConnectionStatus('connected');
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        setIsConnected(false);
        setConnectionStatus('disconnected');
        // Retry connection after 5 seconds to avoid rapid reconnections
        retryTimeoutRef.current = setTimeout(() => {
          if (channelRef.current === channel) {
            setupRealtimeSubscription();
          }
        }, 5000);
      } else if (status === 'CLOSED') {
        setIsConnected(false);
        setConnectionStatus('disconnected');
      }
    });

    channelRef.current = channel;
  }, [table, franchiseId, onInsert, onUpdate, onDelete, toast]);

  useEffect(() => {
    let mounted = true;
    
    if (mounted) {
      setupRealtimeSubscription();
    }

    return () => {
      mounted = false;
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      if (retryTimeoutRef.current) {
        clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [table, franchiseId]); // Only depend on stable values

  const disconnect = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.unsubscribe();
      channelRef.current = null;
    }
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
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