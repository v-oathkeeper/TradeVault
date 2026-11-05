import React from 'react';
import { TopBar } from '@/components/layout/TopBar';
import { ExportClient } from '@/components/exports/ExportClient';

export const metadata = {
  title: 'Export Center',
  description: 'Export trade history in CSV, XLSX, and JSON formats',
};

export default function ExportsPage() {
  return (
    <div className="flex flex-col min-h-screen">
      <TopBar title="Export Center" />
      <ExportClient />
    </div>
  );
}
