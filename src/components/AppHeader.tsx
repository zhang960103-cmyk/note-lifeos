import React from 'react';
import { ArrowLeft, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Card } from './Card';

interface AppHeaderProps {
  title?: string;
  showBack?: boolean;
  showDate?: boolean;
  rightActions?: React.ReactNode;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  title,
  showBack = false,
  showDate = true,
  rightActions,
}) => {
  const navigate = useNavigate();

  return (
    <Card
      variant="default"
      padding="md"
      className="flex items-center justify-between mb-3 sticky top-0 z-10"
    >
      <div className="flex items-center gap-3">
        {showBack && (
          <button
            onClick={() => navigate(-1)}
            className="p-1.5 hover:bg-surface-3 rounded-lg transition-colors"
          >
            <ArrowLeft size={18} className="text-foreground" />
          </button>
        )}
        {showDate && (
          <span className="text-sm font-mono-jb text-muted-foreground">
            {format(new Date(), 'M月d日')}
          </span>
        )}
        {title && <h1 className="text-lg font-serif-sc text-foreground">{title}</h1>}
      </div>
      <div className="flex items-center gap-1.5">
        {rightActions}
        <button
          onClick={() => navigate('/settings')}
          className="p-1.5 hover:bg-surface-3 rounded-lg transition-colors text-muted-foreground hover:text-foreground"
        >
          <Settings size={18} />
        </button>
      </div>
    </Card>
  );
};
