import React from "react";
import type { User } from "@/types";
interface UserTableProps {
  users: User[];
}

// ✅ 3. Pasangkan tipe UserTableProps ke komponen
export default function UserTable({ users }: UserTableProps) {
  return (
    <div className="border rounded-lg">
      <table className="w-full">
        <thead>
          <tr className="bg-gray-50 text-left">
            <th className="p-3">Username</th>
            <th>Email</th>
            <th>Role</th>
            <th>Department</th>
          </tr>
        </thead>

        <tbody>
          {/* ✅ 4. Sekarang TypeScript tahu persis bahwa 'u' adalah sebuah 'User' */}
          {users.map((u) => (
            <tr key={u.id} className="border-t">
              <td className="p-3">{u.username}</td>
              <td>{u.email}</td>
              <td>{u.role}</td>
              <td>{u.department || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}