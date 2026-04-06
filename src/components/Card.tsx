import React from 'react';

interface CardProps {
  children?: React.ReactNode;
  className?: string;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'sm' | 'md' | 'lg';
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  variant = 'default',
  padding = 'md',
}) => {
  const baseClasses = 'rounded-xl transition-all';

  const variantClasses = {
    default: 'bg-surface-2 border border-border',
    elevated: 'bg-surface-2 shadow-md border border-border/50',
    outlined: 'bg-background border-2 border-border',
  };

  const paddingClasses = {
    sm: 'p-2.5',
    md: 'p-3.5',
    lg: 'p-4',
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${paddingClasses[padding]} ${className}`}>
      {children}
    </div>
  );
};
