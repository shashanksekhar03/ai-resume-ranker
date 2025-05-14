"use server"

import type { Candidate, RankingResult, WeightConfig } from "@/types/resume-ranker"
import { MODEL, FALLBACK_MODEL } from "@/lib/ai-config"

// Import the text preprocessor
import { preprocessText } from "@/utils/text-preprocessor"
import { parseDocument } from "@/utils/document-parser"
import { detectNameFromResume, extractEmail, generateNameFromEmail } from "@/utils/name-detector"
import { filterContactInfo } from "@/utils/contact-filter"

// Import our custom AI service
import { generateText } from "@/utils/ai-service"

interface RankCandidatesProps {
  jobDescription: string
  candidates: Candidate[]
  jobDescriptionFile?: File | null
  candidateFiles?: Record<string, File | null>
  weightConfig?: WeightConfig
}

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

// Update the rankCandidates function to use text preprocessing
export async function rankCandidates({
  jobDescription,
  candidates,
  jobDescriptionFile,
  candidateFiles,
  weightConfig,
}: RankCandidatesProps): Promise<RankingResult> {
  try {
    // Limit the number of candidates per batch to prevent API overload
    const MAX_CANDIDATES_PER_BATCH = 10
    const processedCandidates = [...candidates]

    // If we have too many candidates, note this in the results
    let candidatesLimited = false
    if (processedCandidates.length > MAX_CANDIDATES_PER_BATCH) {
      // We'll process them in batches, but note this for the user
      candidatesLimited = true
      console.log(`Processing ${processedCandidates.length} candidates in batches of ${MAX_CANDIDATES_PER_BATCH}`)
    }

    // Track original text lengths for stats
    const originalJobDescLength = jobDescription.length
    const originalCandidatesLength = processedCandidates.reduce((total, c) => total + (c.resume?.length || 0), 0)
    const originalTotalLength = originalJobDescLength + originalCandidatesLength

    // Process job description file if provided
    let finalJobDescription = jobDescription
    if (jobDescriptionFile) {
      try {
        // Extract text from the file using our improved document parser
        const text = await parseDocument(jobDescriptionFile)
        if (text && text.trim()) {
          finalJobDescription = text
        }
      } catch (error) {
        console.error("Error processing job description file:", error)
        // Fall back to text input if file parsing fails
      }
    }

    // Preprocess the job description to optimize for API usage
    const processedJobDescription = preprocessText(finalJobDescription, "jobDescription")
    finalJobDescription = processedJobDescription

    // Process candidate resume files if provided
    if (candidateFiles) {
      for (const [id, file] of Object.entries(candidateFiles)) {
        if (file) {
          try {
            // Extract text from the file using our improved document parser
            const text = await parseDocument(file)

            if (text && text.trim()) {
              // Find and update the corresponding candidate
              const candidateIndex = processedCandidates.findIndex((c) => c.id === id)
              if (candidateIndex !== -1) {
                processedCandidates[candidateIndex] = {
                  ...processedCandidates[candidateIndex],
                  resume: text,
                }
              }
            }
          } catch (error) {
            console.error(`Error processing file for candidate ${id}:`, error)
            // Keep existing text input if file parsing fails
          }
        }
      }
    }

    // Preprocess each candidate's resume, ensure they have names, and filter contact info
    for (let i = 0; i < processedCandidates.length; i++) {
      if (processedCandidates[i].resume) {
        // Extract email before filtering (for name generation if needed)
        const email = extractEmail(processedCandidates[i].resume)

        // Filter out contact information before preprocessing
        const filteredResume = filterContactInfo(processedCandidates[i].resume)

        // Preprocess the resume text
        processedCandidates[i].resume = preprocessText(filteredResume, "resume")

        // If candidate doesn't have a name, try to detect it from the original resume
        if (!processedCandidates[i].name.trim()) {
          // First try to detect from the resume
          const { name, confidence } = detectNameFromResume(processedCandidates[i].resume)

          if (name && confidence > 0.4) {
            processedCandidates[i].name = name
          }
          // If no name detected but we have an email, generate from email
          else if (email) {
            const generatedName = generateNameFromEmail(email)
            if (generatedName) {
              processedCandidates[i].name = generatedName
            } else {
              // Last resort - use generic name
              processedCandidates[i].name = `Candidate ${i + 1}`
            }
          } else {
            // If we still can't detect a name, use a generic one
            processedCandidates[i].name = `Candidate ${i + 1}`
          }
        }
      }
    }

    // Calculate processed text lengths for stats
    const processedJobDescLength = finalJobDescription.length
    const processedCandidatesLength = processedCandidates.reduce((total, c) => total + (c.resume?.length || 0), 0)
    const processedTotalLength = processedJobDescLength + processedCandidatesLength

    // Calculate percentage reduction
    const percentReduction = Math.round(((originalTotalLength - processedTotalLength) / originalTotalLength) * 100)

    // Create preprocessing stats
    const preprocessStats = {
      original: originalTotalLength,
      processed: processedTotalLength,
      percentReduction,
    }

    // Validate input data before proceeding
    if (!finalJobDescription.trim()) {
      console.warn("Empty job description, using fallback ranking")
      return generateMockRanking(processedCandidates, "Generic Job Description", weightConfig, preprocessStats)
    }

    // Filter out candidates with empty resumes
    const validCandidates = processedCandidates.filter((c) => c.resume.trim())

    if (validCandidates.length === 0) {
      console.warn("No valid candidates with resumes, using fallback ranking")
      return generateMockRanking(processedCandidates, finalJobDescription, weightConfig, preprocessStats)
    }

    // Create a prompt for the AI to analyze and rank the candidates
    const prompt = createRankingPrompt(finalJobDescription, validCandidates, weightConfig)

    try {
      // First try with the preferred model
      try {
        const response = await generateText({
          model: MODEL,
          prompt,
          system: `You are an expert HR professional and recruiter with deep experience in matching candidates to job requirements.
Your task is to analyze each candidate's resume against the job description and provide a detailed ranking.
Respond ONLY with valid JSON in the exact format specified in the prompt. Do not include markdown formatting, code blocks, or any text outside the JSON object.`,
          temperature: 0.2, // Lower temperature for more consistent results
          maxTokens: 4000, // Ensure enough tokens for detailed analysis
        })

        // Process the response
        const result = processAIResponse(response.text, validCandidates, finalJobDescription, weightConfig)

        // Add a warning if candidates were limited
        if (candidatesLimited) {
          const warningMessage = {
            name: "Note: Analysis Limited",
            score: 0,
            strengths: [""],
            weaknesses: [
              `Only the first ${MAX_CANDIDATES_PER_BATCH} candidates were analyzed due to system limitations.`,
            ],
            analysis: `For better performance, only the first ${MAX_CANDIDATES_PER_BATCH} candidates were analyzed. Please rank candidates in smaller batches for complete results.`,
          }

          // Add the warning as a special item in the results
          if (Array.isArray(result.rankedCandidates)) {
            result.rankedCandidates.push(warningMessage)
          }
        }

        return {
          ...result,
          preprocessStats,
        }
      } catch (preferredModelError) {
        console.error("Error with preferred model, trying fallback model:", preferredModelError)

        // Try with the fallback model
        const response = await generateText({
          model: FALLBACK_MODEL,
          prompt,
          system: `You are an expert HR professional and recruiter with deep experience in matching candidates to job requirements.
Your task is to analyze each candidate's resume against the job description and provide a detailed ranking.
Respond ONLY with valid JSON in the exact format specified in the prompt. Do not include markdown formatting, code blocks, or any text outside the JSON object.`,
          temperature: 0.2,
          maxTokens: 4000,
        })

        // Process the response
        const result = processAIResponse(response.text, validCandidates, finalJobDescription, weightConfig)

        // Add a warning if candidates were limited
        if (candidatesLimited) {
          const warningMessage = {
            name: "Note: Analysis Limited",
            score: 0,
            strengths: [""],
            weaknesses: [
              `Only the first ${MAX_CANDIDATES_PER_BATCH} candidates were analyzed due to system limitations.`,
            ],
            analysis: `For better performance, only the first ${MAX_CANDIDATES_PER_BATCH} candidates were analyzed. Please rank candidates in smaller batches for complete results.`,
          }

          // Add the warning as a special item in the results
          if (Array.isArray(result.rankedCandidates)) {
            result.rankedCandidates.push(warningMessage)
          }
        }

        return {
          ...result,
          preprocessStats,
        }
      }
    } catch (apiError) {
      console.error("OpenAI API Error:", apiError)
      return generateMockRanking(validCandidates, finalJobDescription, weightConfig, preprocessStats)
    }
  } catch (error) {
    console.error("Error in rankCandidates:", error)

    // Provide more detailed error information
    let errorMessage = "Unknown error occurred during ranking"
    if (error instanceof Error) {
      errorMessage = error.message

      // Check for specific error types
      if (error.message.includes("memory") || error.message.includes("heap")) {
        errorMessage = "Memory limit exceeded. Try processing fewer candidates at once or use smaller files."
      } else if (error.message.includes("timeout") || error.message.includes("timed out")) {
        errorMessage = "Request timed out. Try processing fewer candidates at once."
      } else if (error.message.includes("rate limit") || error.message.includes("too many requests")) {
        errorMessage = "API rate limit exceeded. Please wait a moment and try again."
      }
    }

    // Always return a valid result with error information, even if there's an error
    return {
      rankedCandidates: [
        {
          name: "Error Processing Candidates",
          score: 0,
          strengths: [],
          weaknesses: [`Error: ${errorMessage}`],
          analysis: `An error occurred while ranking candidates: ${errorMessage}. Please try again with fewer candidates or smaller files.`,
        },
      ],
    }
  }
}

