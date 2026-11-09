import React from 'react';
import { redirect } from 'next/navigation';
import { getHouseholdAppContext } from '@/lib/auth/server-auth';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { UserProvider } from '@/components/providers/UserContext';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const appContext = await getHouseholdAppContext();

  if (!appContext) {
    redirect('/login');
  }

  const initialUser = {
    id: appContext.user.id,
    email: appContext.user.email ?? '',
    fullName: appContext.fullName,
    role: appContext.role,
    householdId: appContext.householdId,
  };

  return (
    <UserProvider initialUser={initialUser} initialPersons={appContext.persons}>
      <div className="min-h-screen flex bg-[var(--background)]">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-0">
          <main className="flex-1 overflow-x-hidden">{children}</main>
        </div>
        <MobileNav />
      </div>
    </UserProvider>
  );
}
