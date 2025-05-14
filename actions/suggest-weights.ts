"use server"

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
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: MODEL,
            messages: [
              {
                role: "system",
                content:
                  "You are an expert HR professional who specializes in analyzing job requirements and determining the importance of different candidate attributes. Respond ONLY with valid JSON in the exact format specified in the prompt. Do not include markdown formatting, code blocks, or any text outside the JSON array.",
              },
              { role: "user", content: prompt },
            ],
            temperature: 0.2,
            max_tokens: 1000,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          console.error("OpenAI API error:", errorData)
          throw new Error(`OpenAI API error: ${errorData.error?.message || "Unknown error"}`)
        }

        const data = await response.json()
        const text = data.choices[0]?.message?.content || ""

        return processWeightsResponse(text)
      } catch (preferredModelError) {
        console.error("Error with preferred model, trying fallback model:", preferredModelError)

        // Try with the fallback model
        const response = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: FALLBACK_MODEL,
            messages: [
              {
                role: "system",
                content:
                  "You are an expert HR professional who specializes in analyzing job requirements and determining the importance of different candidate attributes. Respond ONLY with valid JSON in the exact format specified in the prompt. Do not include markdown formatting, code blocks, or any text outside the JSON array.",
              },
              { role: "user", content: prompt },
            ],
            temperature: 0.2,
            max_tokens: 1000,
          }),
        })

        if (!response.ok) {
          const errorData = await response.json()
          console.error("OpenAI API error:", errorData)
          throw new Error(`OpenAI API error: ${errorData.error?.message || "Unknown error"}`)
        }

        const data = await response.json()
        const text = data.choices[0]?.message?.content || ""

        return processWeightsResponse(text)
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

    // Convert the raw weights to our WeightCategory format
    return validWeights.map((weight) => {
      const categoryName = getCategoryName(weight.id)
      const categoryDescription = getCategoryDescription(weight.id)

      return {
        id: weight.id,
        name: categoryName,
        description: categoryDescription,
        weight: weight.weight,
        defaultWeight: weight.weight,
        aiSuggested: true,
      }
    })
  } catch (parseError) {
    console.error("Error parsing AI response:", parseError, "Response:", responseText)
    return getDefaultWeights()
  }
}

// Helper function to get category name from ID
function getCategoryName(id: string): string {
  const categoryNames: Record<string, string> = {
    technical_skills: "Technical Skills",
    experience: "Experience",
    education: "Education",
    location: "Location",
    soft_skills: "Soft Skills",
    industry_knowledge: "Industry Knowledge",
    certifications: "Certifications",
  }

  return (
    categoryNames[id] ||
    id
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ")
  )
}

// Helper function to get category description from ID
function getCategoryDescription(id: string): string {
  const categoryDescriptions: Record<string, string> = {
    technical_skills: "Programming languages, tools, and technologies",
    experience: "Years of relevant work experience",
    education: "Degrees, certifications, and academic achievements",
    location: "Proximity to job location or willingness to relocate",
    soft_skills: "Communication, teamwork, and interpersonal abilities",
    industry_knowledge: "Familiarity with the specific industry and domain",
    certifications: "Professional certifications and licenses",
  }

  return categoryDescriptions[id] || ""
}

// Function to provide default weights when API is unavailable
function getDefaultWeights(): WeightCategory[] {
  return [
    {
      id: "technical_skills",
      name: "Technical Skills",
      description: "Programming languages, tools, and technologies",
      weight: 7,
      defaultWeight: 7,
    },
    {
      id: "experience",
      name: "Experience",
      description: "Years of relevant work experience",
      weight: 6,
      defaultWeight: 6,
    },
    {
      id: "education",
      name: "Education",
      description: "Degrees, certifications, and academic achievements",
      weight: 5,
      defaultWeight: 5,
    },
    {
      id: "location",
      name: "Location",
      description: "Proximity to job location or willingness to relocate",
      weight: 3,
      defaultWeight: 3,
    },
    {
      id: "soft_skills",
      name: "Soft Skills",
      description: "Communication, teamwork, and interpersonal abilities",
      weight: 4,
      defaultWeight: 4,
    },
    {
      id: "industry_knowledge",
      name: "Industry Knowledge",
      description: "Familiarity with the specific industry and domain",
      weight: 5,
      defaultWeight: 5,
    },
    {
      id: "certifications",
      name: "Certifications",
      description: "Professional certifications and licenses",
      weight: 3,
      defaultWeight: 3,
    },
  ]
}
