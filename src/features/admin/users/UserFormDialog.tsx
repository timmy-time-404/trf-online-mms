import { useState, useEffect } from "react";
import { useTRFStore } from "@/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// Fungsi untuk auto-generate username dari email
const generateUsername = (email: string) => {
  if (!email) return "";
  return email.split("@")[0].toLowerCase().replace(/\s+/g, ".");
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: any; // ✅ Kalau ada isinya, berarti mode Edit
}

export default function UserFormDialog({ open, onOpenChange, user }: Props) {
  const { createUser, updateUser, fetchUsers } = useTRFStore();

  const isEdit = !!user;

  const [form, setForm] = useState({
    username: "",
    email: "",
    role: "EMPLOYEE",
    department: "",
  });

  // ✅ Prefill saat mode edit
  useEffect(() => {
    if (user) {
      setForm({
        username: user.username,
        email: user.email,
        role: user.role,
        department: user.department || "",
      });
    } else {
      // Reset form jika ditutup/buka untuk Create
      setForm({
        username: "",
        email: "",
        role: "EMPLOYEE",
        department: "",
      });
    }
  }, [user, open]);

  const submit = async () => {
    try {
      if (isEdit) {
        await updateUser(user.id, form);
        toast.success("User updated successfully");
      } else {
        await createUser(form);
        toast.success("User created successfully");
      }

      await fetchUsers();
      onOpenChange(false);
    } catch (err: any) {
      toast.error(err.message || "Failed to save user");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit User" : "Create New User"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <Input
            className="w-full bg-gray-100"
            placeholder="Username"
            value={form.username}
            readOnly
          />

          <Input
            className="w-full"
            placeholder="Email"
            value={form.email}
            onChange={(e) => {
              const email = e.target.value;
              setForm({
                ...form,
                email,
                // Hanya auto-generate username saat Create (bukan Edit)
                username: isEdit ? form.username : generateUsername(email),
              });
            }}
          />

          <select
            className="w-full border rounded-md p-2 text-sm"
            value={form.role}
            onChange={(e) =>
              setForm({ ...form, role: e.target.value })
            }
          >
            <option value="EMPLOYEE">Employee</option>
            <option value="ADMIN_DEPT">Admin Dept</option>
            <option value="HOD">HOD</option>
            <option value="HR">HR</option>
            <option value="PM">PM</option>
            <option value="GA">GA</option>
            <option value="SUPER_ADMIN">Super Admin</option>
          </select>

          <Input
            className="w-full"
            placeholder="Department (optional)"
            value={form.department}
            onChange={(e) =>
              setForm({ ...form, department: e.target.value })
            }
          />

          <Button className="w-full" onClick={submit}>
            {isEdit ? "Save Changes" : "Create User"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}