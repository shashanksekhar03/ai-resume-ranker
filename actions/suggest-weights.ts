"use server"

import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import type { WeightCategory } from "@/types/resume-ranker"

// Define the model to use throughout the application
const MODEL = "gpt-4o"

export async function suggestWeights(jobDescription: string): Promise<WeightCategory[]> {
  try {
    const prompt = `
Analyze the following job description and suggest appropriate weights (on a scale of 1-10) for different categories when evaluating candidates. Higher weights indicate more importance.

Job Description:
${jobDescription}

Categories to consider:
1. Technical Skills: Programming languages, tools, and technologies
2. Experience: Years of relevant work experience
3. Education: Degrees, certifications, and academic achievements
4. Location: Proximity to job location or willingness to relocate
5. Soft Skills: Communication, teamwork, and interpersonal abilities
6. Industry Knowledge: Familiarity with the specific industry and domain
7. Certifications: Professional certifications and licenses

For each category, provide a weight from 1-10 based on its importance for this specific job.
Return your analysis as a JSON array with this exact structure:
[
  {
    "id": "technical_skills",
    "weight": 8
  },
  {
    "id": "experience",
    "weight": 7
  },
  ...
]
`

    try {
      // Try to generate weights using AI with explicit model configuration
      const { text } = await generateText({
        model: openai(MODEL, {
          temperature: 0.2, // Lower temperature for more consistent results
        }),
        prompt,
        system:
          "You are an expert HR professional who specializes in analyzing job requirements and determining the importance of different candidate attributes. Respond ONLY with valid JSON in the exact format specified in the prompt.",
      })

      // Parse the response
      const suggestedWeights = JSON.parse(text)
      return suggestedWeights
    } catch (apiError) {
      console.error("OpenAI API Error:", apiError)

      // Check for specific error types
      const errorMessage = apiError instanceof Error ? apiError.message : String(apiError)

      if (errorMessage.includes("model")) {
        console.error(`Error accessing ${MODEL} model. Using default weights.`)
      }

      // Fallback to default weights if API fails
      return [
        { id: "technical_skills", weight: 7 },
        { id: "experience", weight: 6 },
        { id: "education", weight: 5 },
        { id: "location", weight: 3 },
        { id: "soft_skills", weight: 4 },
        { id: "industry_knowledge", weight: 5 },
        { id: "certifications", weight: 3 },
      ]
    }
  } catch (error) {
    console.error("Error suggesting weights:", error)
    throw new Error("Failed to suggest weights")
  }
}
