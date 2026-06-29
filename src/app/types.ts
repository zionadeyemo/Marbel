export type SkillLevel = "beginner" | "intermediate" | "expert";

export type WorkflowStep = {
  title: string;
  duration: string;
  description: string;
  details: string;
  warnings: string[];
};

export type WorkflowPhase = {
  title: string;
  steps: WorkflowStep[];
};

export type SiteInstructionCategoryId =
  | "installLocation"
  | "networkInformation"
  | "externalAntenna"
  | "specialTesting"
  | "customerNotes"
  | "siteAccessRequirements";

export type SiteInstructionCategory = {
  id: SiteInstructionCategoryId;
  title: string;
  items: string[];
};

export type SiteInstructions = {
  // Placeholder for a future model call that condenses `categories`
  // into a short bullet digest. Empty array renders an empty-state, not an error.
  aiSummary: string[];
  categories: SiteInstructionCategory[];
};

export type WorkflowPlan = {
  missionSummary: string;
  estimatedDuration: string;
  tools: string[];
  phases: WorkflowPhase[];
  siteInstructions?: SiteInstructions;
};

export type FlatStep = WorkflowStep & {
  phaseIndex: number;
  phaseTitle: string;
  stepIndexInPhase: number;
  globalIndex: number;
};

export function flattenPlan(plan: WorkflowPlan): FlatStep[] {
  const flat: FlatStep[] = [];
  let globalIndex = 0;

  plan.phases.forEach((phase, phaseIndex) => {
    phase.steps.forEach((step, stepIndexInPhase) => {
      flat.push({
        ...step,
        phaseIndex,
        phaseTitle: phase.title,
        stepIndexInPhase,
        globalIndex,
      });
      globalIndex += 1;
    });
  });

  return flat;
}
