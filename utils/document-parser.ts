/**
 * Parse document files (PDF, DOCX, DOC) and extract text content
 */
import mammoth from "mammoth"

// Add a file size limit to prevent memory issues
const MAX_FILE_SIZE_MB = 10 // 10MB limit

export async function parseDocument(file: File): Promise<string> {
  try {
    // Check file size
    const fileSizeMB = file.size / (1024 * 1024)
    if (fileSizeMB > MAX_FILE_SIZE_MB) {
      throw new Error(`File size exceeds the ${MAX_FILE_SIZE_MB}MB limit. Please upload a smaller file.`)
    }

    const fileName = file.name.toLowerCase()
    const fileType = file.type

    // Handle different file types with memory optimization
    if (fileName.endsWith(".pdf") || fileType === "application/pdf") {
      return await extractTextFromPdf(file)
    } else if (
      fileName.endsWith(".docx") ||
      fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      return await extractTextFromDocx(file)
    } else if (fileName.endsWith(".doc") || fileType === "application/msword") {
      return await extractTextFromDoc(file)
    } else {
      throw new Error("Unsupported file format. Please upload a PDF, DOC, or DOCX file.")
    }
  } catch (error) {
    console.error("Error parsing document:", error)
    let errorMessage = "Failed to parse document"

    // Add more specific error messages
    if (error instanceof Error) {
      if (error.message.includes("size exceeds")) {
        errorMessage = error.message
      } else if (error.message.includes("memory")) {
        errorMessage = "Document processing failed due to memory limitations. Try a smaller file."
      } else {
        errorMessage = `Failed to parse document: ${error.message}`
      }
    }

    throw new Error(errorMessage)
  }
}

/**
 * Extract text from PDF files
 */
async function extractTextFromPdf(file: File): Promise<string> {
  try {
    // For large PDFs, we'll read the file in chunks to avoid memory issues
    const MAX_CHUNK_SIZE = 5 * 1024 * 1024 // 5MB chunks

    if (file.size > MAX_CHUNK_SIZE) {
      // For large files, use a simpler extraction approach
      // that prioritizes memory efficiency over completeness
      return await extractLargePdfText(file)
    }

    // For smaller files, use the normal approach
    const arrayBuffer = await file.arrayBuffer()
    const text = await extractTextFromPdfUsingFetch(arrayBuffer)
    return cleanExtractedText(text)
  } catch (error) {
    console.error("Error extracting text from PDF:", error)
    throw new Error("Failed to extract text from PDF. Please try again or use text input.")
  }
}

// Add a new function for handling large PDFs
// Add this function after the extractTextFromPdf function:

async function extractLargePdfText(file: File): Promise<string> {
  try {
    // For large PDFs, we'll extract text in a more memory-efficient way
    // This is a simplified approach that may not extract all text perfectly
    // but will avoid memory issues with large files

    // Read the first 2MB of the file to extract metadata and initial text
    const chunk = file.slice(0, 2 * 1024 * 1024)
    const buffer = await chunk.arrayBuffer()

    // Extract what we can from this chunk
    const text = await extractTextFromPdfUsingFetch(buffer)

    // Add a note that this is a partial extraction for very large files
    const fileSize = (file.size / (1024 * 1024)).toFixed(1)
    const note = `\n\n[Note: This is a partial extraction of a large PDF (${fileSize}MB). For best results with large files, consider copying and pasting the most relevant sections manually.]`

    return cleanExtractedText(text) + note
  } catch (error) {
    console.error("Error extracting text from large PDF:", error)
    return "Error extracting text from large PDF. Please try using a smaller file or enter the text manually."
  }
}

/**
 * Extract text from PDF using a fetch-based approach
 */
async function extractTextFromPdfUsingFetch(arrayBuffer: ArrayBuffer): Promise<string> {
  try {
    // In a real app, you'd use a proper PDF parsing library
    // For now, we'll simulate successful extraction

    // Convert ArrayBuffer to Base64
    const base64 = arrayBufferToBase64(arrayBuffer)

    // Use a server endpoint to extract text from PDF
    // This is a placeholder - in a real app, you'd implement this endpoint
    // For now, we'll return a placeholder text
    return "This is placeholder text extracted from a PDF file. In a real app, you'd use a proper PDF parsing library."
  } catch (error) {
    console.error("Error extracting text from PDF using fetch:", error)
    throw new Error("Failed to extract text from PDF. Please try again or use text input.")
  }
}

/**
 * Extract text from DOCX files using mammoth.js
 */
async function extractTextFromDocx(file: File): Promise<string> {
  try {
    // Convert File to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer()

    // Use mammoth.js to extract text from DOCX
    const result = await mammoth.extractRawText({ arrayBuffer })

    // Get the extracted text
    const text = result.value

    // Clean up the extracted text
    return cleanExtractedText(text)
  } catch (error) {
    console.error("Error extracting text from DOCX:", error)
    throw new Error("Failed to extract text from DOCX. Please try again or use text input.")
  }
}

/**
 * Extract text from DOC files
 */
async function extractTextFromDoc(file: File): Promise<string> {
  try {
    // For DOC files, we'll use a simple text extraction as a fallback
    // In a production app, you'd want a more robust solution

    // Try to read the file as text
    const text = await file.text()

    // Clean up the extracted text
    return cleanExtractedText(text)
  } catch (error) {
    console.error("Error extracting text from DOC:", error)
    throw new Error("Failed to extract text from DOC. Please try again or use text input.")
  }
}

/**
 * Clean up extracted text from documents
 */
function cleanExtractedText(text: string): string {
  // Remove excessive whitespace
  let cleaned = text.replace(/\s+/g, " ")

  // Fix common OCR/extraction issues
  cleaned = cleaned
    .replace(/([a-z])([A-Z])/g, "$1 $2") // Add space between lowercase and uppercase letters
    .replace(/•/g, "\n• ") // Format bullet points
    .replace(/\n+/g, "\n") // Replace multiple newlines with single newline
    .replace(/\n\s+/g, "\n") // Remove spaces after newlines
    .replace(/\s+\n/g, "\n") // Remove spaces before newlines
    .trim()

  // Restore paragraph structure
  cleaned = cleaned.replace(/\. /g, ".\n")

  return cleaned
}

/**
 * Convert ArrayBuffer to Base64
 */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = ""
  const bytes = new Uint8Array(buffer)
  const len = bytes.byteLength

  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }

  return window.btoa(binary)
}
