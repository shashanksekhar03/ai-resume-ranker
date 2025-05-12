"use server"

import { PDFExtract, type PDFExtractOptions } from "pdf.js-extract"

export async function parsePdf(file: File): Promise<string> {
  try {
    // Convert File to Buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Initialize PDF extractor
    const pdfExtract = new PDFExtract()
    const options: PDFExtractOptions = {}

    // Extract text from PDF
    const data = await pdfExtract.extractBuffer(buffer, options)

    // Combine all page content into a single string
    let text = ""
    if (data && data.pages) {
      for (const page of data.pages) {
        if (page.content) {
          // Extract just the text content from each page
          const pageText = page.content.map((item) => item.str).join(" ")

          text += pageText + "\n"
        }
      }
    }

    return text
  } catch (error) {
    console.error("Error parsing PDF:", error)
    throw new Error("Failed to parse PDF. Please try again or use text input.")
  }
}
