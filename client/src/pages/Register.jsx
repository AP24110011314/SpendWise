import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, Link } from 'react-router-dom';
import { LayoutDashboard, Sun, Moon } from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { authApi } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';

const schema = z.object({
  name: z.string().min(1, 'Name is required').max(80, 'Name too long'),
  email: z.string().email('Invalid email'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string(),
}).refine(data => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export default function Register() {
  const navigate = useNavigate();
  const { register: registerUser, user, loading: authLoading } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [loading, setLoading] = useState(false);

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!authLoading && user) {
      navigate('/', { replace: true });
    }
  }, [user, authLoading, navigate]);

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(schema),
  });

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await registerUser(data.name, data.email, data.password);
      toast.success('Account created!');
      navigate('/', { replace: true });
    } catch (err) {
      const message = err?.message || err?.response?.data?.error?.message || 'Registration failed';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Don't render form if redirecting
  if (authLoading || user) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#362e24] px-4 py-12 relative transition-colors duration-200">
      <div className="absolute top-6 right-6">
        <button
          type="button"
          className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-[#F9E6A8] dark:hover:bg-[#554737] dark:hover:text-[#F2A900] transition-colors"
          onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          aria-label="Toggle theme"
        >
          <Sun className="w-5 h-5 hidden dark:block text-[#F2A900]" />
          <Moon className="w-5 h-5 dark:hidden" />
        </button>
      </div>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-[#F2A900] via-[#CC6F00] to-[#4D2A00] rounded-2xl mb-4 shadow-lg shadow-[#F2A900]/25">
            <LayoutDashboard className="w-7 h-7 text-[#120b02]" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-[#F9E6A8]">Create your account</h1>
          <p className="text-gray-500 dark:text-[#c4a96b] mt-2">Start tracking your finances with SpendWise</p>
        </div>

        <div className="card p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <Input
              label="Name"
              type="text"
              placeholder="John Doe"
              error={errors.name?.message}
              {...register('name')}
              autoComplete="name"
              name="name"
            />

            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register('email')}
              autoComplete="username"
              name="email"
            />

            <Input
              label="Password"
              type="password"
              placeholder="••••••••"
              error={errors.password?.message}
              {...register('password')}
              autoComplete="new-password"
              name="password"
            />

            <Input
              label="Confirm Password"
              type="password"
              placeholder="••••••••"
              error={errors.confirmPassword?.message}
              {...register('confirmPassword')}
              autoComplete="new-password"
              name="confirmPassword"
            />

            <Button type="submit" className="w-full btn-primary" loading={loading}>
              Create account
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500 dark:text-[#ad8f55]">
            Already have an account?{' '}
            <Link to="/login" className="text-indigo-600 dark:text-[#F2A900] hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}