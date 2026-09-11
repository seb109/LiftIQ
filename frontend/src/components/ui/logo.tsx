import React from 'react';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showSubtitle?: boolean;
  className?: string;
}

export const Logo: React.FC<LogoProps> = ({ size = 'md', showSubtitle = false, className = '' }) => {
  const sizeClasses = {
    sm: 'text-lg',
    md: 'text-2xl',
    lg: 'text-4xl',
  };

  const badgeSizes = {
    sm: 'px-1.5 py-0.5 text-xs',
    md: 'px-2 py-0.5 text-sm',
    lg: 'px-2.5 py-1 text-base',
  };

  return (
    <div className={`inline-flex flex-col ${className}`}>
      <div className={`font-extrabold tracking-tight flex items-center gap-1 ${sizeClasses[size]}`}>
        <span className="text-slate-50 font-sans tracking-tight">Lift</span>
        <span className={`bg-lime-400 text-zinc-950 font-black rounded-md ${badgeSizes[size]} tracking-wider uppercase font-mono`}>
          IQ
        </span>
      </div>
      {showSubtitle && (
        <span className="text-[10px] uppercase font-mono tracking-widest text-slate-400 mt-1 font-semibold">
          Intelligent Training Infrastructure
        </span>
      )}
    </div>
  );
};
