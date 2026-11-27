import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

const LIVE_COLLECTIONS = [
  'products',
  'categories',
  'suppliers',
  'warehouses',
  'stock_batches',
  'stock_in',
  'stock_out',
  'requests',
  'request_details',
  'deliveries',
  'delivery_details',
  'vehicles',
  'stock_movements',
  'kordas',
  'departments',
  'needsRequests',
  'shipments',
  'stockTransactions',
  'distributions',
  'financeTransactions',
  'regions',
  'recipients',
  'activityLogs',
  'notifications',
  'roles',
  'users',
  'audit_logs',
  'audit_log_archives',
] as const;

interface DataSyncContextType {
  versions: Record<string, number>;
}

const DataSyncContext = createContext<DataSyncContextType>({ versions: {} });

export const useDataVersion = (...names: string[]): number => {
  const { versions } = useContext(DataSyncContext);
  return names.reduce((total, name) => total + (versions[name] || 0), 0);
};

export const DataSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [versions, setVersions] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!auth || !db) return;

    const firestore = db;
    const pending = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribers: (() => void)[] = [];

    const queueChange = (name: string) => {
      pending.add(name);
      if (timer) return;
      timer = setTimeout(() => {
        timer = undefined;
        const changed = [...pending];
        pending.clear();
        setVersions(previous => {
          const next = { ...previous };
          changed.forEach(name => { next[name] = (next[name] || 0) + 1; });
          return next;
        });
      }, 60);
    };

    const unsubscribeAuth = onAuthStateChanged(auth, firebaseUser => {
      unsubscribers.forEach(unsubscribe => unsubscribe());
      unsubscribers = [];
      if (!firebaseUser) return;
      unsubscribers = LIVE_COLLECTIONS.map(name =>
        onSnapshot(collection(firestore, name), () => queueChange(name), () => undefined)
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribers.forEach(unsubscribe => unsubscribe());
      if (timer) clearTimeout(timer);
    };
  }, []);

  const value = useMemo(() => ({ versions }), [versions]);

  return <DataSyncContext.Provider value={value}>{children}</DataSyncContext.Provider>;
};
