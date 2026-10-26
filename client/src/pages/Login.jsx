import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Loader2,
  PieChart,
  ShieldCheck,
  Repeat,
  ArrowDownUp,
  Sparkles,
  Lock,
  Sun,
  Moon,
  Zap,
  CheckCircle2,
  Eye,
  EyeOff,
  BarChart3,
  TrendingUp,
} from 'lucide-react';
import Button from '../components/ui/Button';
import Input from '../components/ui/Input';
import { authApi } from '../api/auth';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import toast from 'react-hot-toast';

const schema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});

const DEMO_EMAIL = 'demo@spendwise.app';
const DEMO_PASSWORD = 'Sw!Demo-7rK2#vQ9xLm';

const features = [
  {
    icon: PieChart,
    title: 'Visual Spending Analytics',
    desc: 'Deep category breakdown donut charts, monthly burn-rates, and cash flow trends.',
  },
  {
    icon: ShieldCheck,
    title: 'Smart Budget Guardrails',
    desc: 'Set custom spending limits per category with instant over-budget proactive warnings.',
  },
  {
    icon: Repeat,
    title: 'Automated Recurring Rules',
    desc: 'Track recurring subscriptions, scheduled utilities, and upcoming cashflow cycles.',
  },
  {
    icon: ArrowDownUp,
    title: 'Instant CSV Portability',
    desc: 'One-click bank statement CSV import with preview validation & tax-ready exports.',
  },
];

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, user, loading: authLoading } = useAuth();
  const { resolvedTheme, setTheme } = useTheme();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const from = location.state?.from?.pathname || '/';

  // Redirect authenticated users to dashboard
  useEffect(() => {
    if (!authLoading && user) {
      navigate(from, { replace: true });
    }
  }, [user, authLoading, navigate, from]);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(schema),
  });

  const handleFillDemo = () => {
    setValue('email', DEMO_EMAIL, { shouldValidate: true });
    setValue('password', DEMO_PASSWORD, { shouldValidate: true });
    toast.success('Demo credentials loaded!');
  };

  const onSubmit = async (data) => {
    setLoading(true);
    try {
      await login(data.email, data.password);
      toast.success('Welcome back!');
      navigate(from, { replace: true });
    } catch (err) {
      const message = err?.message || err?.response?.data?.error?.message || 'Invalid credentials';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  // Show loader while redirecting instead of unmounting
  if (authLoading || user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#362e24]" role="status">
        <Loader2 className="w-8 h-8 text-[#F2A900] animate-spin" />
        <span className="sr-only">Redirecting...</span>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col lg:grid lg:grid-cols-12 bg-gray-50 dark:bg-[#362e24] text-gray-900 dark:text-[#F9E6A8] transition-colors duration-200">
      {/* Left Column: Website Info & Feature Showcase (Light and Dark Mode) */}
      <div className="lg:col-span-7 xl:col-span-7 bg-gradient-to-br from-amber-50/70 via-[#fcfaf6] to-amber-100/40 dark:bg-gradient-to-br dark:from-[#3b3125] dark:via-[#332a20] dark:to-[#2b2219] text-gray-900 dark:text-white p-6 sm:p-10 lg:p-12 xl:p-16 flex flex-col justify-between border-b lg:border-b-0 lg:border-r border-amber-200/80 dark:border-[#786144]/60 relative overflow-hidden transition-colors duration-200">
        {/* Ambient background glow orbs */}
        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-80 h-80 rounded-full bg-amber-200/50 dark:bg-[#F2A900]/15 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-80 h-80 rounded-full bg-amber-300/30 dark:bg-[#CC6F00]/20 blur-3xl pointer-events-none" />

        <div className="relative z-10">
          {/* Brand header */}
          <div className="flex items-center justify-between mb-8 sm:mb-12">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-[#F2A900] via-[#CC6F00] to-[#4D2A00] rounded-xl flex items-center justify-center shadow-lg shadow-[#F2A900]/25">
                <LayoutDashboard className="w-6 h-6 text-[#1a140d]" />
              </div>
              <span className="text-2xl font-bold tracking-tight text-gray-900 dark:text-white">
                Spend<span className="text-amber-600 dark:text-[#F2A900]">Wise</span>
              </span>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-100/90 dark:bg-amber-900/50 border border-amber-300 dark:border-amber-600/50 text-xs font-semibold text-amber-900 dark:text-[#FFFDF7] shadow-xs">
              <Sparkles className="w-3.5 h-3.5 text-amber-600 dark:text-[#F2A900]" />
              <span>Wealth Intelligence 2.0</span>
            </div>
          </div>

          {/* Hero text */}
          <div className="max-w-xl mb-10">
            <h2 className="text-3xl sm:text-4xl xl:text-5xl font-extrabold tracking-tight leading-tight text-gray-900 dark:text-white mb-4">
              Master your money with{' '}
              <span className="bg-gradient-to-r from-amber-600 via-[#CC6F00] to-amber-800 dark:from-[#F9E6A8] dark:via-[#F2A900] dark:to-[#CC6F00] bg-clip-text text-transparent">
                clarity and precision.
              </span>
            </h2>
            <p className="text-sm sm:text-base text-gray-600 dark:text-[#e5d4aa] leading-relaxed">
              SpendWise empowers you to track expenses, automate recurring bills, monitor category budgets,
              and gain deep visual insights—all in a high-performance, private workspace.
            </p>
          </div>

          {/* Feature Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-2xl mb-8">
            {features.map((feat, idx) => (
              <div
                key={idx}
                className="p-4 rounded-xl bg-white/85 dark:bg-[#453a2d]/80 border border-amber-200/80 dark:border-[#786144] shadow-xs hover:shadow-md hover:border-amber-400 dark:hover:border-[#CC6F00]/70 transition-all duration-200 group hover:bg-white dark:hover:bg-[#524435]"
              >
                <div className="w-9 h-9 rounded-lg bg-amber-100 dark:bg-gradient-to-br dark:from-[#5a4835] dark:to-[#3f3224] border border-amber-300/60 dark:border-[#CC6F00]/40 flex items-center justify-center text-amber-700 dark:text-[#F2A900] mb-3 group-hover:scale-105 transition-transform">
                  <feat.icon className="w-5 h-5" />
                </div>
                <h3 className="text-sm font-semibold text-gray-900 dark:text-[#FFFDF7] mb-1">{feat.title}</h3>
                <p className="text-xs text-gray-600 dark:text-[#d1bea0] leading-relaxed">{feat.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom trust bar & quick demo banner */}
        <div className="relative z-10 pt-6 border-t border-amber-200/80 dark:border-[#786144]/70 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-xs text-gray-600 dark:text-[#c4af85]">
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-amber-600 dark:text-[#F2A900]" />
              Zero telemetry
            </span>
            <span className="flex items-center gap-1.5">
              <Lock className="w-4 h-4 text-amber-600 dark:text-[#F2A900]" />
              Encrypted storage
            </span>
            <span className="flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-600 dark:text-[#F2A900]" />
              Real-time sync
            </span>
          </div>

          {/* One-click demo button */}
          <button
            type="button"
            onClick={handleFillDemo}
            className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-lg bg-white hover:bg-amber-50 dark:bg-[#4d3f31] dark:hover:bg-[#5e4d3c] border border-amber-300 dark:border-[#CC6F00] text-xs font-semibold text-amber-900 dark:text-[#FFFDF7] transition-colors shadow-xs"
            title="Auto-fill with test account demo@spendwise.app"
          >
            <Zap className="w-3.5 h-3.5 text-amber-600 dark:text-[#F2A900]" />
            <span>Load Demo Account</span>
          </button>
        </div>
      </div>

      {/* Right Column: Sign In Form */}
      <div className="lg:col-span-5 xl:col-span-5 flex flex-col justify-center items-center p-6 sm:p-10 lg:p-12 relative">
        {/* Top bar controls */}
        <div className="absolute top-6 right-6 flex items-center gap-2">
          <button
            type="button"
            className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 dark:text-[#F9E6A8] dark:hover:bg-[#554737] dark:hover:text-[#F2A900] transition-colors"
            onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
            title={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <Sun className="w-5 h-5 hidden dark:block text-[#F2A900]" />
            <Moon className="w-5 h-5 dark:hidden" />
          </button>
        </div>

        <div className="w-full max-w-md">
          {/* Heading */}
          <div className="text-center mb-8">
            <div className="lg:hidden inline-flex items-center justify-center w-14 h-14 bg-gradient-to-br from-[#F2A900] to-[#CC6F00] rounded-2xl mb-4 shadow-md shadow-[#F2A900]/20">
              <LayoutDashboard className="w-7 h-7 text-[#1a140d]" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-gray-900 dark:text-[#FFFDF7]">
              Welcome back
            </h1>
            <p className="text-sm text-gray-500 dark:text-[#decaa0] mt-2">
              Sign in to your SpendWise account
            </p>
          </div>

          {/* Form Card */}
          <div className="card p-6 sm:p-8 backdrop-blur-sm">
            <form data-testid="login-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
              <Input
                label="Email"
                type="email"
                placeholder="you@example.com"
                error={errors.email?.message}
                {...register('email')}
                autoComplete="username"
                name="email"
              />

              <div className="relative">
                <Input
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••••"
                  error={errors.password?.message}
                  {...register('password')}
                  autoComplete="current-password"
                  name="password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-[34px] text-gray-400 hover:text-gray-600 dark:text-[#c4af85] dark:hover:text-[#F9E6A8] transition-colors"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>

              <div className="pt-2">
                <Button type="submit" className="w-full btn-primary" loading={loading}>
                  Sign in
                </Button>
              </div>
            </form>

            {/* Quick Demo Helper Banner */}
            <div className="mt-6 pt-5 border-t border-gray-100 dark:border-gray-700">
              <div className="rounded-lg bg-gray-50 dark:bg-[#3d3327] p-3 border border-gray-200 dark:border-gray-700 flex items-center justify-between gap-3 text-xs">
                <div className="min-w-0">
                  <span className="font-semibold text-gray-700 dark:text-[#FFFDF7] block">Demo Credentials:</span>
                  <span className="text-gray-500 dark:text-[#decaa0] font-mono truncate block">
                    demo@spendwise.app
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleFillDemo}
                  className="shrink-0 px-2.5 py-1 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 dark:bg-[#4d3f31] dark:text-[#F2A900] dark:hover:bg-[#F2A900] dark:hover:text-[#1e170e] font-semibold transition-colors"
                >
                  Fill
                </button>
              </div>
            </div>

            <p className="mt-6 text-center text-sm text-gray-500 dark:text-[#ad8f55]">
              Don't have an account?{' '}
              <Link to="/register" className="text-indigo-600 dark:text-[#F2A900] hover:underline font-medium">
                Sign up
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}