'use client';

import React, { createContext, useContext, useState, useMemo } from 'react';
import type { UserRole } from '@/types/app';

export interface PortfolioPerson {
  id: string;
  displayName: string;
  relationshipLabel: string;
}

export interface UserContextType {
  userId: string;
  email: string;
  fullName: string;
  role: UserRole;
  isAdmin: boolean;
  isViewer: boolean;
  householdId: string;
  persons: PortfolioPerson[];
  selectedPersonId: string; // 'combined' | personId
  setSelectedPersonId: (id: string) => void;
  // Dynamic display labels based on who is logged in
  getPersonLabel: (personId: string | 'combined') => string;
  dateRange: 'all' | '1m' | '3m' | '6m' | '1y' | 'ytd';
  setDateRange: (range: 'all' | '1m' | '3m' | '6m' | '1y' | 'ytd') => void;
}

const UserContext = createContext<UserContextType | null>(null);

interface UserProviderProps {
  children: React.ReactNode;
  initialUser: {
    id: string;
    email: string;
    fullName: string;
    role: UserRole;
    householdId: string;
  };
  initialPersons: PortfolioPerson[];
}

export function UserProvider({
  children,
  initialUser,
  initialPersons,
}: UserProviderProps) {
  const [selectedPersonId, setSelectedPersonId] = useState<string>('combined');
  const [dateRange, setDateRange] = useState<'all' | '1m' | '3m' | '6m' | '1y' | 'ytd'>('all');

  const isAdmin = initialUser.role === 'ADMIN';
  const isViewer = initialUser.role === 'VIEWER';

  // Dynamic login-aware display names:
  // Shows "You" vs "Husband" / "Wife" depending on logged in account
  const getPersonLabel = (personId: string | 'combined'): string => {
    if (personId === 'combined') return 'Combined';

    const person = initialPersons.find((p) => p.id === personId);
    if (!person) return 'Unknown';

    const isHusbandRecord =
      person.relationshipLabel?.toLowerCase().includes('husband') ||
      person.displayName?.toLowerCase().includes('husband');

    if (isAdmin) {
      // Husband logged in
      return isHusbandRecord ? 'You' : 'Wife';
    } else {
      // Wife logged in
      return isHusbandRecord ? 'Husband' : 'You';
    }
  };

  const value = useMemo(
    () => ({
      userId: initialUser.id,
      email: initialUser.email,
      fullName: initialUser.fullName,
      role: initialUser.role,
      isAdmin,
      isViewer,
      householdId: initialUser.householdId,
      persons: initialPersons,
      selectedPersonId,
      setSelectedPersonId,
      getPersonLabel,
      dateRange,
      setDateRange,
    }),
    [initialUser, initialPersons, selectedPersonId, dateRange, isAdmin, isViewer]
  );

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUser() {
  const context = useContext(UserContext);
  if (!context) {
    throw new Error('useUser must be used within a UserProvider');
  }
  return context;
}