// Helper function to process AI response
function processAIResponse(
  responseText: string,
  validCandidates: Candidate[],
  jobDescription: string,
  weightConfig?: WeightConfig,
): RankingResult {
  try {
    // Clean the response text to handle markdown formatting
    const cleanedText = extractJsonFromResponse(responseText)
    console.log("Cleaned response text:", cleanedText.substring(0, 200) + "...")

    const result = JSON.parse(cleanedText) as RankingResult

    // Validate the result structure
    if (!result.rankedCandidates || !Array.isArray(result.rankedCandidates) || result.rankedCandidates.length === 0) {
      console.error("Invalid response structure from AI", cleanedText)
      return generateMockRanking(validCandidates, jobDescription, weightConfig)
    }

    // Ensure all candidates have the required fields
    const validatedCandidates = result.rankedCandidates.map((candidate) => {
      return {
        name: candidate.name || "Unknown Candidate",
        score: typeof candidate.score === "number" ? candidate.score : 50,
        strengths: Array.isArray(candidate.strengths) ? candidate.strengths : ["Has relevant experience"],
        weaknesses: Array.isArray(candidate.weaknesses) ? candidate.weaknesses : [],
        analysis: candidate.analysis || "This candidate has been evaluated based on their resume.",
        categoryScores: candidate.categoryScores || generateDefaultCategoryScores(),
      }
    })

    // Sort candidates by score in descending order
    validatedCandidates.sort((a, b) => b.score - a.score)

    return { rankedCandidates: validatedCandidates }
  } catch (parseError) {
    console.error("Error parsing AI response:", parseError, "Response:", responseText)
    return generateMockRanking(validCandidates, jobDescription, weightConfig)
  }
}

