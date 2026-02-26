'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, Mail, Lock, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, loginWithGoogle, user } = useAuth();

  // Redirect if already logged in
  useEffect(() => {
    if (user) {
      router.push('/dashboard');
    }
  }, [user, router]);

  useEffect(() => {
    if (searchParams.get('error') === 'oauth_failed') {
      setError('Google authentication failed. Please try again.');
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const success = await login(email, password);
      if (success) {
        router.push('/dashboard');
      } else {
        setError('Invalid email or password');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setError('');
    setIsGoogleLoading(true);

    const success = await loginWithGoogle();
    if (!success) {
      setError('Unable to start Google sign in. Please try again.');
      setIsGoogleLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#f8f9fa]">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#1e293b] flex-col justify-between p-12">
        <div className="flex items-center gap-3">
          <Shield className="w-10 h-10 text-white" />
          <div>
            <h1 className="text-2xl font-bold text-white">NFC Access Control</h1>
            <p className="text-[#94a3b8] text-sm">School-wide Ingress/Egress System</p>
          </div>
        </div>

        <div>
          <h2 className="text-3xl font-bold text-white mb-4">
            Secure Access Management
          </h2>
          <p className="text-[#cbd5e1] text-lg mb-8">
            Track and monitor student, staff, and visitor movement with real-time NFC scanning technology.
          </p>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-[#10b981] mt-2"></div>
              <div>
                <p className="text-white font-medium">Real-time Tracking</p>
                <p className="text-[#94a3b8] text-sm">Monitor ingress and egress events instantly</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-[#10b981] mt-2"></div>
              <div>
                <p className="text-white font-medium">Role-Based Access</p>
                <p className="text-[#94a3b8] text-sm">Secure permissions for Admins and Takers</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-2 h-2 rounded-full bg-[#10b981] mt-2"></div>
              <div>
                <p className="text-white font-medium">Comprehensive Reports</p>
                <p className="text-[#94a3b8] text-sm">Daily attendance and visitor analytics</p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-[#64748b] text-sm">
          © 2026 NFC Access Control System. All rights reserved.
        </div>
      </div>

      {/* Right side - Login Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
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

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
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

            {/* Demo Credentials */}
            <div className="mt-6 pt-6 border-t border-[#e2e8f0]">
              <p className="text-xs text-[#64748b] text-center mb-3">Demo Credentials:</p>
              <div className="space-y-2 text-xs">
                <div className="flex justify-between p-2 bg-[#f8f9fa] rounded">
                  <span className="text-[#64748b]">Admin:</span>
                  <span className="font-mono text-[#0f172a]">admin@school.edu / admin123</span>
                </div>
                <div className="flex justify-between p-2 bg-[#f8f9fa] rounded">
                  <span className="text-[#64748b]">Taker:</span>
                  <span className="font-mono text-[#0f172a]">taker@school.edu / taker123</span>
                </div>
              </div>
            </div>
          </div>

          <p className="text-center text-sm text-[#64748b] mt-6">
            Need help? Contact your system administrator
          </p>
        </div>
      </div>
    </div>
  );
}
