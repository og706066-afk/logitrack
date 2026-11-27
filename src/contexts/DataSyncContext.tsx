import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, doc, getDoc, onSnapshot, query, where } from 'firebase/firestore';
import type { Query } from 'firebase/firestore';
import { auth, db } from '../services/firebase';

const BASE_COLLECTIONS = [
  'products',
  'categories',
  'suppliers',
  'warehouses',
  'stock_batches',
  'stock_in',
  'stock_out',
  'requests',
  'request_details',
  'vehicles',
  'stock_movements',
  'kordas',
  'departments',
  'needsRequests',
  'activityLogs',
  'roles',
  'audit_logs',
  'notifications',
] as const;

interface SyncProfile {
  role?: string;
  permissions?: string[];
}

interface DataSyncContextType {
  versions: Record<string, number>;
}

const DataSyncContext = createContext<DataSyncContextType>({ versions: {} });

export const useDataVersion = (...names: string[]): number => {
  const { versions } = useContext(DataSyncContext);
  return names.reduce((total, name) => total + (versions[name] || 0), 0);
};

function hasReadPermission(profile: SyncProfile, permission: string): boolean {
  return profile.role === 'Super Admin' ||
    profile.permissions?.includes('*') === true ||
    profile.permissions?.includes(permission) === true;
}

function getListenerNames(profile: SyncProfile): string[] {
  const names: string[] = [...BASE_COLLECTIONS];
  const role = profile.role || '';
  const isSuperAdmin = role === 'Super Admin';
  const canReadUsers = isSuperAdmin || ['Manager', 'Staf Gudang', 'Staf Logistik', 'Kepala Gudang'].includes(role);

  if (canReadUsers) names.push('users');
  if (isSuperAdmin) names.push('audit_log_archives');

  if (role !== 'Driver') {
    names.push('deliveries', 'delivery_details', 'shipments');
  } else {
    names.push('deliveries', 'shipments');
  }

  if (hasReadPermission(profile, 'stockTransactions.view')) names.push('stockTransactions');
  if (hasReadPermission(profile, 'distributions.view')) names.push('distributions');
  if (hasReadPermission(profile, 'finance.view')) names.push('financeTransactions');
  if (hasReadPermission(profile, 'regions.view')) names.push('regions', 'recipients');

  return names;
}

export const DataSyncProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [versions, setVersions] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!auth || !db) return;

    const firestore = db;
    const pending = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let unsubscribers: (() => void)[] = [];
    let generation = 0;

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
      generation += 1;
      const currentGeneration = generation;

      unsubscribers.forEach(unsubscribe => unsubscribe());
      unsubscribers = [];
      if (!firebaseUser) return;

      const uid = firebaseUser.uid;

      void (async () => {
        let profile: SyncProfile = {};
        try {
          const snapshot = await getDoc(doc(firestore, 'users', uid));
          if (snapshot.exists()) profile = snapshot.data() as SyncProfile;
        } catch {}

        if (currentGeneration !== generation) return;

        unsubscribers = getListenerNames(profile).map(name => {
          let source: Query = collection(firestore, name);
          if (name === 'notifications') {
            source = query(source, where('userId', '==', uid));
          } else if ((name === 'deliveries' || name === 'shipments') && profile.role === 'Driver') {
            source = query(source, where('driverId', '==', uid));
          }
          return onSnapshot(source, () => queueChange(name), () => undefined);
        });
      })();
    });

    return () => {
      generation += 1;
      unsubscribeAuth();
      unsubscribers.forEach(unsubscribe => unsubscribe());
      if (timer) clearTimeout(timer);
    };
  }, []);

  const value = useMemo(() => ({ versions }), [versions]);

  return <DataSyncContext.Provider value={value}>{children}</DataSyncContext.Provider>;
};
