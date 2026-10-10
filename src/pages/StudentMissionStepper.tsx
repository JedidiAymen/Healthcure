import type { MissionProgress } from "@/lib/academy-mission-progress";
import { Check } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const steps = [
  { id: "mission-brief", label: "Brief" },
  { id: "mission-explore", label: "Explore evidence" },
  { id: "mission-observe", label: "Observe" },
  { id: "mission-explain", label: "Explain" },
  { id: "mission-submit", label: "Submit" },
] as const;

type StudentMissionStepperProps = {
  progress: MissionProgress;
};

export function StudentMissionStepper({ progress }: StudentMissionStepperProps) {
  const { completed, currentIndex, submitted, reviewed } = progress;
  const status = (index: number) => {
    if (reviewed && index === 4) return "Reviewed";
    if (submitted && index === 4) return "Submitted";
    if (index === 0) return "Assignment loaded";
    if (index === 1 || index === 2) return completed[index] ? "Evidence selected" : index === currentIndex ? "Choose source evidence" : "Next";
    if (index === 3) return completed[index] ? "All questions answered" : index === currentIndex ? "Explain your evidence" : "Next";
    if (progress.questionsComplete && completed[1]) return "Ready to submit";
    if (index === currentIndex) return "Current step";
    return "Next";
  };

  return (
    <nav className="mb-4 overflow-hidden rounded-xl border border-border bg-card" aria-label="Investigation steps">
      <ol className="relative m-0 grid list-none grid-cols-1 gap-0 pl-0 px-2 py-2 sm:grid-cols-5">
        <Separator aria-hidden="true" className="absolute left-[10%] right-[10%] top-[26px] hidden w-auto sm:block" />
        {steps.map((step, index) => (
          <li key={step.id} className="relative flex min-w-0 flex-col">
            <a
              href={`#${step.id}`}
              aria-current={index === currentIndex ? "step" : undefined}
              className="group relative z-10 flex min-h-11 items-center gap-3 rounded-lg px-2 py-1.5 text-left outline-none hover:bg-muted/50 focus-visible:ring-2 focus-visible:ring-ring sm:min-h-[74px] sm:flex-col sm:items-center sm:justify-start sm:gap-1 sm:px-1 sm:py-0 sm:text-center"
            >
              <span className={cn(
                "grid size-8 shrink-0 place-items-center rounded-full border text-xs font-semibold transition-colors",
                completed[index] ? "border-emerald-700 bg-emerald-50 text-emerald-800" : "border-border bg-background text-muted-foreground",
                index === currentIndex && "border-primary bg-primary text-primary-foreground",
              )} aria-hidden="true">{completed[index] ? <Check /> : index + 1}</span>
              <span className="grid min-w-0 gap-0.5 sm:max-w-full">
                <span className={cn("text-xs font-semibold leading-4", index === currentIndex ? "text-primary" : "text-foreground")}>{step.label}</span>
                <span className="text-[11px] leading-4 text-muted-foreground">{status(index)}</span>
              </span>
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
