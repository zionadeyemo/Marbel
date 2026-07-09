import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI, SchemaType } from "@google/generative-ai";
import type { SkillLevel } from "../../types";
import { handleKnownError, handleUnexpectedError, type ErrorContext } from "../../lib/server-error";

export const runtime = "nodejs";
export const maxDuration = 60;

const REQUEST_PATH = "/api/generate-workflow";

const SKILL_INSTRUCTIONS: Record<SkillLevel, string> = {
  beginner: `The user is a BEGINNER.
Generate extremely detailed steps. Spell out things an experienced technician would consider obvious.
Example granularity: "Unlock vehicle using key." instead of "Access vehicle."
Break complex actions into smaller individual steps. Include more steps per phase.`,
  intermediate: `The user is INTERMEDIATE.
Generate clear, moderately detailed steps. Assume basic familiarity with tools and terminology, but do not skip safety-relevant detail.`,
  expert: `The user is an EXPERT.
Generate compressed, efficient instructions. Combine related actions into single steps.
Example granularity: "Access vehicle." instead of "Unlock vehicle using key."
Trust the user to fill in obvious sub-actions themselves.`,
};

function buildPrompt(document: string, skillLevel: SkillLevel) {
  return `You are an experienced field engineer.

Your job is to convert technical documentation into a guided execution plan.

The user is actively performing the task in the field, one action at a time.

Do not create a summary.
Do not create a manual.
Do not create a document.

Create a sequence of executable actions.

Each action should represent one meaningful decision or physical action.

Avoid exposing future complexity too early. Assume the user only needs the current action and the next few actions — group actions into phases so the experience can be revealed progressively.

${SKILL_INSTRUCTIONS[skillLevel]}

Separately from the step-by-step plan, extract any job-ticket / site-specific reference details mentioned anywhere in the document into "siteInstructions". This is supplementary reference material the technician can look up on demand — it is NOT part of the step sequence and should not duplicate step text verbatim. Categorize into exactly these six categories (use an empty items array for any category with no relevant content in the document):
- installLocation: where on-site the equipment/work is physically located (room, mounting point, floor, building).
- networkInformation: VLANs, IP ranges, SSIDs, ports, credentials references, network topology notes.
- externalAntenna: antenna mounting, alignment, cabling, or RF-specific notes.
- specialTesting: non-standard tests, failover checks, acceptance criteria specific to this job.
- customerNotes: anything the customer specifically requested or flagged.
- siteAccessRequirements: access codes, escort requirements, hours, PPE, permits.
Leave "aiSummary" as an empty array — it is reserved for a future feature and must not be populated.

Respond with JSON only, matching the provided schema exactly. Do not include markdown formatting, code fences, or commentary.

TECHNICAL DOCUMENTATION TO CONVERT:

${document}`;
}

const responseSchema = {
  type: SchemaType.OBJECT,
  properties: {
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
              id: {
                type: SchemaType.STRING,
                enum: [
                  "installLocation",
                  "networkInformation",
                  "externalAntenna",
                  "specialTesting",
                  "customerNotes",
                  "siteAccessRequirements",
                ],
              },
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
  required: ["missionSummary", "estimatedDuration", "tools", "phases", "siteInstructions"],
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
      model: "gemini-2.5-flash-latest",
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

    let plan;
    try {
      plan = JSON.parse(text);
    } catch (parseErr) {
      return handleKnownError(
        new Error("Gemini returned a malformed plan. Please try again."),
        502,
        { ...context, parseError: parseErr instanceof Error ? parseErr.message : String(parseErr) }
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
