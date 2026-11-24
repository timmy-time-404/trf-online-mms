import { useEffect, useState } from 'react';
import { apiRequest } from '@/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import ConfirmDialog from '@/components/common/ConfirmDialog';

interface Hotel { id: string; name: string; totalRooms: number | null }
export default function HotelManagementPage() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [name, setName] = useState('');
  const [totalRooms, setTotalRooms] = useState('');
  const [editing, setEditing] = useState<string | null>(null);
  const [removing, setRemoving] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    apiRequest<Hotel[]>('/hotels').then((rows) => { if (active) setHotels(rows); })
      .catch((err: unknown) => { if (active) setError(err instanceof Error ? err.message : 'Gagal memuat hotel.'); });
    return () => { active = false; };
  }, []);
  const reset = () => { setEditing(null); setName(''); setTotalRooms(''); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const hotel = await apiRequest<Hotel>(editing ? '/hotels/' + editing : '/hotels', {
        method: editing ? 'PUT' : 'POST', body: { name, totalRooms: totalRooms === '' ? null : Number(totalRooms) },
      });
      setHotels((rows) => editing ? rows.map((row) => row.id === editing ? hotel : row) : [...rows, hotel]); reset();
    } catch (err) { setError(err instanceof Error ? err.message : 'Gagal menyimpan hotel.'); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!removing) return;
    setBusy(true); setError('');
    try {
      await apiRequest('/hotels/' + removing, { method: 'DELETE' });
      setHotels((rows) => rows.filter((row) => row.id !== removing));
      if (editing === removing) reset();
      setRemoving(null);
    } catch (err) { setError(err instanceof Error ? err.message : 'Gagal menghapus hotel.'); }
    finally { setBusy(false); }
  };
  return <div className="space-y-6">
    <div><h1 className="text-2xl font-bold text-gray-900">Hotel Management</h1><p className="text-gray-500 mt-1">Manage hotels and accommodations</p></div>
    {error && <p role="alert" className="text-red-600">{error}</p>}
    <Card><CardContent className="pt-6">
      <form onSubmit={save} className="flex flex-wrap items-end gap-4">
        <div className="space-y-2"><label htmlFor="hotel-name">Nama hotel</label><Input id="hotel-name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={200} disabled={busy} /></div>
        <div className="space-y-2"><label htmlFor="hotel-capacity">Kapasitas kamar (opsional)</label><Input id="hotel-capacity" type="number" min={0} max={100000} step={1} value={totalRooms} onChange={(e) => setTotalRooms(e.target.value)} disabled={busy} /></div>
        <Button type="submit" disabled={busy}>{editing ? 'Simpan perubahan' : 'Tambah hotel'}</Button>
        {editing && <Button type="button" variant="outline" onClick={reset} disabled={busy}>Batal</Button>}
      </form>
    </CardContent></Card>
    <Card><CardContent className="pt-6 overflow-x-auto">
      <table className="w-full text-sm"><thead><tr className="border-b text-left"><th className="p-3">Hotel</th><th className="p-3">Kapasitas</th><th className="p-3">Aksi</th></tr></thead>
        <tbody>{hotels.map((hotel) => <tr key={hotel.id} className="border-b"><td className="p-3">{hotel.name}</td><td className="p-3">{hotel.totalRooms ?? 'Belum diisi'}</td><td className="p-3 space-x-2">
          <Button variant="outline" disabled={busy} onClick={() => { setEditing(hotel.id); setName(hotel.name); setTotalRooms(hotel.totalRooms == null ? '' : String(hotel.totalRooms)); }}>Edit</Button>
          <Button variant="destructive" disabled={busy} onClick={() => setRemoving(hotel.id)}>Hapus</Button>
        </td></tr>)}</tbody></table>
      {hotels.length === 0 && <p className="py-6 text-center text-gray-500">Belum ada hotel.</p>}
    </CardContent></Card>
    <ConfirmDialog open={!!removing} onOpenChange={(open) => { if (!open) setRemoving(null); }} title="Hapus hotel" description="Hapus hotel ini dari daftar?" confirmText="Hapus" cancelText="Batal" variant="danger" loading={busy} onConfirm={remove} />
  </div>;
}
