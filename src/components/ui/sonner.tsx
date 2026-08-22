// 之前这里从npm包"next-themes"导入useTheme——这是shadcn脚手架自带的样板代码，
// 从来没有接入过这个App。App自己的深浅色主题在@/contexts/ThemeContext里维护
// (mode: "dark"|"light")，两边同名却是完全独立的两套系统：这里的useTheme()
// 因为没有对应Provider，恒定返回"system"，导致所有toast提示（现在遍布
// GoalsPage/HealthPage/MapPage/WealthPage等各处的成功/失败提示）只跟着操作
// 系统的深浅色走，完全不跟随用户在"设置"里手动切换的App内主题——两者不一致
// 时(比如系统浅色、App手动切成深色)，toast文字颜色和背景对比度会读不清。
import { useTheme } from "@/contexts/ThemeContext";
import { Toaster as Sonner, toast } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { mode } = useTheme();

  return (
    <Sonner
      theme={mode as ToasterProps["theme"]}
      className="toaster group"
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
          description: "group-[.toast]:text-muted-foreground",
          actionButton: "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton: "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
        },
      }}
      {...props}
    />
  );
};

export { Toaster, toast };
