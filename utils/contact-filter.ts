/**
 * Utility to filter out personal contact information from resumes
 * This helps protect privacy and reduces unnecessary data sent to the API
 */

/**
 * Filter out personal contact information from text
 * @param text The resume text to filter
 * @returns Filtered text with contact information removed
 */
export function filterContactInfo(text: string): string {
  if (!text) return ""

  // Replace email addresses
  let filtered = text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, "[EMAIL REMOVED]")

  // Replace phone numbers (various formats)
  filtered = filtered.replace(/\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/g, "[PHONE REMOVED]")
  filtered = filtered.replace(/$$\d{3}$$[-.\s]?\d{3}[-.\s]?\d{4}/g, "[PHONE REMOVED]")
  filtered = filtered.replace(/\+\d{1,3}[-.\s]?\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/g, "[PHONE REMOVED]")

  // Replace LinkedIn URLs
  filtered = filtered.replace(/linkedin\.com\/in\/[a-zA-Z0-9_-]+/g, "[LINKEDIN REMOVED]")
  filtered = filtered.replace(/www\.linkedin\.com\/in\/[a-zA-Z0-9_-]+/g, "[LINKEDIN REMOVED]")
  filtered = filtered.replace(/https?:\/\/(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/g, "[LINKEDIN REMOVED]")

  // Replace other social media profiles
  filtered = filtered.replace(/github\.com\/[a-zA-Z0-9_-]+/g, "[GITHUB REMOVED]")
  filtered = filtered.replace(/twitter\.com\/[a-zA-Z0-9_-]+/g, "[TWITTER REMOVED]")
  filtered = filtered.replace(/facebook\.com\/[a-zA-Z0-9_-]+/g, "[FACEBOOK REMOVED]")

  // Replace physical addresses (this is a simple approach, not comprehensive)
  filtered = filtered.replace(/\d+\s+[A-Za-z\s]+,\s+[A-Za-z\s]+,\s+[A-Z]{2}\s+\d{5}/g, "[ADDRESS REMOVED]")

  return filtered
}

/**
 * Extract contact information for reference but remove it from the text
 * @param text The resume text to process
 * @returns An object containing the extracted contact info and filtered text
 */
export function extractAndFilterContactInfo(text: string): {
  filteredText: string
  contactInfo: {
    email: string
    phone: string
    linkedin: string
  }
} {
  if (!text)
    return {
      filteredText: "",
      contactInfo: { email: "", phone: "", linkedin: "" },
    }

  // Extract email
  const emailRegex = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/
  const emailMatch = text.match(emailRegex)
  const email = emailMatch ? emailMatch[0] : ""

  // Extract phone
  const phoneRegex = /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/
  const phoneMatch = text.match(phoneRegex)
  const phone = phoneMatch ? phoneMatch[0] : ""

  // Extract LinkedIn
  const linkedinRegex = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/[a-zA-Z0-9_-]+/
  const linkedinMatch = text.match(linkedinRegex)
  const linkedin = linkedinMatch ? linkedinMatch[0] : ""

  // Filter the text
  const filteredText = filterContactInfo(text)

  return {
    filteredText,
    contactInfo: {
      email,
      phone,
      linkedin,
    },
  }
}
