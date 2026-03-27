import { useState } from "react";
import { useLifeOs } from "@/contexts/LifeOsContext";

const steps = [
  {
    emoji: "📝",
    text: "这是你的私人生命记录本。写下任何事，不用整理，不用想格式。",
  },
  {
    emoji: "🧭",
    text: "写完之后，你的AI导师会回应你。不是分析，是陪你想清楚。",
  },
  {
    emoji: "✨",
    text: "所有整理、标签、计划，都由AI自动完成。你只需要说话。",
  },
];

const Onboarding = () => {
  const [step, setStep] = useState(0);
  const { completeOnboarding } = useLifeOs();

  const next = () => {
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      completeOnboarding();
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center px-8">
      <div className="max-w-[320px] w-full text-center">
        <div className="text-5xl mb-6 transition-all duration-300">{steps[step].emoji}</div>
        <p className="text-foreground text-sm leading-[1.8] mb-8">{steps[step].text}</p>
        <div className="flex items-center justify-center gap-3 mb-6">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`w-1.5 h-1.5 rounded-full transition-all ${i === step ? "bg-gold w-4" : "bg-border"}`}
            />
          ))}
        </div>
        <button
          onClick={next}
          className="bg-gold text-background px-8 py-2.5 rounded-full text-sm font-medium hover:bg-gold/90 transition-all"
        >
          {step < steps.length - 1 ? "继续" : "开始"}
        </button>
      </div>
    </div>
  );
};

export default Onboarding;
