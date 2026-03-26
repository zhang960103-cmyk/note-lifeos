import { useState } from "react";

interface CodeBlockProps {
  title: string;
  children: string;
}

const CodeBlock = ({ title, children }: CodeBlockProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(children).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div className="rounded-lg overflow-hidden border border-border my-3">
      <div className="bg-code-bg px-3.5 py-2 flex justify-between items-center font-mono-jb text-[10px] text-muted-foreground">
        <span>{title}</span>
        <button
          onClick={handleCopy}
          className={`px-2.5 py-0.5 rounded font-mono-jb text-[9px] cursor-pointer transition-all border ${
            copied
              ? "text-los-green border-los-green/30 bg-los-green-light"
              : "text-gold border-gold-border bg-gold-light hover:bg-gold-light/50"
          }`}
        >
          {copied ? "COPIED ✓" : "COPY"}
        </button>
      </div>
      <pre className="bg-code-bg p-4 font-mono-jb text-[11px] leading-[1.8] text-muted-foreground overflow-x-auto whitespace-pre">
        {children}
      </pre>
    </div>
  );
};

export default CodeBlock;
