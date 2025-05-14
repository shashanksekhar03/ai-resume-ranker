/**
 * Text preprocessing utility to optimize content before sending to the API
 * This helps reduce token usage and handle longer documents
 */

// Maximum recommended length for a resume to send to the API
const MAX_RESUME_LENGTH = 4000
// Maximum recommended length for a job description to send to the API
const MAX_JOB_DESCRIPTION_LENGTH = 2000

/**
 * Preprocess text to remove redundancy and optimize for API usage
 */
export function preprocessText(text: string, type: "resume" | "jobDescription"): string {
  if (!text || typeof text !== "string") {
    return ""
  }

  // Normalize whitespace
  let processed = normalizeWhitespace(text)

  // Remove common filler phrases and redundant content
  processed = removeFillerPhrases(processed)

  // Remove duplicate paragraphs and sentences
  processed = removeDuplicateContent(processed)

  // Extract and prioritize key information based on content type
  processed = extractKeyInformation(processed, type)

  // Truncate if still too long
  const maxLength = type === "resume" ? MAX_RESUME_LENGTH : MAX_JOB_DESCRIPTION_LENGTH
  if (processed.length > maxLength) {
    processed = smartTruncate(processed, maxLength, type)
  }

  return processed
}

/**
 * Normalize whitespace, newlines, and other formatting
 */
function normalizeWhitespace(text: string): string {
  // Replace multiple spaces, tabs, and newlines with a single space
  let normalized = text.replace(/\s+/g, " ")

  // Restore paragraph breaks for readability
  normalized = normalized.replace(/\. /g, ".\n")

  // Trim leading/trailing whitespace
  return normalized.trim()
}

/**
 * Remove common filler phrases that don't add value
 */
function removeFillerPhrases(text: string): string {
  const fillerPhrases = [
    "References available upon request",
    "References available on request",
    "References available",
    "Responsible for",
    "Duties included",
    "Duties include",
    "I am a",
    "I have a",
    "I have been",
    "I am experienced in",
    "I am proficient in",
    "I am skilled in",
    "I am an experienced",
    "I am a skilled",
    "I am a proficient",
    "I am a hard-working",
    "I am a dedicated",
    "I am a motivated",
    "I am a passionate",
    "I am a creative",
    "I am an innovative",
    "I am a team player",
    "I am a problem solver",
    "I am a quick learner",
    "I am a self-starter",
    "I am a results-oriented",
    "I am a detail-oriented",
    "I am a highly motivated",
    "I am a highly skilled",
    "I am a highly experienced",
    "I am a highly qualified",
    "I am a highly dedicated",
    "I am a highly passionate",
    "I am a highly creative",
    "I am a highly innovative",
  ]

  let processed = text

  // Remove each filler phrase
  fillerPhrases.forEach((phrase) => {
    const regex = new RegExp(phrase, "gi")
    processed = processed.replace(regex, "")
  })

  return processed
}

/**
 * Remove duplicate paragraphs and similar sentences
 */
function removeDuplicateContent(text: string): string {
  // Split into paragraphs
  const paragraphs = text.split(/\n+/)

  // Remove duplicate paragraphs
  const uniqueParagraphs = [...new Set(paragraphs)]

  // Process each paragraph to remove similar sentences
  const processedParagraphs = uniqueParagraphs.map((paragraph) => {
    // Split paragraph into sentences
    const sentences = paragraph.split(/(?<=[.!?])\s+/)

    // Keep track of unique sentences
    const uniqueSentences = []
    const sentenceFingerprints = new Set()

    for (const sentence of sentences) {
      // Create a fingerprint by keeping only alphanumeric chars and converting to lowercase
      const fingerprint = sentence.toLowerCase().replace(/[^a-z0-9]/g, "")

      // If sentence is too short or a duplicate, skip it
      if (fingerprint.length < 10 || sentenceFingerprints.has(fingerprint)) {
        continue
      }

      sentenceFingerprints.add(fingerprint)
      uniqueSentences.push(sentence)
    }

    return uniqueSentences.join(" ")
  })

  return processedParagraphs.filter((p) => p.trim()).join("\n\n")
}

