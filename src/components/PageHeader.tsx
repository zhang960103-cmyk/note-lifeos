import { useNavigate } from "react-router-dom";
import { ChevronLeft } from "lucide-react";
import type { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  rightSlot?: ReactNode;
  onBack?: () => void;
  showBack?: boolean;
}

export default function PageHeader({ title, subtitle, rightSlot, onBack, showBack = true }: PageHeaderProps) {
  const navigate = useNavigate();
  const handleBack = onBack ?? (() => navigate(-1));

  return (
    <div className="flex items-center justify-between px-4 h-[52px] border-b border-border flex-shrink-0 bg-surface-1/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {showBack && (
          <button
            onClick={handleBack}
            className="touch-target text-muted-foreground hover:text-foreground rounded-xl transition flex-shrink-0"
            style={{ transform: "scale(0.85)" }}>
            <ChevronLeft size={22} />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="font-serif-sc text-base text-foreground truncate">{title}</h1>
          {subtitle && <p className="text-caption text-muted-foreground truncate">{subtitle}</p>}
        </div>
      </div>
      {rightSlot && (
        <div className="flex items-center gap-1 flex-shrink-0 ml-2">
          {rightSlot}
        </div>
      )}
    </div>
  );
}