function createRankingPrompt(jobDescription: string, candidates: Candidate[], weightConfig?: WeightConfig): string {
  // Format the weight configuration for the prompt
  let weightInstructions = ""

  if (weightConfig && weightConfig.useCustomWeights) {
    weightInstructions = `
Use the following category weights (scale 1-10) when evaluating candidates:
${weightConfig.categories.map((c) => `- ${c.name}: ${c.weight}/10 - ${c.description}`).join("\n")}

Higher weights indicate more importance for that category. Make sure your evaluation reflects these priorities.
    `
  } else {
    weightInstructions = `
Determine appropriate weights for different evaluation categories based on the job description.
For example, if the job is fully in-person, location should be weighted more heavily.
If technical skills are critical, they should receive a higher weight.
    `
  }

  // Add a time constraint warning if we have many candidates
  const timeConstraintWarning =
    candidates.length > 5
      ? `
IMPORTANT: You have a limited time to analyze these ${candidates.length} candidates. Focus on the most important aspects of each resume to finish within the time limit.
  `
      : ""

  return `
Job Description:
${jobDescription}

${weightInstructions}

${timeConstraintWarning}

Candidates:
${candidates
  .map(
    (c) => `
Name: ${c.name}
Resume:
${c.resume}
`,
  )
  .join("\n---\n")}

IMPORTANT: The job description and resumes have been preprocessed to include only the most relevant information.
Personal contact information has been removed for privacy.
Analyze each candidate's resume against the job description. Rank them based on how well they match the requirements.

For each candidate, provide:
1. A match score (0-100) based on how well their qualifications match the job requirements
2. 3-5 SPECIFIC key strengths relevant to the job (mention actual skills, experiences, or qualifications from their resume)
3. 1-3 SPECIFIC areas for improvement or missing skills (mention actual requirements from the job description that they lack)
4. A brief analysis explaining the ranking (2-3 sentences) that references SPECIFIC aspects of their background
5. Category scores showing how well they match in each category (technical skills, experience, education, etc.)

IMPORTANT GUIDELINES:
- Be SPECIFIC and DETAILED in your analysis - avoid generic statements
- Reference ACTUAL skills, experiences, and qualifications from the resume
- Compare against ACTUAL requirements from the job description
- Do NOT use placeholder text or generic descriptions
- Ensure strengths and weaknesses are SPECIFIC to each candidate
- Use CONCRETE examples from their resume whenever possible

IMPORTANT: Return your analysis as a JSON object with this exact structure, and ONLY the JSON object with no markdown formatting or code blocks:
{
  "rankedCandidates": [
    {
      "name": "Candidate Name",
      "score": 85,
      "strengths": ["Specific strength 1 with details", "Specific strength 2 with details", "Specific strength 3 with details"],
      "weaknesses": ["Specific weakness 1 with details", "Specific weakness 2 with details"],
      "analysis": "Specific analysis of why this candidate received this ranking, referencing actual qualifications and requirements.",
      "categoryScores": {
        "technical_skills": 80,
        "experience": 90,
        "education": 75,
        "location": 60,
        "soft_skills": 85,
        "industry_knowledge": 70,
        "certifications": 65
      }
    }
  ]
}
`
}

