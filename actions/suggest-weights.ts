"use server"

import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import type { WeightCategory } from "@/types/resume-ranker"
import { MODEL, FALLBACK_MODEL, OPENAI_API_KEY } from "@/lib/ai-config"

// Helper function to clean AI response text and extract JSON
function extractJsonFromResponse(text: string): string {
  // Check if the response is wrapped in markdown code blocks
  const jsonRegex = /```(?:json)?\s*([\s\S]*?)```/
  const match = text.match(jsonRegex)

  // If we found a JSON code block, extract the content
  if (match && match[1]) {
    return match[1].trim()
  }

  // Otherwise return the original text
  return text.trim()
}

export async function suggestWeights(jobDescription: string): Promise<WeightCategory[]> {
  try {
    // Validate input
    if (!jobDescription || !jobDescription.trim()) {
      console.log("Empty job description, using default weights")
      return getDefaultWeights()
    }

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
Return your analysis as a JSON array with this exact structure, and ONLY the JSON array with no markdown formatting or code blocks:
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
      // Try with preferred model first, fall back to simpler model if needed
      try {
        // Try to generate weights using the preferred model
        const response = await generateText({
          model: openai(MODEL, {
            temperature: 0.2, // Lower temperature for more consistent results
            apiKey: OPENAI_API_KEY,
          }),
          prompt,
          system:
            "You are an expert HR professional who specializes in analyzing job requirements and determining the importance of different candidate attributes. Respond ONLY with valid JSON in the exact format specified in the prompt. Do not include markdown formatting, code blocks, or any text outside the JSON array.",
        })

        return processWeightsResponse(response.text)
      } catch (preferredModelError) {
        console.error("Error with preferred model, trying fallback model:", preferredModelError)

        // Try with the fallback model
        const response = await generateText({
          model: openai(FALLBACK_MODEL, {
            temperature: 0.2,
            apiKey: OPENAI_API_KEY,
          }),
          prompt,
          system:
            "You are an expert HR professional who specializes in analyzing job requirements and determining the importance of different candidate attributes. Respond ONLY with valid JSON in the exact format specified in the prompt. Do not include markdown formatting, code blocks, or any text outside the JSON array.",
        })

        return processWeightsResponse(response.text)
      }
    } catch (apiError) {
      console.error("OpenAI API Error:", apiError)
      return getDefaultWeights()
    }
  } catch (error) {
    console.error("Error suggesting weights:", error)
    return getDefaultWeights()
  }
}

// Helper function to process the weights response
function processWeightsResponse(responseText: string): WeightCategory[] {
  try {
    // Clean the response text to handle markdown formatting
    const cleanedText = extractJsonFromResponse(responseText)
    console.log("Cleaned weights response text:", cleanedText.substring(0, 200) + "...")

    // Parse the response
    const suggestedWeights = JSON.parse(cleanedText)

    // Validate the response structure
    if (!Array.isArray(suggestedWeights)) {
      console.error("Invalid response structure from AI", cleanedText)
      return getDefaultWeights()
    }

    // Validate each weight
    const validWeights = suggestedWeights.filter((weight) => {
      return (
        weight &&
        typeof weight.id === "string" &&
        typeof weight.weight === "number" &&
        weight.weight >= 1 &&
        weight.weight <= 10
      )
    })

    if (validWeights.length === 0) {
      console.error("No valid weights in AI response", cleanedText)
      return getDefaultWeights()
    }

    return validWeights
  } catch (parseError) {
    console.error("Error parsing AI response:", parseError, "Response:", responseText)
    return getDefaultWeights()
  }
}

// Function to provide default weights when API is unavailable
function getDefaultWeights(): WeightCategory[] {
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
