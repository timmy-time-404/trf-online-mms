import { useState, useEffect } from "react";
import { useTRFStore } from "@/store";
import UserFormDialog from "./UserFormDialog";

const UserManagementPage = () => {
  const { users, fetchUsers } = useTRFStore();
  const [open, setOpen] = useState(false);

  // ✅ State untuk menyimpan data user yang sedang diedit
  const [editingUser, setEditingUser] = useState<any>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  // ✅ Fungsi untuk handle klik edit
  const editUser = (user: any) => {
    setEditingUser(user);
    // TODO: Nantinya ini akan membuka modal edit
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">User Management</h1>
          <p className="text-sm text-gray-500">Manage system users and permissions</p>
        </div>
        <UserFormDialog />
      </div>

      {/* TABLE */}
      <div className="bg-white border rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600">
            <tr>
              <th className="text-left p-3">Username</th>
              <th className="text-left p-3">Email</th>
              <th className="text-left p-3">Role</th>
              <th className="text-left p-3">Department</th>
              {/* ✅ Tambahan Header Action */}
              <th className="text-right p-3">Action</th>
            </tr>
          </thead>

          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="p-3">{u.username}</td>
                <td className="p-3">{u.email}</td>
                
                {/* ✅ Badge Role Berwarna */}
                <td className="p-3">
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-semibold ${
                      ({
                        EMPLOYEE: "bg-gray-100 text-gray-700",
                        ADMIN_DEPT: "bg-purple-100 text-purple-700",
                        HOD: "bg-indigo-100 text-indigo-700",
                        HR: "bg-pink-100 text-pink-700",
                        PM: "bg-green-100 text-green-700",
                        GA: "bg-orange-100 text-orange-700",
                        SUPER_ADMIN: "bg-red-100 text-red-700",
                      } as Record<string, string>)[u.role] || "bg-gray-100 text-gray-700"
                    }`}
                  >
                    {u.role}
                  </span>
                </td>
                
                <td className="p-3">{u.department || "-"}</td>
                
                {/* ✅ Tombol Edit Action */}
                <td className="p-3 text-right">
                  <button
                    className="text-blue-600 hover:text-blue-800 hover:underline font-medium text-sm"
                    onClick={() => editUser(u)}
                  >
                    Edit
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default UserManagementPage;