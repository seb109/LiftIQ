import React from 'react';
import { LiftMark } from './icons';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const text = { sm: 'text-lg', md: 'text-xl', lg: 'text-3xl' };
const mark = { sm: 'size-5', md: 'size-6', lg: 'size-8' };

export const Logo: React.FC<LogoProps> = ({ size = 'md', className = '' }) => (
  <span className={`inline-flex items-center gap-2 text-ink ${className}`}>
    <LiftMark className={`${mark[size]} text-brand`} />
    <span className={`font-bold tracking-tight ${text[size]}`}>LiftIQ</span>
  </span>
);
