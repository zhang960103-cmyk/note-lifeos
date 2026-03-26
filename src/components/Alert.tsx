import { ReactNode } from "react";

type AlertVariant = "gold" | "red" | "green" | "blue" | "orange";

const variantStyles: Record<AlertVariant, string> = {
  gold: "bg-gold-light border-gold-border [&_strong]:text-gold [&_p]:text-[#8a7040]",
  red: "bg-los-red-light border-los-red/20 [&_strong]:text-los-red [&_p]:text-[#904840]",
  green: "bg-los-green-light border-los-green/20 [&_strong]:text-los-green [&_p]:text-[#3a7a56]",
  blue: "bg-los-blue-light border-los-blue/20 [&_strong]:text-los-blue [&_p]:text-[#3a6898]",
  orange: "bg-los-orange-light border-los-orange/20 [&_strong]:text-los-orange [&_p]:text-[#905820]",
};

interface AlertProps {
  variant: AlertVariant;
  icon: string;
  title: string;
  children: ReactNode;
}

const Alert = ({ variant, icon, title, children }: AlertProps) => (
  <div className={`flex gap-3 p-3 px-4 rounded-lg my-3 text-[13px] border ${variantStyles[variant]}`}>
    <span className="text-base flex-shrink-0 leading-relaxed">{icon}</span>
    <div>
      <strong className="block mb-0.5 text-xs">{title}</strong>
      <p className="m-0 leading-relaxed">{children}</p>
    </div>
  </div>
);

export default Alert;