/**
 * Extract and prioritize key information based on content type
 */
function extractKeyInformation(text: string, type: "resume" | "jobDescription"): string {
  if (type === "resume") {
    return extractResumeInformation(text)
  } else {
    return extractJobDescriptionInformation(text)
  }
}

/**
 * Extract key information from a resume
 */
function extractResumeInformation(text: string): string {
  // Define sections to look for in a resume
  const sectionPatterns = [
    { name: "SKILLS", pattern: /\b(SKILLS|TECHNICAL SKILLS|CORE COMPETENCIES|KEY SKILLS|EXPERTISE|PROFICIENCIES)\b/i },
    {
      name: "EXPERIENCE",
      pattern: /\b(EXPERIENCE|WORK EXPERIENCE|EMPLOYMENT|WORK HISTORY|PROFESSIONAL EXPERIENCE)\b/i,
    },
    { name: "EDUCATION", pattern: /\b(EDUCATION|ACADEMIC BACKGROUND|ACADEMIC QUALIFICATIONS|QUALIFICATIONS)\b/i },
    { name: "PROJECTS", pattern: /\b(PROJECTS|PROJECT EXPERIENCE|KEY PROJECTS|RELEVANT PROJECTS)\b/i },
    { name: "CERTIFICATIONS", pattern: /\b(CERTIFICATIONS|CERTIFICATES|LICENSES|ACCREDITATIONS)\b/i },
  ]

  // Split text into lines
  const lines = text.split("\n")

  // Identify sections in the resume
  const sections: Record<string, string[]> = {
    HEADER: [],
    SKILLS: [],
    EXPERIENCE: [],
    EDUCATION: [],
    PROJECTS: [],
    CERTIFICATIONS: [],
    OTHER: [],
  }

  let currentSection = "HEADER"

  // Categorize lines into sections
  for (const line of lines) {
    // Check if this line is a section header
    let isSectionHeader = false
    for (const { name, pattern } of sectionPatterns) {
      if (pattern.test(line)) {
        currentSection = name
        isSectionHeader = true
        break
      }
    }

    // If it's a section header, add it to that section
    if (isSectionHeader) {
      sections[currentSection].push(line)
    } else {
      // Otherwise add to current section
      sections[currentSection].push(line)
    }
  }

  // Prioritize and reconstruct the resume
  const prioritizedSections = ["HEADER", "SKILLS", "EXPERIENCE", "EDUCATION", "PROJECTS", "CERTIFICATIONS", "OTHER"]

  // Reconstruct the resume with prioritized sections
  return prioritizedSections
    .map((section) => sections[section].join("\n"))
    .filter((section) => section.trim())
    .join("\n\n")
}

/**
 * Extract key information from a job description
 */
