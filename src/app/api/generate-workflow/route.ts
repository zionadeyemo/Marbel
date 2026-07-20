import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { SkillLevel } from "../../types";
import { handleKnownError, handleUnexpectedError, type ErrorContext } from "../../lib/server-error";

export const runtime = "nodejs";
export const maxDuration = 60;

const REQUEST_PATH = "/api/generate-workflow";

const SKILL_INSTRUCTIONS: Record<SkillLevel, string> = {
  beginner: `The user is a BEGINNER.
Generate extremely detailed steps. Spell out things an experienced practitioner would consider obvious.
Break complex actions into smaller individual steps. Include more steps per phase.`,
  intermediate: `The user is INTERMEDIATE.
Generate clear, moderately detailed steps. Assume basic familiarity with the domain and terminology, but do not skip safety-relevant detail.`,
  expert: `The user is an EXPERT.
Generate compressed, efficient instructions. Combine related actions into single steps.
Trust the user to fill in obvious sub-actions themselves.`,
};

function buildPrompt(document: string, skillLevel: SkillLevel) {
  return `You are an expert analyst and field practitioner.

Your task has two parts: (1) classify whether this document is actionable, and (2) if it is, convert it into a guided execution plan.

---

PART 1 — DOCUMENT CLASSIFICATION

Evaluate the document and set "documentClassification" with:
- isWorkflowDocument: true if this document contains procedural, instructional, or actionable content that can be converted into executable steps. False otherwise.
- confidence: a score from 0.0 to 1.0 indicating how confident you are.
- reason: one sentence explaining your classification decision.
- documentType: what kind of document this is (e.g. "Installation Manual", "Standard Operating Procedure", "Safety Procedure", "Recipe", "Training Document", "Technical Guide", "Research Paper", "Statistical Report", "Resume", "Policy Document", etc.)

Documents that should be REJECTED (isWorkflowDocument: false):
- Statistical reports or datasets (e.g. test scores, survey results, analytics exports)
- Research papers or academic studies that describe findings but not procedures
- Resumes, CVs, or biographical documents
- News articles, opinion pieces, or general information
- Legal contracts or agreements not containing procedures
- Raw data dumps with no actionable instructions

Documents that should be ACCEPTED (isWorkflowDocument: true):
- Installation manuals and guides
- Standard operating procedures (SOPs)
- Maintenance or repair guides
- Recipes and cooking procedures
- Safety procedures and checklists
- Configuration and setup guides
- Assembly instructions
- Training procedures
- Any document structured around "do X, then do Y"

If isWorkflowDocument is false, set phases to an empty array, tools to an empty array, missionSummary to an empty string, estimatedDuration to an empty string, and siteInstructions.categories to an empty array.

If confidence is below 0.5, set isWorkflowDocument to false.

---

PART 2 — WORKFLOW GENERATION (only if isWorkflowDocument is true)

${SKILL_INSTRUCTIONS[skillLevel]}

Convert the document into a guided execution plan. The user is actively performing the task, one action at a time.

Rules:
- Create a sequence of executable actions, not a summary or description.
- Each step is one meaningful physical action or decision.
- Group steps into phases that represent natural stages of the work.
- The workflow must reflect THIS document only. Do not add steps, tools, or knowledge from outside the document.

---

PART 3 — REFERENCE DATA (only if isWorkflowDocument is true)

Extract supplementary reference information into siteInstructions.categories.

CRITICAL RULES for reference categories:
- Categories must be derived ENTIRELY from the document content.
- Do NOT use predefined category names or templates.
- Do NOT invent information not present in the document.
- Category titles must reflect the domain of THIS document.
- Only include a category if the document contains relevant content for it.
- Generate 0 to 6 categories. Empty is valid if no reference data exists.
- Each category must contain at least one item.
- The id field must be a short camelCase slug that matches the title (e.g. "requiredMaterials", "safetyRequirements", "cookingTemperatures").

Examples of how reference categories adapt to domain:

For a roofing installation manual:
  - "requiredMaterials" → shingles, underlayment, nails, flashing...
  - "safetyRequirements" → harness required above 6 feet, no work in wet conditions...
  - "inspectionCriteria" → nail spacing, overhang measurement...

For a cooking SOP:
  - "ingredients" → flour 2 cups, eggs 3 large...
  - "equipmentNeeded" → stand mixer, 9-inch pan...
  - "temperatureGuidelines" → oven at 375°F, internal temp 165°F...

For a network installation guide:
  - "networkConfiguration" → VLANs, IP ranges, SSIDs...
  - "hardwareList" → Cisco switch model X, cable type...
  - "testingCriteria" → ping test, throughput target...

Set aiSummary to an empty array.

---

Respond with JSON only. No markdown, no code fences, no commentary.

DOCUMENT TO PROCESS:

${document}`;
}

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    documentClassification: {
      type: SchemaType.OBJECT,
      properties: {
        isWorkflowDocument: { type: SchemaType.BOOLEAN },
        confidence: { type: SchemaType.NUMBER },
        reason: { type: SchemaType.STRING },
        documentType: { type: SchemaType.STRING },
      },
      required: ["isWorkflowDocument", "confidence", "reason", "documentType"],
    },
    missionSummary: { type: SchemaType.STRING },
    estimatedDuration: { type: SchemaType.STRING },
    tools: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
    phases: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          title: { type: SchemaType.STRING },
          steps: {
            type: SchemaType.ARRAY,
            items: {
              type: SchemaType.OBJECT,
              properties: {
                title: { type: SchemaType.STRING },
                duration: { type: SchemaType.STRING },
                description: { type: SchemaType.STRING },
                details: { type: SchemaType.STRING },
                warnings: {
                  type: SchemaType.ARRAY,
                  items: { type: SchemaType.STRING },
                },
              },
              required: ["title", "duration", "description", "details", "warnings"],
            },
          },
        },
        required: ["title", "steps"],
      },
    },
    siteInstructions: {
      type: SchemaType.OBJECT,
      properties: {
        aiSummary: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
        categories: {
          type: SchemaType.ARRAY,
          items: {
            type: SchemaType.OBJECT,
            properties: {
              id: { type: SchemaType.STRING },
              title: { type: SchemaType.STRING },
              items: { type: SchemaType.ARRAY, items: { type: SchemaType.STRING } },
            },
            required: ["id", "title", "items"],
          },
        },
      },
      required: ["aiSummary", "categories"],
    },
  },
  required: [
    "documentClassification",
    "missionSummary",
    "estimatedDuration",
    "tools",
    "phases",
    "siteInstructions",
  ],
};

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error("TIMEOUT"));
    }, ms);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

