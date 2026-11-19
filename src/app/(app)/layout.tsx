import React from 'react';
import Link from 'next/link';
import { AuthError, getHouseholdAppContext } from '@/lib/auth/server-auth';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { UserProvider } from '@/components/providers/UserContext';

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let appContext: Awaited<ReturnType<typeof getHouseholdAppContext>>;
  try {
    appContext = await getHouseholdAppContext();
  } catch (error) {
    if (error instanceof AuthError && [401, 403, 503].includes(error.statusCode)) {
      const isSessionExpired = error.statusCode === 401;
      const isMembershipRequired = error.statusCode === 403;
      return (
        <main className="min-h-screen flex items-center justify-center p-6 bg-[var(--background)]">
          <section className="w-full max-w-lg rounded-3xl border border-[var(--border)] bg-[var(--card)] p-8 text-center shadow-[var(--shadow-lg)]">
            <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <span aria-hidden="true" className="text-xl font-bold">!</span>
            </div>
            <h1 className="text-xl font-semibold text-[var(--foreground)]">
              {isSessionExpired
                ? 'Your session needs refreshing'
                : isMembershipRequired
                  ? 'Household access required'
                  : 'Workspace temporarily unavailable'}
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
              {isSessionExpired
                ? 'Sign in again to continue to your trading workspace.'
                : isMembershipRequired
                  ? 'This account does not have an active household membership. Ask your household administrator to restore access.'
                  : 'We could not verify your account or load workspace data. Please retry in a moment.'}
            </p>
            {isSessionExpired ? (
              <Link
                href="/login?reauth=1"
                className="mt-5 inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                Return to sign in
              </Link>
            ) : error.statusCode === 503 ? (
              <a
                href="/dashboard"
                className="mt-5 inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                Try again
              </a>
            ) : null}
          </section>
        </main>
      );
    }
    throw error;
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