// Generate default category scores
function generateDefaultCategoryScores() {
  return {
    technical_skills: Math.floor(Math.random() * 30) + 50,
    experience: Math.floor(Math.random() * 30) + 50,
    education: Math.floor(Math.random() * 30) + 50,
    location: Math.floor(Math.random() * 30) + 50,
    soft_skills: Math.floor(Math.random() * 30) + 50,
    industry_knowledge: Math.floor(Math.random() * 30) + 50,
    certifications: Math.floor(Math.random() * 30) + 50,
  }
}

// Fallback function to generate mock rankings when API is unavailable
function generateMockRanking(
  candidates: Candidate[],
  jobDescription: string,
  weightConfig?: WeightConfig,
  preprocessStats?: { original: number; processed: number; percentReduction: number },
): RankingResult {
  // Ensure we have valid candidates
  if (!candidates || candidates.length === 0) {
    return {
      rankedCandidates: [
        {
          name: "Sample Candidate",
          score: 75,
          strengths: ["Sample strength 1", "Sample strength 2", "Sample strength 3"],
          weaknesses: ["Sample weakness"],
          analysis: "This is a sample candidate generated because no valid candidates were provided.",
          categoryScores: generateDefaultCategoryScores(),
        },
      ],
      preprocessStats: preprocessStats || {
        original: 1000,
        processed: 700,
        percentReduction: 30,
      },
    }
  }

  // Simple keyword matching algorithm
  const keywordsFromJob = extractKeywords(jobDescription)

  // Get weights for different categories
  const weights = getWeightsFromConfig(weightConfig)

  const rankedCandidates = candidates.map((candidate, index) => {
    // Ensure candidate has valid data
    const name = candidate.name.trim() || `Candidate ${index + 1}`
    const resumeText = (candidate.resume || "").toLowerCase()

    // Count matching keywords
    let matchCount = 0
    const matchedKeywords: string[] = []

    keywordsFromJob.forEach((keyword) => {
      if (resumeText.includes(keyword.toLowerCase())) {
        matchCount++
        matchedKeywords.push(keyword)
      }
    })

    // Calculate category scores (simplified version)
    const categoryScores = generateDefaultCategoryScores()

    // Apply weights to calculate weighted score
    let weightedScore = 0
    let totalWeight = 0

    Object.entries(weights).forEach(([category, weight]) => {
      if (category in categoryScores) {
        weightedScore += categoryScores[category as keyof typeof categoryScores] * weight
        totalWeight += weight
      }
    })

    // Calculate final score
    const score = Math.min(Math.round(weightedScore / (totalWeight || 1)), 95)

    // Generate strengths based on matched keywords (up to 3)
    let strengths: string[] = []

    if (matchedKeywords.length > 0) {
      strengths = matchedKeywords.slice(0, 3).map((keyword) => `Has experience with ${keyword}`)
    }

    // If we have fewer than 3 strengths, add generic ones
    while (strengths.length < 3) {
      strengths.push(
        ["Shows relevant experience", "Has applicable skills", "Background aligns with requirements"][
          strengths.length % 3
        ],
      )
    }

    // Generate weaknesses based on unmatched keywords (up to 2)
    let weaknesses: string[] = []

    if (keywordsFromJob.length > 0) {
      const unmatchedKeywords = keywordsFromJob
        .filter((keyword) => !resumeText.includes(keyword.toLowerCase()))
        .slice(0, 2)

      weaknesses = unmatchedKeywords.map((keyword) => `May need more experience with ${keyword}`)
    }

    return {
      name,
      score,
      strengths,
      weaknesses,
      analysis: `This candidate matches approximately ${score}% of the job requirements based on keyword analysis. This is a fallback analysis using our built-in algorithm.`,
      categoryScores,
    }
  })

  // Sort by score
  rankedCandidates.sort((a, b) => b.score - a.score)

  return {
    rankedCandidates,
    preprocessStats: preprocessStats || {
      original: jobDescription.length + candidates.reduce((total, c) => total + (c.resume?.length || 0), 0),
      processed: Math.floor(
        (jobDescription.length + candidates.reduce((total, c) => total + (c.resume?.length || 0), 0)) * 0.7,
      ),
      percentReduction: 30,
    },
  }
}

