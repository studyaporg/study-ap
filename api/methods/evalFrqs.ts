import type { DB } from "@/lib/db"
import type { LLM } from "@/lib/llm/core"
import {
  frqAttempt,
  question,
  questionGradingGuidelines,
  stimulus,
} from "@/lib/schema/schema"
import { retryAsyncFn } from "@/lib/utils"
import { and, eq, inArray, isNotNull, isNull } from "drizzle-orm"
import { z } from "zod"

export async function evalFRQs(db: DB, llm: LLM, questionIds: number[]) {
  const responded = await db
    .select({
      questionId: frqAttempt.questionId,
      testId: frqAttempt.testId,
      response: frqAttempt.response,
      question: question.content,
      totalPoints: question.totalPoints,
      guidelines: questionGradingGuidelines.content,
      stimulus: stimulus.content,
      attribution: stimulus.attribution,
      imageAltText: stimulus.imageAltText,
    })
    .from(frqAttempt)
    .where(
      and(
        inArray(frqAttempt.questionId, questionIds),
        isNull(frqAttempt.scoredPoints),
        isNotNull(frqAttempt.response),
      ),
    )
    .innerJoin(question, eq(question.id, frqAttempt.questionId))
    .innerJoin(stimulus, eq(stimulus.id, question.stimulusId))
    .innerJoin(
      questionGradingGuidelines,
      eq(questionGradingGuidelines.questionId, question.id),
    )

  const grade = retryAsyncFn(
    "grade response",
    1,
    async (
      stimulus: string,
      question: string,
      totalPoints: number,
      gradingGuidelines: string,
      response: string,
    ) => {
      const gradingResponse = z
        .string()
        .describe(
          "An explanation on why the student got the point, do quote phrases and sentences from the student's response.",
        )
        .array()
        .describe(
          `A list grading notes, each note earns the student one point. THIS ARRAY MUST BE NO LONGER THAN ${totalPoints} ELEMENTS.`,
        )

      const res = await llm.generate({
        model: "big",
        systemText:
          "You are a grader employed by the Collegeboard to grade the responses to free response questions in the AP US History exam.",
        messages: [
          {
            role: "user",
            content: `Grade the following response, make sure to call the score_response tool. Use the following grading guidelines:
Grading guidelines: ${gradingGuidelines}
Question stimulus: ${stimulus}
Question: ${question}
Student response: ${response}`,
          },
        ],
        mustUseFunctions: true,
        functions: {
          score_response: {
            description: "Score the student's response.",
            returns: gradingResponse,
          },
        },
      })
      const completion = res.returns?.score_response
      if (!completion) {
        throw new Error("empty completion!")
      }
      return completion
    },
  )

  await Promise.all(
    responded.map(async (r) => {
      const scored = await grade(
        `${stimulus.imageAltText
          ? "This is an image with the following description: "
          : ""
        }${stimulus.imageAltText}\n- ${stimulus.attribution}`,
        r.question,
        r.totalPoints,
        r.guidelines,
        r.response ?? "",
      )

      await db
        .update(frqAttempt)
        .set({
          scoredPoints: scored.length,
          scoringNotes: scored
            .map((s) => `- +1 pt. - ${s}`)
            .join("\n"),
        })
        .where(eq(frqAttempt.questionId, r.questionId))
    }),
  )
}