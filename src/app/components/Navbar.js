'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useSession, signOut } from 'next-auth/react';
import { useTheme } from '@/app/providers';
import { Sun, Moon, LogOut, ChevronDown, User, Layers, History, BookOpen, UserX } from 'lucide-react';
import axios from 'axios';

export default function Navbar() {
  const { data: session } = useSession();
  const { theme, toggleTheme } = useTheme();
  const pathname = usePathname();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const user = session?.user;

  const handleDeleteAccount = async () => {
    if (confirm("Are you sure you want to permanently delete your account? This action cannot be undone and will delete all your migration projects.")) {
      if (confirm("Double check: Do you want to proceed with permanent deletion?")) {
        try {
          await axios.post('/api/auth/delete-account');
          signOut({ callbackUrl: '/login' });
        } catch (err) {
          console.error(err);
          alert('Failed to delete account. Please try again.');
        }
      }
    }
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border-color bg-card-bg/85 backdrop-blur-md transition-colors duration-300">
      <div className="mx-auto max-w-7xl px-6 h-16 flex items-center justify-between">
        
        {/* Left: Logo */}
        <Link href="/home" className="flex items-center space-x-3 group">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-purple text-white shadow-md shadow-primary-purple/20 group-hover:scale-105 transition-transform duration-200">
            <Layers className="h-5.5 w-5.5" />
          </div>
          <span className="font-bold text-xl tracking-tight text-foreground bg-gradient-to-r from-primary-purple to-purple-600 bg-clip-text text-transparent">
            Stack Shift
          </span>
        </Link>

        {/* Center: Nav links */}
        <nav className="hidden md:flex items-center space-x-1 bg-surface-muted p-1.5 rounded-full border border-border-muted">
          <Link
            href="/home"
            className={`px-5 py-1.5 text-sm font-medium rounded-full transition-all duration-200 ${
              pathname === '/home'
                ? 'bg-card-bg text-primary-purple shadow-sm border border-border-muted'
                : 'text-muted-text hover:text-foreground'
            }`}
          >
            Home
          </Link>
          <Link
            href="/projects"
            className={`px-5 py-1.5 text-sm font-medium rounded-full transition-all duration-200 ${
              pathname.startsWith('/projects')
                ? 'bg-card-bg text-primary-purple shadow-sm border border-border-muted'
                : 'text-muted-text hover:text-foreground'
            }`}
          >
            Projects
          </Link>
        </nav>

        {/* Right: Actions */}
        <div className="flex items-center space-x-4">
          
          {/* Theme Toggle */}
          <button
            onClick={toggleTheme}
            className="p-2 rounded-xl border border-border-muted bg-surface-muted hover:bg-bg-hover text-foreground transition-all duration-200"
            aria-label="Toggle Theme"
          >
            {theme === 'dark' ? (
              <Sun className="h-4.5 w-4.5 text-amber-500" />
            ) : (
              <Moon className="h-4.5 w-4.5 text-primary-purple" />
            )}
          </button>

          {/* Profile Dropdown */}
          {user ? (
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setDropdownOpen(!dropdownOpen)}
                className="flex items-center space-x-2 p-1 pr-3 rounded-full border border-border-muted bg-surface-muted hover:bg-bg-hover transition-all duration-200"
              >
                {user.image ? (
                  <img
                    src={user.image}
                    alt={user.name || 'User profile'}
                    className="h-8 w-8 rounded-full border border-primary-purple/20"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full bg-primary-purple text-white flex items-center justify-center font-semibold text-sm">
                    {user.name ? user.name[0].toUpperCase() : 'U'}
                  </div>
                )}
                <span className="hidden sm:inline text-xs font-semibold max-w-[100px] truncate text-foreground">
                  {user.name?.split(' ')[0]}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-text" />
              </button>

              {/* Dropdown Menu */}
              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-border-color bg-card-bg shadow-xl p-2 transition-all duration-200">
                  <div className="px-3 py-2 border-b border-border-muted mb-1">
                    <p className="text-sm font-semibold text-foreground truncate">{user.name}</p>
                    <p className="text-xs text-muted-text truncate">{user.email}</p>
                  </div>
                  <Link
                    href="/projects"
                    onClick={() => setDropdownOpen(false)}
                    className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-foreground hover:bg-bg-hover rounded-xl transition-all duration-150"
                  >
                    <History className="h-4 w-4 text-primary-purple" />
                    <span>My Migrations</span>
                  </Link>
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      handleDeleteAccount();
                    }}
                    className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all duration-150 text-left cursor-pointer"
                  >
                    <UserX className="h-4 w-4" />
                    <span>Delete Account</span>
                  </button>
                  <button
                    onClick={() => {
                      setDropdownOpen(false);
                      signOut({ callbackUrl: '/login' });
                    }}
                    className="flex items-center space-x-2 w-full px-3 py-2 text-sm text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-xl transition-all duration-150 text-left cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link
              href="/login"
              className="px-4 py-1.5 text-sm font-semibold text-white bg-primary-purple hover:bg-hover-purple rounded-full transition-all duration-200 shadow-md shadow-primary-purple/20"
            >
              Sign In
            </Link>
          )}

        </div>
      </div>
    </header>
  );
}
