'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Shield, Mail, Lock, AlertCircle, Eye, EyeOff, User, CheckCircle2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export default function RegistrationPage() {
  const searchParams = useSearchParams();
  const isOAuthMode = searchParams.get('oauth') === 'true';
  const prefilledEmail = searchParams.get('email') || '';
  
  useEffect(() => {
    console.log('🔵 Registration Page Loaded');
    console.log('OAuth Mode:', isOAuthMode);
    console.log('Prefilled Email:', prefilledEmail);
    console.log('Search Params:', searchParams.toString());
  }, [isOAuthMode, prefilledEmail, searchParams]);
  
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: prefilledEmail,
    password: '',
    confirmPassword: '',
    role: 'Student',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { signup, completeOAuthProfile } = useAuth();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    console.log('🔵 Registration form submitted with data:', {
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      role: formData.role,
      isOAuthMode,
    });

    // Validation
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError('First name and last name are required');
      console.error('❌ Validation failed: Missing name');
      return;
    }

    if (!isOAuthMode) {
      // Regular signup validation
      if (!formData.email.trim()) {
        setError('Email is required');
        console.error('❌ Validation failed: Missing email');
        return;
      }

      if (!formData.password) {
        setError('Password is required');
        console.error('❌ Validation failed: Missing password');
        return;
      }

      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters');
        console.error('❌ Validation failed: Password too short');
        return;
      }

      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        console.error('❌ Validation failed: Passwords do not match');
        return;
      }
    }

    console.log('✅ Validation passed, calling signup function...');
    setIsLoading(true);

    try {
      let success;
      
      if (isOAuthMode) {
        // OAuth completion - only need name and role
        console.log('OAuth mode: completing profile...');
        success = await completeOAuthProfile(
          formData.firstName,
          formData.lastName,
          formData.role
        );
      } else {
        // Regular signup
        console.log('Regular mode: creating new account...');
        success = await signup(
          formData.email,
          formData.password,
          formData.firstName,
          formData.lastName,
          formData.role
        );
      }

      if (success) {
        console.log('✅ Registration successful, redirecting...');
        router.push(isOAuthMode ? '/dashboard' : '/auth/login?registered=true');
      } else {
        console.error('❌ Registration failed: function returned false');
        setError('Registration failed. Please check the console for details and try again.');
      }
    } catch (err) {
      console.error('❌ Registration failed with exception:', err);
      setError('An error occurred during registration. Please check the console and try again.');
    } finally {
      setIsLoading(false);
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
            Join Our System
          </h2>
          <p className="text-[#cbd5e1] text-lg mb-8">
            Get started with secure NFC-based access control and real-time tracking.
          </p>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#10b981] shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-medium">Quick Registration</p>
                <p className="text-[#94a3b8] text-sm">Create your account in just a few steps</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#10b981] shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-medium">Secure Access</p>
                <p className="text-[#94a3b8] text-sm">Your data is protected with industry standards</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#10b981] shrink-0 mt-0.5" />
              <div>
                <p className="text-white font-medium">Instant Access</p>
                <p className="text-[#94a3b8] text-sm">Start using the system immediately after registration</p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-[#64748b] text-sm">
          © 2026 NFC Access Control System. All rights reserved.
        </div>
      </div>

      {/* Right side - Registration Form */}
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
              <h2 className="text-2xl font-bold text-[#0f172a] mb-2">Create your account</h2>
              <p className="text-[#64748b]">Sign up to get started with NFC Access Control</p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-red-800 font-medium">Registration Error</p>
                  <p className="text-sm text-red-700">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {isOAuthMode && (
                <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-start gap-3">
                  <CheckCircle2 className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm text-blue-800 font-medium">Complete Your Profile</p>
                    <p className="text-sm text-blue-700">You signed in with Google. Please complete your profile information.</p>
                  </div>
                </div>
              )}

              {/* Name Fields */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-[#0f172a] mb-2">
                    First Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#64748b]" />
                    <input
                      id="firstName"
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2.5 border border-[#e2e8f0] rounded-lg text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#1e293b] focus:ring-2 focus:ring-[#1e293b]/10 transition-colors"
                      placeholder="John"
                      required
                    />
                  </div>
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-[#0f172a] mb-2">
                    Last Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#64748b]" />
                    <input
                      id="lastName"
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2.5 border border-[#e2e8f0] rounded-lg text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#1e293b] focus:ring-2 focus:ring-[#1e293b]/10 transition-colors"
                      placeholder="Doe"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Email Input - Hidden in OAuth mode */}
              {!isOAuthMode && (
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-[#0f172a] mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#64748b]" />
                    <input
                      id="email"
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      className="w-full pl-10 pr-4 py-2.5 border border-[#e2e8f0] rounded-lg text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#1e293b] focus:ring-2 focus:ring-[#1e293b]/10 transition-colors"
                      placeholder="john.doe@school.edu"
                      required
                    />
                  </div>
                </div>
              )}

              {/* Role Selection */}
              <div>
                <label htmlFor="role" className="block text-sm font-medium text-[#0f172a] mb-2">
                  User Role
                </label>
                <select
                  id="role"
                  name="role"
                  value={formData.role}
                  onChange={handleChange}
                  className="w-full px-4 py-2.5 border border-[#e2e8f0] rounded-lg text-[#0f172a] focus:outline-none focus:border-[#1e293b] focus:ring-2 focus:ring-[#1e293b]/10 transition-colors bg-white"
                >
                  <option value="Student">Student</option>
                  <option value="Staff">Staff</option>
                  <option value="Visitor">Visitor</option>
                  <option value="Special Guest">Special Guest</option>
                </select>
              </div>

              {/* Password fields - Hidden in OAuth mode */}
              {!isOAuthMode && (
                <>
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
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        className="w-full pl-10 pr-12 py-2.5 border border-[#e2e8f0] rounded-lg text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#1e293b] focus:ring-2 focus:ring-[#1e293b]/10 transition-colors"
                        placeholder="Enter a strong password"
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
                    <p className="text-xs text-[#64748b] mt-1">At least 6 characters</p>
                  </div>

                  {/* Confirm Password Input */}
                  <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium text-[#0f172a] mb-2">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-[#64748b]" />
                      <input
                        id="confirmPassword"
                        type={showConfirmPassword ? 'text' : 'password'}
                        name="confirmPassword"
                        value={formData.confirmPassword}
                        onChange={handleChange}
                        className="w-full pl-10 pr-12 py-2.5 border border-[#e2e8f0] rounded-lg text-[#0f172a] placeholder-[#94a3b8] focus:outline-none focus:border-[#1e293b] focus:ring-2 focus:ring-[#1e293b]/10 transition-colors"
                        placeholder="Confirm your password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-[#64748b] hover:text-[#0f172a] transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </>
              )}

              {/* Terms Agreement */}
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  className="w-4 h-4 border-[#e2e8f0] rounded text-[#1e293b] focus:ring-2 focus:ring-[#1e293b]/10 mt-1"
                  required
                />
                <span className="text-sm text-[#64748b]">
                  I agree to the <a href="#" className="text-[#1e293b] hover:underline font-medium">Terms of Service</a> and <a href="#" className="text-[#1e293b] hover:underline font-medium">Privacy Policy</a>
                </span>
              </label>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-2.5 bg-[#1e293b] text-white rounded-lg font-medium hover:bg-[#334155] focus:outline-none focus:ring-2 focus:ring-[#1e293b] focus:ring-offset-2 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                    {isOAuthMode ? 'Completing profile...' : 'Creating account...'}
                  </span>
                ) : (
                  isOAuthMode ? 'Complete Profile' : 'Create Account'
                )}
              </button>
            </form>

            {/* Sign In Link */}
            <div className="mt-6 pt-6 border-t border-[#e2e8f0] text-center">
              <p className="text-sm text-[#64748b]">
                Already have an account?{' '}
                <a href="/auth/login" className="text-[#1e293b] hover:underline font-medium">
                  Sign in here
                </a>
              </p>
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
