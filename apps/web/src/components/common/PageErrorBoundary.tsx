import { Component, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';

export default class PageErrorBoundary extends Component<
  { children: ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div role="alert" className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-xl font-semibold">Halaman gagal dimuat</h1>
        <p>Periksa koneksi Anda, lalu muat ulang halaman untuk mencoba kembali.</p>
        <Button onClick={() => window.location.reload()}>Muat ulang halaman</Button>
      </div>
    );
  }
}
