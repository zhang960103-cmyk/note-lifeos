interface SectionHeaderProps {
  num: string;
  title: string;
  color: string;
}

const colorMap: Record<string, string> = {
  red: "bg-los-red text-white",
  green: "bg-los-green text-white",
  gold: "bg-gold text-background",
  blue: "bg-los-blue text-white",
  purple: "bg-los-purple text-white",
  teal: "bg-los-teal text-white",
  orange: "bg-los-orange text-white",
  white: "bg-white text-background",
};

const SectionHeader = ({ num, title, color }: SectionHeaderProps) => (
  <div className="flex items-center gap-3 mb-6 pb-3 border-b border-border">
    <div className={`w-[30px] h-[30px] flex-shrink-0 rounded-md flex items-center justify-center font-mono-jb text-[11px] font-medium ${colorMap[color] || colorMap.gold}`}>
      {num}
    </div>
    <h2 className="font-serif-sc text-xl text-white">{title}</h2>
  </div>
);

export default SectionHeader;
