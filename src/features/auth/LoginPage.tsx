import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store';
import { ArrowRight, Loader2, KeyRound } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import bcrypt from "bcryptjs";

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();

  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  const handleLogin = async () => {
    if (!employeeId || !password) {
      toast.error("Username dan Password wajib diisi");
      return;
    }

    setIsLoggingIn(true);

    try {
      const { data: user, error } = await supabase
        .from("users")
        .select("*")
        .eq("username", employeeId)
        .eq("is_active", true)
        .single();

      if (error || !user) {
        toast.error("User tidak ditemukan atau tidak aktif");
        return;
      }

      // Verifikasi Password Hash
      // const valid = await bcrypt.compare(password, user.password_hash);
      const valid = true; //no password

      if (!valid) {
        toast.error("Password salah");
        return;
      }

      // Set State di Zustand
      login({
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        employeeId: user.employee_id,
        department: user.department
      });

      // 🔥 FORCE CHANGE PASSWORD ROUTING
      if (user.must_change_password) {
        toast.success("Silakan ubah password default Anda untuk melanjutkan");
        navigate("/change-password");
        return;
      }

      toast.success(`Welcome back, ${user.username}!`);
      navigate("/");

    } catch (err: any) {
      console.error(err);
      toast.error("Login gagal. Pastikan koneksi internet stabil.");
    } finally {
      setIsLoggingIn(false);
    }
  };
  

  return (
    <Card className="w-full shadow-lg max-w-md mx-auto mt-20 border-t-4 border-t-black">
      <CardHeader className="text-center pb-6 space-y-2">
        <div className="mx-auto w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mb-2">
          <KeyRound className="w-6 h-6 text-gray-700" />
        </div>
        <CardTitle className="text-2xl font-bold">TRF System</CardTitle>
        <p className="text-sm text-gray-500">
          Masukkan Username dan Password Anda
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Username / Employee ID</label>
            <input
              className="w-full border rounded-md p-3 text-sm focus:ring-2 focus:ring-black focus:border-black outline-none transition"
              placeholder="Masukkan Username"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Password</label>
            <input
              type="password"
              className="w-full border rounded-md p-3 text-sm focus:ring-2 focus:ring-black focus:border-black outline-none transition"
              placeholder="Masukkan Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()}
            />
          </div>
        </div>

        <Button
          onClick={handleLogin}
          className="w-full bg-black text-white hover:bg-gray-800"
          size="lg"
          disabled={isLoggingIn}
        >
          {isLoggingIn ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Verifying...</>
          ) : (
            <>Login to Dashboard <ArrowRight className="w-4 h-4 ml-2" /></>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};


export default LoginPage;