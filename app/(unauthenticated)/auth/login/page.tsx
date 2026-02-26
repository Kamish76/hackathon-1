'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, Mail, Lock, AlertCircle, Eye, EyeOff, CheckCircle2, Wifi, ScanLine, Users, BarChart3, ShieldCheck, Server } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, loginWithGoogle } = useAuth();

  useEffect(() => {
    if (searchParams.get('error') === 'oauth_failed') {
      setError('Google authentication failed. Please try again.');
    }
    if (searchParams.get('registered') === 'true') {
      setSuccessMessage('Registration successful! Please login with your credentials.');
      console.log('✅ User redirected after successful registration');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    console.log('🔵 Login form submitted with email:', email);

    try {
      console.log('Calling login function...');
      const success = await login(email, password);
      
      if (success) {
        console.log('✅ Login successful, redirecting to dashboard...');
        router.push('/dashboard');
      } else {
        console.error('❌ Login failed: login function returned false');
        setError('Invalid email or password');
      }
    } catch (err) {
      console.error('❌ Login failed with exception:', err);
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setIsGoogleLoading(true);

    console.log('🔵 Attempting Google sign-in...');
    const success = await loginWithGoogle();
    
    if (!success) {
      console.error('❌ Google sign-in failed');
      setError('Unable to start Google sign in. Please try again.');
      setIsGoogleLoading(false);
    } else {
      console.log('✅ Google sign-in initiated, redirecting...');
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f8f9fa]">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-[50%] relative flex-col justify-between p-12 overflow-hidden bg-[#0f172a]">

        {/* Background layers */}
        <div className="absolute inset-0 bg-linear-to-br from-[#0f172a] via-[#1e293b] to-[#0f172a]" />

        {/* Dot-grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: 'radial-gradient(circle, #94a3b8 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        />

        {/* Accent glow blobs */}
        <div className="absolute -top-32 -left-32 w-96 h-96 rounded-full bg-[#3b82f6] opacity-10 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 right-0 w-80 h-80 rounded-full bg-[#10b981] opacity-10 blur-3xl pointer-events-none" />

        {/* ── TOP: Logo ── */}
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex items-center justify-center w-11 h-11 rounded-xl bg-white/10 border border-white/20">
            <Shield className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white leading-tight">NFC Access Control</h1>
            <p className="text-[#64748b] text-xs">School-wide Ingress/Egress System</p>
          </div>
        </div>

        {/* ── MIDDLE: Headline + stats + cards ── */}
        <div className="relative z-10 space-y-7 flex flex-col items-center text-center">

          {/* Headline */}
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#10b981]/10 border border-[#10b981]/30 mb-4">
              <Wifi className="w-3.5 h-3.5 text-[#10b981]" />
              <span className="text-[#10b981] text-xs font-medium tracking-wide uppercase">Live System</span>
            </div>
            <h2 className="text-4xl font-bold text-white leading-tight mb-3">
              Secure Access,<br />
              <span className="text-transparent bg-clip-text bg-linear-to-r from-[#38bdf8] to-[#10b981]">
                Instantly Managed
              </span>
            </h2>
            <p className="text-[#94a3b8] text-sm leading-relaxed">
              Real-time NFC scanning for every gate — track student, staff, and visitor movement across your campus.
            </p>
          </div>

          {/* Stat strip */}
          <div className="grid grid-cols-3 gap-3 w-full">
            {[
              { value: '500+', label: 'Students tracked' },
              { value: '99.9%', label: 'Scan accuracy' },
              { value: '<1s', label: 'Response time' },
            ].map((s, i) => (
              <div key={i} className="flex flex-col items-center justify-center py-3 px-2 rounded-xl bg-white/5 border border-white/10 text-center">
                <span className="text-white text-xl font-bold leading-none">{s.value}</span>
                <span className="text-[#64748b] text-xs mt-1 leading-tight">{s.label}</span>
              </div>
            ))}
          </div>

          {/* Feature cards — 2-column grid */}
          <div className="grid grid-cols-2 gap-3 w-full">
            {[
              {
                icon: <ScanLine className="w-4 h-4 text-[#38bdf8]" />,
                bg: 'bg-[#38bdf8]/10',
                title: 'NFC & QR Scanning',
                desc: 'Sub-second reads at every gate.',
              },
              {
                icon: <Users className="w-4 h-4 text-[#a78bfa]" />,
                bg: 'bg-[#a78bfa]/10',
                title: 'Role-Based Access',
                desc: 'Admin & Officer portals.',
              },
              {
                icon: <BarChart3 className="w-4 h-4 text-[#10b981]" />,
                bg: 'bg-[#10b981]/10',
                title: 'Reports & Exports',
                desc: 'Daily logs and CSV exports.',
              },
              {
                icon: <ShieldCheck className="w-4 h-4 text-[#fb923c]" />,
                bg: 'bg-[#fb923c]/10',
                title: 'Anti-Passback',
                desc: 'Prevents duplicate entries.',
              },
            ].map((f, i) => (
              <div key={i} className="flex flex-col items-center gap-2.5 px-4 py-3.5 rounded-xl bg-white/5 border border-white/10 text-center">
                <div className={`w-8 h-8 rounded-lg ${f.bg} flex items-center justify-center`}>
                  {f.icon}
                </div>
                <div>
                  <p className="text-white text-xs font-semibold">{f.title}</p>
                  <p className="text-[#475569] text-xs leading-relaxed mt-0.5">{f.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── BOTTOM: copyright ── */}
        <div className="relative z-10 text-[#334155] text-xs text-center">
          © 2026 NFC Access Control System. All rights reserved.
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8 relative overflow-hidden">
        {/* Subtle background */}
        <div
          className="absolute inset-0 opacity-[0.4]"
          style={{
            backgroundImage: 'radial-gradient(circle, #cbd5e1 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <div className="absolute top-0 right-0 w-96 h-96 rounded-full bg-[#e0f2fe] opacity-40 blur-3xl pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-72 h-72 rounded-full bg-[#d1fae5] opacity-30 blur-3xl pointer-events-none" />

        <div className="relative z-10 w-full max-w-md">
          {/* Mobile Logo */}
          <div className="lg:hidden flex items-center gap-2 mb-8">
            <Shield className="w-8 h-8 text-[#1e293b]" />
            <div>
              <h1 className="text-xl font-bold text-[#0f172a]">NFC Access Control</h1>
              <p className="text-[#64748b] text-xs">School-wide System</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#e2e8f0] p-8 shadow-sm">
            <div className="mb-8">
              <h2 className="text-2xl font-bold text-[#0f172a] mb-2">Welcome back</h2>
              <p className="text-[#64748b]">Enter your credentials to access your account</p>
            </div>

            {successMessage && (
              <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-start gap-3">
                <CheckCircle2 className="w-5 h-5 text-green-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-green-800 font-medium">Success!</p>
                  <p className="text-sm text-green-700">{successMessage}</p>
                </div>
              </div>
            )}

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-800 font-medium">Authentication Failed</p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Email Input */}
              <div>
                <label htmlFor="email" className="block text-sm font-medium text-[#0f172a] mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#64748b]" />
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 border border-[#e2e8f0] rounded-lg text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#1e293b] focus:ring-2 focus:ring-[#1e293b]/10 transition-colors"
                    placeholder="admin@school.edu"
                    required
                  />
                </div>
              </div>

              {/* Password Input */}
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-[#0f172a] mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#64748b]" />
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-12 py-2.5 border border-[#e2e8f0] rounded-lg text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#1e293b] focus:ring-2 focus:ring-[#1e293b]/10 transition-colors"
                    placeholder="Enter your password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#64748b] hover:text-[#0f172a] transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              {/* Remember Me & Forgot Password */}
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    className="w-4 h-4 border-[#e2e8f0] rounded text-[#1e293b] focus:ring-2 focus:ring-[#1e293b]/10"
                  />
                  <span className="text-sm text-[#64748b]">Remember me</span>
                </label>
                <a href="#" className="text-sm text-[#1e293b] hover:underline font-medium">
                  Forgot password?
                </a>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading || isGoogleLoading}
                className="w-full py-2.5 bg-[#1e293b] text-white rounded-lg font-medium hover:bg-[#334155] focus:outline-none focus:ring-2 focus:ring-[#1e293b] focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    Signing in...
                  </span>
                ) : (
                  'Sign in'
                )}
              </button>

              <div className="flex items-center gap-3 text-xs text-[#94a3b8]">
                <div className="h-px flex-1 bg-[#e2e8f0]" />
                <span>OR</span>
                <div className="h-px flex-1 bg-[#e2e8f0]" />
              </div>

              <button
                type="button"
                onClick={handleGoogleSignIn}
                disabled={isGoogleLoading || isLoading}
                className="w-full py-2.5 border border-[#e2e8f0] text-[#0f172a] rounded-lg font-medium hover:bg-[#f8f9fa] focus:outline-none focus:ring-2 focus:ring-[#1e293b] focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isGoogleLoading ? 'Redirecting to Google...' : 'Continue with Google'}
              </button>
            </form>

            {/* Sign Up Link */}
            <div className="mt-6 pt-6 border-t border-[#e2e8f0] text-center">
              <p className="text-sm text-[#64748b]">
                Don&apos;t have an account?{' '}
                <a href="/auth/registration" className="text-[#1e293b] hover:underline font-medium">
                  Sign up here
                </a>
              </p>
            </div>
          </div>

          {/* Trust badges */}
          <div className="mt-6 flex items-center justify-center gap-5 flex-wrap">
            <div className="flex items-center gap-1.5 text-[#94a3b8] text-xs">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Encrypted</span>
            </div>
            <div className="flex items-center gap-1.5 text-[#94a3b8] text-xs">
              <Lock className="w-3.5 h-3.5" />
              <span>Role-secured</span>
            </div>
            <div className="flex items-center gap-1.5 text-[#94a3b8] text-xs">
              <Server className="w-3.5 h-3.5" />
              <span>Hosted on Supabase</span>
            </div>
          </div>

          <p className="text-center text-xs text-[#cbd5e1] mt-4">
            Need help? Contact your system administrator
          </p>
        </div>
      </div>
    </div>
  );
}
