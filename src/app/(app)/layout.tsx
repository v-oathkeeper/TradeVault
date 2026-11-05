import React from 'react';
import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { UserProvider } from '@/components/providers/UserContext';
import type { UserRole } from '@/types/app';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Fetch household membership and profile
  const { data: member } = await supabase
    .from('household_members')
    .select('household_id, role')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single();

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', user.id)
    .single();

  // If user doesn't have membership yet (e.g. dev/first run), use fallback
  const householdId = member?.household_id ?? 'b1000000-0000-0000-0000-000000000001';
  const role: UserRole = (member?.role as UserRole) ?? 'ADMIN';
  const fullName = profile?.full_name ?? (role === 'ADMIN' ? 'Husband' : 'Wife');

  // Fetch portfolio persons for this household
  const { data: personsData } = await supabase
    .from('persons')
    .select('id, display_name, relationship_label')
    .eq('household_id', householdId)
    .eq('is_active', true);

  const initialPersons = (personsData && personsData.length > 0)
    ? personsData.map((p) => ({
        id: p.id,
        displayName: p.display_name,
        relationshipLabel: p.relationship_label,
      }))
    : [
        {
          id: 'c1000000-0000-0000-0000-000000000001',
          displayName: 'Husband',
          relationshipLabel: 'Husband',
        },
        {
          id: 'c2000000-0000-0000-0000-000000000002',
          displayName: 'Wife',
          relationshipLabel: 'Wife',
        },
      ];

  const initialUser = {
    id: user.id,
    email: user.email ?? '',
    fullName,
    role,
    householdId,
  };

  return (
    <UserProvider initialUser={initialUser} initialPersons={initialPersons}>
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
