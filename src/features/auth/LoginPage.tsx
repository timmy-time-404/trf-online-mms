import React, {
  useState,
} from 'react';
import { useNavigate } from 'react-router-dom';

import {
  ArrowRight,
  KeyRound,
  Loader2,
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
  loginWithAppSession,
} from '@/lib/appSession';
import { useAuthStore } from '@/store';

const LoginPage: React.FC = () => {
  const navigate = useNavigate();
  const login = useAuthStore(
    (state) => state.login,
  );

  const [
    employeeId,
    setEmployeeId,
  ] = useState('');

  const [
    password,
    setPassword,
  ] = useState('');

  const [
    isLoggingIn,
    setIsLoggingIn,
  ] = useState(false);

  const handleLogin = async () => {
    const username =
      employeeId.trim();

    if (!username || !password) {
      toast.error(
        'Username dan Password wajib diisi',
      );
      return;
    }

    setIsLoggingIn(true);

    try {
      const result =
        await loginWithAppSession(
          username,
          password,
        );

      login(result.user);

      if (
        result.user.mustChangePassword
      ) {
        toast.success(
          'Silakan ubah password sementara Anda untuk melanjutkan',
        );

        navigate('/change-password', {
          replace: true,
        });

        return;
      }

      toast.success(
        `Welcome back, ${result.user.username}!`,
      );

      navigate('/', {
        replace: true,
      });
    } catch (error) {
      console.error(
        'Login error:',
        error,
      );

      if (
        error instanceof
        AppSessionApiError
      ) {
        toast.error(error.message);
      } else {
        toast.error(
          'Login gagal. Pastikan koneksi internet stabil.',
        );
      }
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <Card className="mx-auto mt-20 w-full max-w-md border-t-4 border-t-black shadow-lg">
      <CardHeader className="space-y-2 pb-6 text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          <KeyRound className="h-6 w-6 text-gray-700" />
        </div>

        <CardTitle className="text-2xl font-bold">
          TRF System
        </CardTitle>

        <p className="text-sm text-gray-500">
          Masukkan Username dan Password Anda
        </p>
      </CardHeader>

      <CardContent className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Username / Employee ID
            </label>

            <input
              className="w-full rounded-md border p-3 text-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black"
              placeholder="Masukkan Username"
              value={employeeId}
              autoComplete="username"
              disabled={isLoggingIn}
              onChange={(event) =>
                setEmployeeId(
                  event.target.value,
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter'
                ) {
                  void handleLogin();
                }
              }}
            />
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700">
              Password
            </label>

            <input
              type="password"
              className="w-full rounded-md border p-3 text-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black"
              placeholder="Masukkan Password"
              value={password}
              autoComplete="current-password"
              disabled={isLoggingIn}
              onChange={(event) =>
                setPassword(
                  event.target.value,
                )
              }
              onKeyDown={(event) => {
                if (
                  event.key === 'Enter'
                ) {
                  void handleLogin();
                }
              }}
            />
          </div>
        </div>

        <Button
          type="button"
          onClick={() =>
            void handleLogin()
          }
          className="w-full bg-black text-white hover:bg-gray-800"
          size="lg"
          disabled={isLoggingIn}
        >
          {isLoggingIn ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              Login to Dashboard
              <ArrowRight className="ml-2 h-4 w-4" />
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};

export default LoginPage;
