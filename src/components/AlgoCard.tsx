type AlgoVariant = "gold" | "blue" | "red" | "green" | "purple" | "teal";

const tagStyles: Record<AlgoVariant, string> = {
  gold: "bg-gold-light text-gold",
  blue: "bg-los-blue-light text-los-blue",
  red: "bg-los-red-light text-los-red",
  green: "bg-los-green-light text-los-green",
  purple: "bg-los-purple-light text-los-purple",
  teal: "bg-los-teal-light text-los-teal",
};

interface AlgoCardProps {
  num: string;
  tag: string;
  variant: AlgoVariant;
  icon: string;
  title: string;
  desc: string;
  trigger: string;
}

const AlgoCard = ({ num, tag, variant, icon, title, desc, trigger }: AlgoCardProps) => (
  <div className="bg-surface-2 border border-border rounded-lg p-3.5 relative overflow-hidden">
    <span className="absolute right-2.5 top-1 font-serif-sc text-4xl text-border font-bold leading-none">{num}</span>
    <span className={`font-mono-jb text-[9px] uppercase tracking-wide px-2 py-0.5 rounded inline-block mb-1.5 ${tagStyles[variant]}`}>
      {tag}
    </span>
    <h4 className="font-serif-sc text-sm text-white mb-1">{icon} {title}</h4>
    <p className="text-[11px] text-muted-foreground leading-relaxed">{desc}</p>
    <div className="mt-1.5 text-[10px] text-border font-mono-jb">触发：{trigger}</div>
  </div>
);

export default AlgoCard;
