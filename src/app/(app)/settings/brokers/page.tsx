import React from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { BrokerFeesClient } from '@/components/settings/BrokerFeesClient';

export const metadata = {
  title: 'Broker Fee Schedules',
  description: 'Official brokerage and statutory tax tariff rules',
};

export default function BrokerFeesPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Broker Tariffs" />
      <BrokerFeesClient />
    </div>
  );
}
