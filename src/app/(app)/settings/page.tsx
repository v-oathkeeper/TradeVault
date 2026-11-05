import React from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { SettingsClient } from '@/components/settings/SettingsClient';

export const metadata = {
  title: 'Settings',
  description: 'Manage application preferences and account security',
};

export default function SettingsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Settings" />
      <SettingsClient />
    </div>
  );
}
