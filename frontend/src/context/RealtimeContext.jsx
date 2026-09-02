import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { supabase } from '../services/supabaseClient';

const RealtimeContext = createContext(null);

export function RealtimeProvider({ children }) {
  const [refetchKey, setRefetchKey] = useState(0);

  const bump = useCallback(() => setRefetchKey((k) => k + 1), []);

  useEffect(() => {
    const channel = supabase
      .channel('db-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'transactions' },
        () => bump()
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'audit_logs' },
        () => bump()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bump]);

  return (
    <RealtimeContext.Provider value={refetchKey}>
      {children}
    </RealtimeContext.Provider>
  );
}

export function useRefetchKey() {
  return useContext(RealtimeContext);
}
