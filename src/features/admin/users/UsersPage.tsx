import { useEffect, useState } from "react";
import { useTRFStore } from "@/store";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import UserFormDialog from "./UserFormDialog";

export default function UsersPage() {
  const { users, fetchUsers, deleteUser } = useTRFStore();
  const [open, setOpen] = useState(false);
  
  // ✅ State untuk mode edit
  const [selectedUser, setSelectedUser] = useState<any>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

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
            setSelectedUser(null); // Pastikan state kosong untuk Create
            setOpen(true);
          }}
          className="bg-black text-white hover:bg-gray-800"
        >
          + Create User
        </Button>
      </div>

      {/* TABLE CARD */}
      <Card className="border shadow-sm">
        <CardHeader>
          <CardTitle className="text-lg">Users List</CardTitle>
        </CardHeader>

        <CardContent>
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr className="text-left">
                <th className="p-3 font-semibold">Username</th>
                <th className="p-3 font-semibold">Email</th>
                <th className="p-3 font-semibold">Role</th>
                <th className="p-3 font-semibold">Department</th>
                <th className="p-3 font-semibold text-right">Action</th>
              </tr>
            </thead>

            <tbody>
              {users.map((u) => (
                <tr
                  key={u.id}
                  className="border-b hover:bg-gray-50 transition"
                >
                  <td className="p-3 font-medium">{u.username}</td>
                  <td className="p-3">{u.email}</td>

                  {/* ROLE BADGE */}
                  <td className="p-3">
                    <span
                      className={`px-2 py-1 rounded-md text-xs font-semibold
                      ${
                        u.role === "SUPER_ADMIN"
                          ? "bg-red-100 text-red-700"
                          : u.role === "HR"
                          ? "bg-pink-100 text-pink-700"
                          : u.role === "HOD"
                          ? "bg-indigo-100 text-indigo-700"
                          : u.role === "ADMIN_DEPT"
                          ? "bg-purple-100 text-purple-700"
                          : u.role === "PM"
                          ? "bg-green-100 text-green-700"
                          : u.role === "GA"
                          ? "bg-orange-100 text-orange-700"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {u.role}
                    </span>
                  </td>

                  <td className="p-3">{u.department ?? "-"}</td>
                  
                  {/* ✅ ACTIONS: Edit & Disable */}
                  <td className="p-3 text-right space-x-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setSelectedUser(u);
                        setOpen(true);
                      }}
                    >
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={async () => {
                        if (!confirm("Nonaktifkan user ini?")) return;
                        await deleteUser(u.id);
                      }}
                    >
                      Disable
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* ✅ MODAL dengan handling selectedUser */}
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