export async function POST(request: NextRequest) {
  let body: { document?: string; skillLevel?: string };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 }
    );
  }

  const document = body.document?.trim();
  const skillLevel: SkillLevel =
    body.skillLevel === "beginner" ||
    body.skillLevel === "intermediate" ||
    body.skillLevel === "expert"
      ? body.skillLevel
      : "intermediate";

  if (!document) {
    return NextResponse.json(
      { error: "Please paste some technical documentation before generating a workflow." },
      { status: 400 }
    );
  }

  const context: ErrorContext = {
    requestPath: REQUEST_PATH,
    skillLevel,
    documentLength: document.length,
  };

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return handleUnexpectedError(
      new Error("Server is missing GEMINI_API_KEY environment variable."),
      context,
      "Something went wrong."
    );
  }

  try {
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema,
      },
    });

    const result = await withTimeout(
      model.generateContent(buildPrompt(document, skillLevel)),
      45000
    );

    const text = result.response.text();

    if (!text || !text.trim()) {
      return handleKnownError(
        new Error("Gemini returned an empty response. Please try again."),
        502,
        context
      );
    }

    let plan: {
      documentClassification: {
        isWorkflowDocument: boolean;
        confidence: number;
        reason: string;
        documentType: string;
      };
      phases: unknown[];
      [key: string]: unknown;
    };

    try {
      plan = JSON.parse(text);
    } catch (parseErr) {
      return handleKnownError(
        new Error("Gemini returned a malformed plan. Please try again."),
        502,
        { ...context, parseError: parseErr instanceof Error ? parseErr.message : String(parseErr) }
      );
    }

    // Reject non-actionable documents before doing anything else
    const classification = plan.documentClassification;
    if (!classification?.isWorkflowDocument || classification.confidence < 0.5) {
      const reason = classification?.reason ?? "This document does not appear to contain actionable procedures.";
      const docType = classification?.documentType ? ` (detected as: ${classification.documentType})` : "";
      return NextResponse.json(
        {
          error: `This document does not appear to contain actionable procedures or instructions${docType}. ${reason} Please upload an instructional document, SOP, manual, checklist, or process guide.`,
        },
        { status: 422 }
      );
    }

    if (!plan.phases || !Array.isArray(plan.phases) || plan.phases.length === 0) {
      return handleKnownError(
        new Error("Gemini did not return any executable steps. Please try again."),
        502,
        context
      );
    }

    return NextResponse.json({ plan });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "TIMEOUT") {
      return handleKnownError(
        new Error("The request timed out while generating your workflow. Please try again."),
        504,
        context
      );
    }

    return handleUnexpectedError(err, context, "Something went wrong.");
  }
}
