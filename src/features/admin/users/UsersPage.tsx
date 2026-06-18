import { useEffect, useState } from 'react';
import { useTRFStore } from '@/store';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import UserFormDialog from './UserFormDialog';

export default function UsersPage() {
  const { users, fetchUsers, deleteUser, enableUser } = useTRFStore();
  const [open, setOpen] = useState(false);

  // ✅ State untuk mode edit
  const [selectedUser, setSelectedUser] = useState<any>(null);

  // 🔍 State untuk Fitur Pencarian dan Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('ALL'); // Pilihan: 'ALL', 'ACTIVE', 'INACTIVE'

  useEffect(() => {
    fetchUsers();
  }, []);

  // ⚙️ Logika Penyaringan Data Client-Side
  const filteredUsers = users.filter((user) => {
    // 1. Filter berdasarkan Username (case-insensitive)
    const matchesSearch = user.username
      ?.toLowerCase()
      .includes(searchQuery.toLowerCase());

    // 2. Filter berdasarkan Status is_active
    let matchesStatus = true;
    if (statusFilter === 'ACTIVE') {
      matchesStatus = user.is_active !== false; // true atau null/undefined dianggap aktif sesuai rule baris tabel Anda
    } else if (statusFilter === 'INACTIVE') {
      matchesStatus = user.is_active === false;
    }

    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-gray-500">
            Manage system access and roles
          </p>
        </div>

        <Button
          onClick={() => {
            setSelectedUser(null);
            setOpen(true);
          }}
          className="text-white bg-black hover:bg-gray-800"
        >
          + Create User
        </Button>
      </div>

      {/* 🔍 BAR PENCARIAN & FILTER */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex-1">
          <input
            type="text"
            placeholder="Search by username..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-3 py-2 text-sm border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-gray-400 placeholder:text-gray-400"
          />
        </div>
        <div className="w-full sm:w-48">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm bg-white border rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-gray-400"
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* TABLE CARD */}
      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Users List</CardTitle>
        </CardHeader>

        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-gray-50">
                <tr className="text-left">
                  <th className="p-3 font-semibold">Username</th>
                  <th className="p-3 font-semibold">Email</th>
                  <th className="p-3 font-semibold">Status</th>{' '}
                  <th className="p-3 font-semibold">Role</th>
                  <th className="p-3 font-semibold">Department</th>
                  <th className="p-3 font-semibold text-right">Action</th>
                </tr>
              </thead>

              <tbody>
                {filteredUsers.length > 0 ? (
                  filteredUsers.map((u) => (
                    <tr
                      key={u.id}
                      className={`border-b hover:bg-gray-50 transition ${
                        u.is_active === false ? 'opacity-60 bg-gray-50/50' : ''
                      }`}
                    >
                      <td className="p-3 font-medium">
                        {u.username}
                        {u.is_active === false && (
                          <span className="ml-2 text-xs font-normal text-red-500">
                            (Inactive)
                          </span>
                        )}
                      </td>
                      <td className="p-3">{u.email}</td>

                      {/* STATUS BADGE */}
                      <td className="p-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                            u.is_active !== false
                              ? 'bg-green-100 text-green-700'
                              : 'bg-gray-200 text-gray-600'
                          }`}
                        >
                          {u.is_active !== false ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      {/* ROLE BADGE */}
                      <td className="p-3">
                        <span
                          className={`px-2 py-1 rounded-md text-xs font-semibold
                          ${
                            u.role === 'SUPER_ADMIN'
                              ? 'bg-red-100 text-red-700'
                              : u.role === 'HR'
                                ? 'bg-pink-100 text-pink-700'
                                : u.role === 'HOD'
                                  ? 'bg-indigo-100 text-indigo-700'
                                  : u.role === 'ADMIN_DEPT'
                                    ? 'bg-purple-100 text-purple-700'
                                    : u.role === 'PM'
                                      ? 'bg-green-100 text-green-700'
                                      : u.role === 'GA'
                                        ? 'bg-orange-100 text-orange-700'
                                        : 'bg-gray-100 text-gray-700'
                          }`}
                        >
                          {u.role}
                        </span>
                      </td>

                      <td className="p-3">{u.department ?? '-'}</td>

                      {/* ACTIONS */}
                      <td className="p-3 space-x-2 text-right">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSelectedUser(u);
                            setOpen(true);
                          }}
                          disabled={u.is_active === false}
                        >
                          Edit
                        </Button>

                        {/* TOMBOL DINAMIS (DISABLE / ENABLE) */}
                        {u.is_active !== false ? (
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={async () => {
                              if (!confirm(`Nonaktifkan user ${u.username}?`))
                                return;
                              await deleteUser(u.id);
                            }}
                          >
                            Disable
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="secondary"
                            className="!bg-green-600 !text-white hover:!bg-green-700 border border-green-700"
                            onClick={async () => {
                              if (
                                !confirm(`Aktifkan kembali user ${u.username}?`)
                              )
                                return;
                              await enableUser(u.id);
                            }}
                          >
                            Enable
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-gray-400">
                      No users found matching the search criteria.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* MODAL */}
      <UserFormDialog
        open={open}
        onOpenChange={(v) => {
          setOpen(v);
          if (!v) setSelectedUser(null);
        }}
        user={selectedUser}
      />
    </div>
  );
}
