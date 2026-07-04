'use client';

import { signIn, useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import axios from 'axios';
import { Layers, Mail, Lock, User, AlertTriangle, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
  const { status } = useSession();
  const router = useRouter();

  // Authentication check
  useEffect(() => {
    if (status === 'authenticated') {
      router.replace('/home');
    }
  }, [status, router]);

  // UI state
  const [mode, setMode] = useState('signin'); // 'signin' or 'signup'
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  // Form inputs
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Handle local Sign In
  const handleCredentialsSignIn = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!email.trim() || !password) {
      setError('Please fill in all email and password fields.');
      return;
    }

    setLoading(true);
    try {
      const result = await signIn('credentials', {
        email: email.trim(),
        password: password,
        redirect: false
      });

      if (result?.error) {
        setError('Invalid email or password. Please try again.');
        setLoading(false);
      } else {
        setSuccess('Authentication successful! Redirecting...');
        // Let the router handle the client-side redirect safely
        setTimeout(() => {
          router.replace('/home');
        }, 1000);
      }
    } catch (err) {
      console.error('Credentials sign in error:', err);
      setError('An unexpected error occurred. Please try again.');
      setLoading(false);
    }
  };

  // Handle local Registration
  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!name.trim() || !email.trim() || !password || !confirmPassword) {
      setError('All fields are required.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.');
      return;
    }

    setLoading(true);
    try {
      // 1. Post to registration API
      const registerPayload = {
        name: name.trim(),
        email: email.trim(),
        password: password
      };
      
      await axios.post('/api/auth/register', registerPayload);
      setSuccess('Account created successfully! Signing in...');

      // 2. Automatically log in after registration
      const result = await signIn('credentials', {
        email: email.trim(),
        password: password,
        redirect: false
      });

      if (result?.error) {
        setError('Account created, but automatic sign in failed. Please log in manually.');
        setMode('signin');
        setLoading(false);
      } else {
        setTimeout(() => {
          router.replace('/home');
        }, 1000);
      }
    } catch (err) {
      console.error('Registration error:', err);
      setError(err.response?.data?.error || 'Registration failed. Please try again.');
      setLoading(false);
    }
  };

  // Google Sign In (Direct)
  const handleGoogleSignIn = async () => {
    setError('');
    setSuccess('');
    setLoading(true);
    try {
      await signIn('google', { callbackUrl: '/home' });
    } catch (err) {
      console.error('Google sign in error:', err);
      setError('Failed to initiate Google sign in.');
      setLoading(false);
    }
  };

  if (status === 'loading' || status === 'authenticated') {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center space-y-4">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-primary-purple border-t-transparent"></div>
          <p className="text-sm font-medium text-muted-text">Verifying session...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 transition-colors duration-300">
      
      {/* Decorative clean background mesh patterns */}
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none opacity-40 dark:opacity-20">
        <div className="absolute top-[20%] left-[10%] w-[40vw] h-[40vw] rounded-full bg-primary-purple/10 blur-[120px]"></div>
        <div className="absolute bottom-[20%] right-[10%] w-[35vw] h-[35vw] rounded-full bg-purple-600/10 blur-[100px]"></div>
      </div>

      {/* Main card */}
      <div className="w-full max-w-md enterprise-card p-8 md:p-10 z-10 transition-all duration-300 shadow-xl">
        <div className="flex flex-col items-center">
          
          {/* Logo container */}
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-purple text-white shadow-lg shadow-primary-purple/20 mb-5">
            <Layers className="h-8 w-8" />
          </div>

          {/* Heading */}
          <h1 className="text-2xl font-extrabold tracking-tight text-foreground">
            {mode === 'signin' ? 'Sign in to Stack Shift' : 'Create your account'}
          </h1>

          {/* Subheading */}
          <p className="mt-1.5 text-sm text-muted-text text-center">
            {mode === 'signin' 
              ? 'Modernize legacy systems intelligently.' 
              : 'Register to start upgrading legacy code structures.'}
          </p>

          {/* Messages Alert Panels */}
          <div className="w-full mt-6 space-y-3">
            {error && (
              <div className="p-3 bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded-xl text-xs text-rose-700 dark:text-rose-400 flex items-start space-x-2">
                <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
            
            {success && (
              <div className="p-3 bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/30 rounded-xl text-xs text-emerald-700 dark:text-emerald-400 flex items-start space-x-2">
                <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{success}</span>
              </div>
            )}
          </div>

          {/* Sign In Form */}
          {mode === 'signin' ? (
            <div className="w-full mt-6 space-y-5">
              
              {/* Google Button */}
              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="w-full flex items-center justify-center space-x-3 px-5 py-3 border border-border-color hover:border-primary-purple bg-card-bg hover:bg-bg-hover text-foreground font-semibold rounded-xl shadow-xs transition-all duration-200 cursor-pointer disabled:opacity-50"
              >
                <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" width="24" height="24" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M21.35,11.1H12v2.7h5.38C16.88,15.72,14.73,17,12,17c-2.76,0-5-2.24-5-5s2.24-5,5-5c1.23,0,2.35,0.45,3.22,1.2 l2.3-2.3C15.82,4.3,14.02,3.5,12,3.5c-4.69,0-8.5,3.81-8.5,8.5s3.81,8.5,8.5,8.5c4.51,0,8.21-3.29,8.5-7.7A2.4,2.4,0,0,0,21.35,11.1Z"
                    fill="#7C3AED"
                    className="fill-primary-purple dark:fill-white/85"
                  />
                </svg>
                <span className="text-xs tracking-wider">Continue with Google</span>
              </button>

              <div className="relative flex py-1 items-center">
                <div className="flex-grow border-t border-border-muted"></div>
                <span className="flex-shrink mx-4 text-muted-text text-xs uppercase font-bold tracking-widest">or</span>
                <div className="flex-grow border-t border-border-muted"></div>
              </div>

              {/* Local credentials form */}
              <form onSubmit={handleCredentialsSignIn} className="space-y-4">
                <div className="space-y-1.5">
                  <label htmlFor="email" className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-text" />
                    <input
                      id="email"
                      type="email"
                      placeholder="name@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-border-muted bg-background text-sm text-foreground focus:outline-none focus:border-primary-purple"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="password" className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-text" />
                    <input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-border-muted bg-background text-sm text-foreground focus:outline-none focus:border-primary-purple"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-primary-purple hover:bg-hover-purple text-white font-bold text-sm rounded-xl shadow-md shadow-primary-purple/10 transition-all duration-200 cursor-pointer disabled:opacity-50 mt-2"
                >
                  Sign In
                </button>
              </form>

              {/* Toggle to sign up */}
              <div className="text-center pt-2">
                <p className="text-xs text-muted-text">
                  New to Stack Shift?{' '}
                  <button
                    onClick={() => {
                      setError('');
                      setSuccess('');
                      setMode('signup');
                    }}
                    className="text-primary-purple hover:underline font-bold cursor-pointer bg-transparent border-none"
                  >
                    Create an account
                  </button>
                </p>
              </div>

            </div>
          ) : (
            /* Sign Up Form */
            <div className="w-full mt-6 space-y-4">
              <form onSubmit={handleSignUp} className="space-y-4">
                
                <div className="space-y-1.5">
                  <label htmlFor="regName" className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-text" />
                    <input
                      id="regName"
                      type="text"
                      placeholder="John Doe"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-border-muted bg-background text-sm text-foreground focus:outline-none focus:border-primary-purple"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="regEmail" className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-text" />
                    <input
                      id="regEmail"
                      type="email"
                      placeholder="john@company.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-border-muted bg-background text-sm text-foreground focus:outline-none focus:border-primary-purple"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="regPassword" className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-text" />
                    <input
                      id="regPassword"
                      type="password"
                      placeholder="Min. 6 characters"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-border-muted bg-background text-sm text-foreground focus:outline-none focus:border-primary-purple"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="regConfirmPassword" className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-muted-text" />
                    <input
                      id="regConfirmPassword"
                      type="password"
                      placeholder="Repeat password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 rounded-xl border border-border-muted bg-background text-sm text-foreground focus:outline-none focus:border-primary-purple"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 bg-primary-purple hover:bg-hover-purple text-white font-bold text-sm rounded-xl shadow-md shadow-primary-purple/10 transition-all duration-200 cursor-pointer disabled:opacity-50 mt-2"
                >
                  Register Account
                </button>
              </form>

              {/* Toggle to sign in */}
              <div className="text-center pt-2">
                <p className="text-xs text-muted-text">
                  Already have an account?{' '}
                  <button
                    onClick={() => {
                      setError('');
                      setSuccess('');
                      setMode('signin');
                    }}
                    className="text-primary-purple hover:underline font-bold cursor-pointer bg-transparent border-none"
                  >
                    Sign in instead
                  </button>
                </p>
              </div>

            </div>
          )}

          {/* Footer terms */}
          <div className="mt-8 border-t border-border-muted pt-6 w-full text-center">
            <span className="text-xs text-muted-text">
              Enterprise-grade legacy upgrade pipeline
            </span>
          </div>

        </div>
      </div>
    </div>
  );
}
