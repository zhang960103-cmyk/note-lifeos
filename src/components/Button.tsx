import React from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'danger';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  children,
  className = '',
  ...props
}) => {
  const baseClasses =
    'font-medium transition-all rounded-lg disabled:opacity-40 disabled:cursor-not-allowed';

  const variantClasses = {
    primary: 'bg-gold hover:bg-gold/90 text-background',
    secondary: 'bg-surface-2 hover:bg-surface-3 text-foreground border border-border',
    tertiary: 'bg-transparent hover:bg-surface-2 text-foreground',
    danger: 'bg-los-red/10 hover:bg-los-red/20 text-los-red',
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      {...props}
      disabled={disabled || isLoading}
      className={`${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${className}`}
    >
      {isLoading ? '加载中...' : children}
    </button>
  );
};
