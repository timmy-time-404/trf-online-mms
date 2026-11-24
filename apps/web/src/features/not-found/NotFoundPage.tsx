import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useDocumentTitle } from '@/hooks/useDocumentTitle';

/** Shown for unknown URLs instead of silently redirecting to the dashboard. */
const NotFoundPage: React.FC = () => {
  useDocumentTitle('Halaman tidak ditemukan');
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center gap-3 p-8 text-center">
      <p className="text-sm font-medium text-gray-500">404</p>
      <h1 className="text-2xl font-semibold text-gray-900">Halaman tidak ditemukan</h1>
      <p className="max-w-md text-gray-600">Alamat yang kamu buka tidak ada atau sudah dipindahkan.</p>
      <Button asChild><Link to="/">Kembali ke Dashboard</Link></Button>
    </main>
  );
};

export default NotFoundPage;
