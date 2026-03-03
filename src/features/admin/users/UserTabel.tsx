export default function UserTable({ users }) {
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
          {users.map(u => (
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