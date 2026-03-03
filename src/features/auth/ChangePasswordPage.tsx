import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuthStore } from '@/store';
import { ShieldAlert, Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/lib/supabase';
import bcrypt from "bcryptjs";

const ChangePasswordPage: React.FC = () => {
  const navigate = useNavigate();
  
  // Mengambil data user yang sedang login sementara (karena dia belum ganti password)
  const { currentUser } = useAuthStore();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const updatePassword = async () => {
    // 1. Validasi Input
    if (!newPassword || !confirmPassword) {
      toast.error('Semua kolom wajib diisi');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Password baru dan konfirmasi tidak cocok!');
      return;
    }

    if (newPassword.length < 6) {
      toast.error('Password minimal terdiri dari 6 karakter');
      return;
    }

    if (!currentUser?.id) {
      toast.error('Sesi tidak valid, silakan login ulang');
      navigate('/login');
      return;
    }

    setIsSubmitting(true);

    try {
      // 🔥 2. LOGIC DARI "MAHA DEWA CODING" DIMASUKKAN DI SINI
      const hash = await bcrypt.hash(newPassword, 10);

      const { error } = await supabase
        .from("users")
        .update({
          password_hash: hash,
          must_change_password: false // Lepas status wajib ganti password
        })
        .eq("id", currentUser.id);

      if (error) throw error;

      // 3. Sukses
      toast.success("Password berhasil diperbarui!");
      navigate("/"); // Lempar kembali ke halaman utama/dashboard

    } catch (err: any) {
      console.error(err);
      toast.error("Gagal mengubah password. Silakan coba lagi.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card className="w-full shadow-lg max-w-md mx-auto mt-20 border-t-4 border-t-red-600">
      <CardHeader className="text-center pb-6 space-y-2">
        <div className="mx-auto w-12 h-12 bg-red-50 rounded-full flex items-center justify-center mb-2">
          <ShieldAlert className="w-6 h-6 text-red-600" />
        </div>
        <CardTitle className="text-2xl font-bold">Ubah Password Default</CardTitle>
        <p className="text-sm text-gray-500">
          Demi keamanan, Anda diwajibkan untuk mengubah password bawaan sistem sebelum melanjutkan.
        </p>
      </CardHeader>
      
      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Password Baru</label>
            <input
              type="password"
              className="w-full border rounded-md p-3 text-sm focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition"
              placeholder="Masukkan password baru"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">Konfirmasi Password Baru</label>
            <input
              type="password"
              className="w-full border rounded-md p-3 text-sm focus:ring-2 focus:ring-red-600 focus:border-red-600 outline-none transition"
              placeholder="Ketik ulang password baru"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && updatePassword()}
            />
          </div>
        </div>

        <Button
          onClick={updatePassword}
          className="w-full bg-red-600 text-white hover:bg-red-700"
          size="lg"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Menyimpan...</>
          ) : (
            <><CheckCircle2 className="w-4 h-4 mr-2" /> Simpan & Lanjutkan</>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default ChangePasswordPage;