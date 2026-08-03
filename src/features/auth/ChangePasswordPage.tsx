import React, {
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';

import {
  CheckCircle2,
  Loader2,
  ShieldAlert,
} from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  AppSessionApiError,
  changeAppPassword,
} from '@/lib/appSession';
import { useAuthStore } from '@/store';

const ChangePasswordPage: React.FC = () => {
  const navigate = useNavigate();

  const currentUser = useAuthStore(
    (state) => state.currentUser,
  );

  const login = useAuthStore(
    (state) => state.login,
  );

  const [
    newPassword,
    setNewPassword,
  ] = useState('');

  const [
    confirmPassword,
    setConfirmPassword,
  ] = useState('');

  const [
    isSubmitting,
    setIsSubmitting,
  ] = useState(false);

  const updatePassword = async () => {
    if (
      !newPassword ||
      !confirmPassword
    ) {
      toast.error(
        'Semua kolom wajib diisi',
      );
      return;
    }

    if (
      newPassword !==
      confirmPassword
    ) {
      toast.error(
        'Password baru dan konfirmasi tidak cocok',
      );
      return;
    }

    if (
      newPassword.length < 8 ||
      !/[A-Za-z]/.test(
        newPassword,
      ) ||
      !/\d/.test(newPassword)
    ) {
      toast.error(
        'Password minimal 8 karakter dan harus mengandung huruf serta angka',
      );
      return;
    }

    if (!currentUser?.id) {
      toast.error(
        'Sesi tidak valid, silakan login ulang',
      );

      navigate('/login', {
        replace: true,
      });

      return;
    }

    setIsSubmitting(true);

    try {
      const updatedUser =
        await changeAppPassword(
          newPassword,
        );

      login(updatedUser);

      toast.success(
        'Password berhasil diperbarui',
      );

      navigate('/', {
        replace: true,
      });
    } catch (error) {
      console.error(
        'Change password error:',
        error,
      );

      if (
        error instanceof
        AppSessionApiError
      ) {
        toast.error(error.message);

        if (
          error.status === 401
        ) {
          navigate('/login', {
            replace: true,
          });
        }
      } else {
        toast.error(
          'Gagal mengubah password. Silakan coba lagi.',
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-3 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <ShieldAlert className="h-6 w-6 text-amber-700" />
          </div>

          <CardTitle className="text-2xl">
            Ubah Password Default
          </CardTitle>

          <p className="text-sm text-gray-500">
            Demi keamanan, Anda diwajibkan mengubah password bawaan sebelum melanjutkan.
          </p>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Password Baru
            </label>

            <input
              type="password"
              value={newPassword}
              autoComplete="new-password"
              disabled={isSubmitting}
              onChange={(event) =>
                setNewPassword(
                  event.target.value,
                )
              }
              className="w-full rounded-md border p-3 text-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black"
              placeholder="Minimal 8 karakter, huruf dan angka"
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Konfirmasi Password Baru
            </label>

            <input
              type="password"
              value={confirmPassword}
              autoComplete="new-password"
              disabled={isSubmitting}
              onChange={(event) =>
                setConfirmPassword(
                  event.target.value,
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter'
                ) {
                  void updatePassword();
                }
              }}
              className="w-full rounded-md border p-3 text-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black"
              placeholder="Ulangi password baru"
            />
          </div>

          <Button
            type="button"
            className="w-full"
            disabled={isSubmitting}
            onClick={() =>
              void updatePassword()
            }
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Menyimpan...
              </>
            ) : (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Simpan &amp; Lanjutkan
              </>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChangePasswordPage;
