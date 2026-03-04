import React, { useState, useEffect } from "react";
import { useTRFStore } from "@/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

// ✅ 1. IMPORT TIPE USER
import type { User, UserRole } from "@/types";

// ✅ 2. HILANGKAN ANY PADA PROPS
interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  user?: User | null; 
}

export default function UserFormDialog({ open, onOpenChange, user }: Props) {
  const { createUser, updateUser } = useTRFStore();

  const isEdit = !!user;
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ✅ 3. TIPE STATE FORM TEGAS AGAR USEEFFECT TIDAK ERROR
  const [form, setForm] = useState<{
    username: string;
    email: string;
    role: UserRole;
    department: string;
  }>({
    username: "",
    email: "",
    role: "EMPLOYEE",
    department: "",
  });

  useEffect(() => {
    if (user) {
      setForm({
        username: user.username,
        email: user.email,
        role: user.role,
        department: user.department || "",
      });
    } else {
      setForm({
        username: "",
        email: "",
        role: "EMPLOYEE",
        department: "",
      });
    }
  }, [user, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (isEdit && user) {
        await updateUser(user.id, form);
        toast.success("User updated successfully!");
      } else {
        await createUser(form);
        toast.success("User created successfully!");
      }
      onOpenChange(false);
    } catch (error) { 
      // ✅ 4. HILANGKAN ANY DI CATCH BLOCK!
      console.error(error);
      // Pengecekan tipe error yang aman ala Enterprise
      const errorMessage = error instanceof Error ? error.message : "Something went wrong!";
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit User" : "Add New User"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Username</label>
            <Input
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              required
              placeholder="johndoe"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Email</label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              required
              placeholder="john@example.com"
              disabled={isEdit} 
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Role</label>
            <select
              className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm"
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value as UserRole })}
            >
              <option value="EMPLOYEE">EMPLOYEE</option>
              <option value="ADMIN_DEPT">ADMIN_DEPT</option>
              <option value="HOD">HOD</option>
              <option value="HR">HR</option>
              <option value="PM">PM</option>
              <option value="GA">GA</option>
              <option value="SUPER_ADMIN">SUPER_ADMIN</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Department</label>
            <Input
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
              placeholder="e.g. IT, HR, Finance"
            />
          </div>

          <DialogFooter className="pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 