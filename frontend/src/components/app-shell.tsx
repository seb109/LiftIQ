'use client';

import React from 'react';
import { useAuth } from '@/lib/auth-context';
import { Logo } from '@/components/ui/logo';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { LogOut, User, Activity } from 'lucide-react';

export const AppShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, logout } = useAuth();

  return (
    <div className="min-h-screen bg-[#09090B] text-slate-100 flex flex-col font-sans">
      {/* Top Header Navigation Shell */}
      <header className="sticky top-0 z-40 w-full border-b border-zinc-800/80 bg-zinc-950/80 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <Logo size="md" />
            <div className="hidden md:flex items-center gap-2">
              <Badge variant="lime" size="sm">
                <span className="w-1.5 h-1.5 rounded-full bg-lime-400 animate-pulse mr-1.5 inline-block"></span>
                MVP Engine v1.0
              </Badge>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {user && (
              <div className="flex items-center gap-3 bg-zinc-900/90 border border-zinc-800 rounded-xl px-3 py-1.5">
                <div className="w-8 h-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-lime-400 font-bold text-sm">
                  {user.name ? user.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
                </div>
                <div className="hidden sm:flex flex-col text-left">
                  <span className="text-xs font-semibold text-slate-200 leading-none">{user.name || 'User'}</span>
                  <span className="text-[10px] text-slate-400 font-mono mt-0.5 leading-none">{user.email}</span>
                </div>
              </div>
            )}

            <Button
              variant="outline"
              size="sm"
              onClick={logout}
              leftIcon={<LogOut className="w-3.5 h-3.5" />}
              className="text-slate-300 hover:text-white"
            >
              <span className="hidden sm:inline">Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-800/60 bg-zinc-950/40 py-6">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-lime-400" />
            <span>LiftIQ &copy; {new Date().getFullYear()} Intelligent Training Infrastructure</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>FastAPI Backend</span>
            <span>&bull;</span>
            <span>MediaPipe Pose</span>
            <span>&bull;</span>
            <span>Groq AI Reports</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