function extractJobDescriptionInformation(text: string): string {
  // Define sections to look for in a job description
  const sectionPatterns = [
    {
      name: "REQUIREMENTS",
      pattern: /\b(REQUIREMENTS|QUALIFICATIONS|SKILLS REQUIRED|REQUIRED SKILLS|WHAT YOU'LL NEED)\b/i,
    },
    { name: "RESPONSIBILITIES", pattern: /\b(RESPONSIBILITIES|DUTIES|JOB DUTIES|WHAT YOU'LL DO|ROLE DESCRIPTION)\b/i },
    { name: "BENEFITS", pattern: /\b(BENEFITS|PERKS|WHAT WE OFFER|COMPENSATION|SALARY)\b/i },
    { name: "COMPANY", pattern: /\b(ABOUT US|COMPANY|WHO WE ARE|OUR TEAM|THE COMPANY)\b/i },
  ]

  // Split text into lines
  const lines = text.split("\n")

  // Identify sections in the job description
  const sections: Record<string, string[]> = {
    HEADER: [],
    REQUIREMENTS: [],
    RESPONSIBILITIES: [],
    BENEFITS: [],
    COMPANY: [],
    OTHER: [],
  }

  let currentSection = "HEADER"

  // Categorize lines into sections
  for (const line of lines) {
    // Check if this line is a section header
    let isSectionHeader = false
    for (const { name, pattern } of sectionPatterns) {
      if (pattern.test(line)) {
        currentSection = name
        isSectionHeader = true
        break
      }
    }

    // If it's a section header, add it to that section
    if (isSectionHeader) {
      sections[currentSection].push(line)
    } else {
      // Otherwise add to current section
      sections[currentSection].push(line)
    }
  }

  // Prioritize and reconstruct the job description
  const prioritizedSections = ["HEADER", "REQUIREMENTS", "RESPONSIBILITIES", "COMPANY", "BENEFITS", "OTHER"]

  // Reconstruct the job description with prioritized sections
  return prioritizedSections
    .map((section) => sections[section].join("\n"))
    .filter((section) => section.trim())
    .join("\n\n")
}

/**
 * Smart truncation that preserves the most important information
 */
function smartTruncate(text: string, maxLength: number, type: "resume" | "jobDescription"): string {
  // If already under max length, return as is
  if (text.length <= maxLength) {
    return text
  }

  // For resumes, prioritize skills and recent experience
  if (type === "resume") {
    // Split into sections
    const sections = text.split(/\n\n+/)

    // Prioritize sections (skills and recent experience first)
    const prioritizedSections = []
    const otherSections = []

    for (const section of sections) {
      const lowerSection = section.toLowerCase()
      if (lowerSection.includes("skill") || lowerSection.includes("experience") || lowerSection.includes("education")) {
        prioritizedSections.push(section)
      } else {
        otherSections.push(section)
      }
    }

    // Combine prioritized sections first, then add others until we hit the limit
    let result = ""

    // Add prioritized sections
    for (const section of prioritizedSections) {
      if ((result + section).length <= maxLength) {
        result += (result ? "\n\n" : "") + section
      } else {
        // If adding the whole section would exceed the limit,
        // add as many sentences as possible
        const sentences = section.split(/(?<=[.!?])\s+/)
        for (const sentence of sentences) {
          if ((result + sentence).length <= maxLength) {
            result += (result ? " " : "") + sentence
          } else {
            break
          }
        }
        break
      }
    }

    // Add other sections if there's room
    for (const section of otherSections) {
      if ((result + "\n\n" + section).length <= maxLength) {
        result += "\n\n" + section
      } else {
        break
      }
    }

    return result
  }
  // For job descriptions, prioritize requirements and responsibilities
  else {
    // Split into sections
    const sections = text.split(/\n\n+/)

    // Prioritize sections (requirements and responsibilities first)
    const prioritizedSections = []
    const otherSections = []

    for (const section of sections) {
      const lowerSection = section.toLowerCase()
      if (
        lowerSection.includes("requirement") ||
        lowerSection.includes("qualification") ||
        lowerSection.includes("responsibilit") ||
        lowerSection.includes("duties")
      ) {
        prioritizedSections.push(section)
      } else {
        otherSections.push(section)
      }
    }

    // Combine prioritized sections first, then add others until we hit the limit
    let result = ""

    // Add prioritized sections
    for (const section of prioritizedSections) {
      if ((result + section).length <= maxLength) {
        result += (result ? "\n\n" : "") + section
      } else {
        // If adding the whole section would exceed the limit,
        // add as many sentences as possible
        const sentences = section.split(/(?<=[.!?])\s+/)
        for (const sentence of sentences) {
          if ((result + sentence).length <= maxLength) {
            result += (result ? " " : "") + sentence
          } else {
            break
          }
        }
        break
      }
    }

    // Add other sections if there's room
    for (const section of otherSections) {
      if ((result + "\n\n" + section).length <= maxLength) {
        result += "\n\n" + section
      } else {
        break
      }
    }

    return result
  }
}
