import React, { useState, useEffect } from 'react';
import { X, Lock, Mail, User, Sparkles, AlertCircle, ArrowRight, CheckCircle2, ShieldCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { VioLogo } from './VioLogo';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'signin' | 'signup';
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  initialMode = 'signin',
}) => {
  const { signInWithEmail, signUpWithEmail, signInWithGoogle, signInDemoUser } = useAuth();

  const [mode, setMode] = useState<'signin' | 'signup'>(initialMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [handle, setHandle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [successFeedback, setSuccessFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessFeedback(null);

    if (!email.includes('@') || !email.includes('.')) {
      setError('Please provide a valid email address.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);

    try {
      if (mode === 'signin') {
        await signInWithEmail(email.trim(), password);
        setSuccessFeedback('Authenticated securely! Synchronizing user credentials & JWT session...');
      } else {
        if (!displayName.trim()) {
          setError('Please provide a display name.');
          setLoading(false);
          return;
        }
        const cleanHandle = handle.trim().startsWith('@')
          ? handle.trim()
          : `@${handle.trim() || displayName.toLowerCase().replace(/[^a-z0-9]/g, '')}`;
        await signUpWithEmail(email.trim(), password, displayName.trim(), cleanHandle);
        setSuccessFeedback('Creator account created! Initializing secure user profile & JWT token...');
      }

      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      console.error(err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Invalid email or password.');
      } else if (err.code === 'auth/email-already-in-use') {
        setError('An account with this email already exists.');
      } else if (err.code === 'auth/weak-password') {
        setError('Password should be at least 6 characters.');
      } else {
        setError(err.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInWithGoogle();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Google sign-in failed.');
    } finally {
      setLoading(false);
    }
  };

  const handleDemo = async () => {
    setError(null);
    setLoading(true);
    try {
      await signInDemoUser();
      onClose();
    } catch (err: any) {
      setError('Could not sign into demo account.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-md max-h-[92vh] overflow-y-auto rounded-3xl border border-[var(--ink-faint)] bg-[var(--surface)] p-5 sm:p-6 shadow-2xl transition-colors text-[var(--ink)]"
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--ink-faint)]">
          <div className="flex items-center gap-2.5 min-w-0">
            <VioLogo size="sm" showWordmark={false} />
            <div className="min-w-0">
              <h3 className="text-base font-bold text-[var(--ink)] truncate">
                {mode === 'signin' ? 'Sign in to Vio streaming' : 'Create Vio streaming Creator Account'}
              </h3>
              <p className="text-xs text-[var(--ink-medium)] truncate">
                {mode === 'signin'
                  ? 'Access your following channels, reels & creator studio'
                  : 'Join the global video streaming community'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close sign in dialog"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-[var(--ink-medium)] hover:bg-[var(--ink-faint)] hover:text-[var(--ink)] transition-colors cursor-pointer"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Instant Demo & Google Account Buttons */}
        <div className="mt-4 space-y-2.5">
          <button
            type="button"
            onClick={handleDemo}
            disabled={loading}
            className="min-h-[44px] flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-red-600 to-amber-500 py-2.5 px-4 text-xs font-bold text-white shadow-md hover:opacity-95 active:scale-98 transition-all cursor-pointer disabled:opacity-50"
          >
            <Sparkles className="h-4 w-4" />
            <span>1-Click Instant Demo Creator Login</span>
          </button>

          <button
            type="button"
            onClick={handleGoogle}
            disabled={loading}
            className="min-h-[44px] flex w-full items-center justify-center gap-2.5 rounded-2xl border border-[var(--ink-faint)] bg-[var(--bg)] py-2.5 px-4 text-xs font-bold text-[var(--ink)] hover:bg-[var(--ink-faint)] active:scale-98 transition-all cursor-pointer disabled:opacity-50"
          >
            <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
              <path fill="#EA4335" d="M12 10.2v3.9h5.4c-.2 1.3-1.6 3.9-5.4 3.9-3.2 0-5.9-2.7-5.9-6s2.7-6 5.9-6c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.5 12 2.5 6.8 2.5 2.5 6.8 2.5 12s4.3 9.5 9.5 9.5c5.5 0 9.1-3.8 9.1-9.2 0-.6-.1-1.1-.2-1.6H12z" />
            </svg>
            <span>Continue with Google</span>
          </button>

          <div className="relative my-3 flex items-center justify-center">
            <div className="h-px w-full bg-[var(--ink-faint)]" />
            <span className="absolute bg-[var(--surface)] px-2 text-[10px] uppercase tracking-wider text-[var(--ink-medium)]">
              or continue with email
            </span>
          </div>
        </div>

        {/* Success JWT Confirmation Alert */}
        {successFeedback && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-xs text-emerald-500 border border-emerald-500/20 animate-in fade-in">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-500" />
            <span className="font-semibold">{successFeedback}</span>
          </div>
        )}

        {error && (
          <div className="mb-4 flex items-center gap-2 rounded-xl bg-rose-500/10 p-3 text-xs text-rose-500 border border-rose-500/20">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Security / JWT Handshake Badge */}
        <div className="mb-3.5 flex items-center justify-between px-3 py-2 rounded-xl bg-[var(--bg)] border border-[var(--ink-faint)] text-[10px] text-[var(--ink-medium)]">
          <span className="flex items-center gap-1.5 font-medium">
            <ShieldCheck className="h-3.5 w-3.5 text-[var(--accent-ink)]" />
            Secure JWT Session & Role Validation
          </span>
          <span className="font-mono text-[9px] uppercase tracking-wider">
            TLS 1.3 / Bearer
          </span>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'signup' && (
            <>
              <div>
                <label className="block text-xs font-bold text-[var(--ink)] mb-1">
                  Full Name / Channel Name
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ink-medium)]" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Alex Rivers"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full min-h-[44px] rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] py-2 pl-10 pr-3 text-base sm:text-xs text-[var(--ink)] focus:border-[#FF0000] focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[var(--ink)] mb-1">
                  Handle (@username)
                </label>
                <input
                  type="text"
                  placeholder="@alexrivers"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  className="w-full min-h-[44px] rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] px-3.5 py-2 text-base sm:text-xs text-[var(--ink)] focus:border-[#FF0000] focus:outline-none"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-[var(--ink)] mb-1">
              Email Address
            </label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ink-medium)]" />
              <input
                type="email"
                required
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] py-2 pl-10 pr-3 text-base sm:text-xs text-[var(--ink)] focus:border-[#FF0000] focus:outline-none"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[var(--ink)] mb-1">
              Password
            </label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--ink-medium)]" />
              <input
                type="password"
                required
                placeholder="At least 6 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full min-h-[44px] rounded-xl border border-[var(--ink-faint)] bg-[var(--bg)] py-2 pl-10 pr-3 text-base sm:text-xs text-[var(--ink)] focus:border-[#FF0000] focus:outline-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="min-h-[44px] flex w-full items-center justify-center gap-2 rounded-xl bg-[#FF0000] py-2.5 text-xs font-bold text-white hover:bg-[#CC0000] shadow-md active:scale-98 transition-all disabled:opacity-50 cursor-pointer"
          >
            <span>{loading ? 'Please wait...' : mode === 'signin' ? 'Sign In' : 'Create Account'}</span>
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        {/* Toggle between Sign In / Sign Up */}
        <div className="mt-5 pt-3 border-t border-[var(--ink-faint)] text-center text-xs text-[var(--ink-medium)]">
          {mode === 'signin' ? (
            <p>
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError(null);
                }}
                className="min-h-[36px] inline-flex items-center px-1.5 font-bold text-[var(--accent-ink)] hover:underline cursor-pointer"
              >
                Sign up now
              </button>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError(null);
                }}
                className="min-h-[36px] inline-flex items-center px-1.5 font-bold text-[var(--accent-ink)] hover:underline cursor-pointer"
              >
                Sign in
              </button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