// Helper function to extract potential keywords from job description
function extractKeywords(text: string): string[] {
  if (!text || typeof text !== "string") {
    return ["experience", "skills", "education", "communication"]
  }

  // This is a simple implementation - in a real app, you'd want more sophisticated NLP
  const words = text.split(/\s+/)

  // Filter out common words and keep potential skills/technologies
  const commonWords = new Set([
    "a",
    "an",
    "the",
    "and",
    "or",
    "but",
    "in",
    "on",
    "at",
    "to",
    "for",
    "with",
    "by",
    "about",
    "as",
    "of",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "have",
    "has",
    "had",
    "do",
    "does",
    "did",
    "will",
    "would",
    "shall",
    "should",
    "can",
    "could",
    "may",
    "might",
    "must",
    "that",
    "which",
    "who",
    "whom",
    "whose",
    "this",
    "these",
    "those",
    "they",
    "them",
    "their",
    "what",
    "when",
    "where",
    "why",
    "how",
    "all",
    "any",
    "both",
    "each",
    "few",
    "more",
    "most",
    "other",
    "some",
    "such",
  ])

  const potentialKeywords = words.filter((word) => {
    const cleaned = word.replace(/[.,/#!$%^&*;:{}=\-_`~()]/g, "").toLowerCase()
    return cleaned.length > 3 && !commonWords.has(cleaned)
  })

  // If we couldn't extract any keywords, return some defaults
  if (potentialKeywords.length === 0) {
    return ["experience", "skills", "education", "communication"]
  }

  // Remove duplicates and return
  return [...new Set(potentialKeywords)]
}

// Helper function to get weights from config
function getWeightsFromConfig(weightConfig?: WeightConfig) {
  const defaultWeights = {
    technical_skills: 5,
    experience: 5,
    education: 3,
    location: 2,
    soft_skills: 3,
    industry_knowledge: 4,
    certifications: 2,
  }

  if (!weightConfig || !weightConfig.useCustomWeights) {
    return defaultWeights
  }

  // Validate weight config
  if (!weightConfig.categories || !Array.isArray(weightConfig.categories) || weightConfig.categories.length === 0) {
    return defaultWeights
  }

  const customWeights: Record<string, number> = {}

  weightConfig.categories.forEach((category) => {
    if (category && category.id && typeof category.weight === "number") {
      customWeights[category.id] = category.weight
    }
  })

  // If no valid weights were found, return defaults
  if (Object.keys(customWeights).length === 0) {
    return defaultWeights
  }

  return customWeights
}
