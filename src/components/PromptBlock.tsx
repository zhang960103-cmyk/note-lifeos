import { useState } from "react";

interface PromptBlockProps {
  title: string;
  children: string;
}

const PromptBlock = ({ title, children }: PromptBlockProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="bg-surface-1 border border-border border-l-[3px] border-l-gold rounded-r-lg p-4 px-5 my-3">
      <div className="font-mono-jb text-[9px] text-gold uppercase tracking-wide mb-2 flex justify-between items-center flex-wrap gap-1">
        <span>{title}</span>
        <button
          onClick={handleCopy}
          className="bg-gold-light border border-gold-border text-gold px-2.5 py-0.5 rounded font-mono-jb text-[9px] cursor-pointer flex-shrink-0 hover:bg-gold-light/70 transition-all"
        >
          {copied ? "COPIED ✓" : "COPY"}
        </button>
      </div>
      <div className="text-xs text-muted-foreground whitespace-pre-line leading-[1.85]">{children}</div>
    </div>
  );
};

export default PromptBlock;
