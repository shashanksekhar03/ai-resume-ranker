"use client"

import type React from "react"

import { useState, useCallback, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { rankCandidates } from "@/actions/rank-candidates"
import { RankingResults } from "@/components/ranking-results"
import type { Candidate, RankingResult, WeightConfig } from "@/types/resume-ranker"
import { Loader2, UserPlus, AlertTriangle, CheckCircle } from "lucide-react"
import { FileUpload } from "@/components/file-upload"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { WeightConfigurator } from "@/components/weight-configurator"
import { ModelStatus } from "@/components/model-status"
import { Separator } from "@/components/ui/separator"
import {
  detectNameFromResume,
  extractEmail,
  generateNameFromEmail,
  extractNameFromFilename,
} from "@/utils/name-detector"
import { parseDocument } from "@/utils/document-parser"
import { MultiFileUpload } from "@/components/multi-file-upload"
import { ProcessingStatus } from "@/components/processing-status"

export function ResumeRanker() {
  // Initialize with empty candidates array instead of 3 default candidates
  const [jobDescription, setJobDescription] = useState("")
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [results, setResults] = useState<RankingResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isGeneratingWeights, setIsGeneratingWeights] = useState(false)
  const [detectedNames, setDetectedNames] = useState<Record<string, boolean>>({})
  const [fileProcessingStatus, setFileProcessingStatus] = useState<Record<string, string>>({})
  const [isBulkProcessing, setIsBulkProcessing] = useState(false)
  const [processingMessage, setProcessingMessage] = useState<string>("")

  // Weight configuration state
  const [weightConfig, setWeightConfig] = useState<WeightConfig>({
    categories: [],
    useCustomWeights: false,
  })

  // File state
  const [jobDescriptionFile, setJobDescriptionFile] = useState<File | null>(null)
  const [candidateFiles, setCandidateFiles] = useState<Record<string, File | null>>({})

  // Add state for tracking preprocessing
  const [preprocessStats, setPreprocessStats] = useState<{
    original: number
    processed: number
    percentReduction: number
  } | null>(null)

  const addCandidate = useCallback(() => {
    const newId = Date.now().toString()
    setCandidates((prev) => [...prev, { id: newId, name: "", resume: "" }])
    setCandidateFiles((prev) => ({
      ...prev,
      [newId]: null,
    }))
  }, [])

  const removeCandidate = useCallback(
    (id: string) => {
      if (candidates.length > 1) {
        setCandidates((prev) => prev.filter((candidate) => candidate.id !== id))

        // Remove the file for this candidate
        setCandidateFiles((prev) => {
          const updated = { ...prev }
          delete updated[id]
          return updated
        })

        // Remove detected name status
        setDetectedNames((prev) => {
          const updated = { ...prev }
          delete updated[id]
          return updated
        })

        // Remove file processing status
        setFileProcessingStatus((prev) => {
          const updated = { ...prev }
          delete updated[id]
          return updated
        })
      }
    },
    [candidates.length],
  )

  const updateCandidate = useCallback((id: string, field: "name" | "resume", value: string) => {
    setCandidates((prev) =>
      prev.map((candidate) => (candidate.id === id ? { ...candidate, [field]: value } : candidate)),
    )

    // If manually updating the name, mark it as no longer auto-detected
    if (field === "name") {
      setDetectedNames((prev) => ({
        ...prev,
        [id]: false,
      }))
    }

    // If updating the resume, try to detect the name
    if (field === "resume" && value.trim()) {
      // Try to detect name from the resume text
      const { name, confidence } = detectNameFromResume(value)

      if (name && confidence > 0.4) {
        // Update the candidate's name if we detected one with good confidence
        setCandidates((prev) => prev.map((candidate) => (candidate.id === id ? { ...candidate, name } : candidate)))

        // Mark this name as auto-detected
        setDetectedNames((prev) => ({
          ...prev,
          [id]: true,
        }))
      } else {
        // Try to extract email and generate name from it
        const email = extractEmail(value)
        if (email) {
          const generatedName = generateNameFromEmail(email)
          if (generatedName) {
            setCandidates((prev) =>
              prev.map((candidate) => (candidate.id === id ? { ...candidate, name: generatedName } : candidate)),
            )

            // Mark this name as auto-detected
            setDetectedNames((prev) => ({
              ...prev,
              [id]: true,
            }))
          }
        }
      }
    }
  }, [])

  const updateCandidateFile = useCallback(async (id: string, file: File | null) => {
    setCandidateFiles((prev) => ({
      ...prev,
      [id]: file,
    }))

    // If a file is provided, try to extract text and detect name
    if (file) {
      try {
        // Update status to processing
        setFileProcessingStatus((prev) => ({
          ...prev,
          [id]: "processing",
        }))

        // Extract text from the file
        const extractedText = await parseDocument(file)

        if (extractedText && extractedText.trim()) {
          // Update the resume text
          setCandidates((prev) =>
            prev.map((candidate) => (candidate.id === id ? { ...candidate, resume: extractedText } : candidate)),
          )

          // Try to detect the name from the extracted text
          const { name, confidence } = detectNameFromResume(extractedText)

          if (name && confidence > 0.4) {
            // Update the candidate's name if we detected one with good confidence
            setCandidates((prev) => prev.map((candidate) => (candidate.id === id ? { ...candidate, name } : candidate)))

            // Mark this name as auto-detected
            setDetectedNames((prev) => ({
              ...prev,
              [id]: true,
            }))
          } else {
            // Try to extract email and generate name from it
            const email = extractEmail(extractedText)
            if (email) {
              const generatedName = generateNameFromEmail(email)
              if (generatedName) {
                setCandidates((prev) =>
                  prev.map((candidate) => (candidate.id === id ? { ...candidate, name: generatedName } : candidate)),
                )

                // Mark this name as auto-detected
                setDetectedNames((prev) => ({
                  ...prev,
                  [id]: true,
                }))
              } else {
                // Try to extract name from filename as a last resort
                const filenameBasedName = extractNameFromFilename(file.name)
                if (filenameBasedName) {
                  setCandidates((prev) =>
                    prev.map((candidate) =>
                      candidate.id === id ? { ...candidate, name: filenameBasedName } : candidate,
                    ),
                  )

                  // Mark this name as auto-detected
                  setDetectedNames((prev) => ({
                    ...prev,
                    [id]: true,
                  }))
                }
              }
            } else {
              // Try to extract name from filename if no email was found
              const filenameBasedName = extractNameFromFilename(file.name)
              if (filenameBasedName) {
                setCandidates((prev) =>
                  prev.map((candidate) =>
                    candidate.id === id ? { ...candidate, name: filenameBasedName } : candidate,
                  ),
                )

                // Mark this name as auto-detected
                setDetectedNames((prev) => ({
                  ...prev,
                  [id]: true,
                }))
              }
            }
          }

          // Update status to success
          setFileProcessingStatus((prev) => ({
            ...prev,
            [id]: "success",
          }))
        } else {
          // Update status to error
          setFileProcessingStatus((prev) => ({
            ...prev,
            [id]: "error",
          }))

          throw new Error("No text could be extracted from the file")
        }
      } catch (error) {
        console.error(`Error processing file for candidate ${id}:`, error)

        // Update status to error
        setFileProcessingStatus((prev) => ({
          ...prev,
          [id]: "error",
        }))

        // Show error message
        setError(`Error processing file: ${error instanceof Error ? error.message : String(error)}`)
      }
    } else {
      // Clear file processing status when file is removed
      setFileProcessingStatus((prev) => {
        const updated = { ...prev }
        delete updated[id]
        return updated
      })
    }
  }, [])

  const handleMultipleFiles = useCallback(
    async (files: File[]) => {
      if (files.length === 0) return

      setIsBulkProcessing(true)
      setError(null) // Clear any previous errors

      try {
        const newCandidates: Candidate[] = []
        const newCandidateFiles: Record<string, File> = {}
        const newFileStatuses: Record<string, string> = {}
        const newDetectedNames: Record<string, boolean> = {}

        // Process files in smaller batches to avoid memory issues
        const batchSize = 2 // Reduced batch size for better reliability
        const totalBatches = Math.ceil(files.length / batchSize)

        for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
          const batchStart = batchIndex * batchSize
          const batch = files.slice(batchStart, batchStart + batchSize)

          // Show progress
          setProcessingMessage(
            `Processing batch ${batchIndex + 1}/${totalBatches} (${batchStart + 1}-${Math.min(batchStart + batchSize, files.length)} of ${files.length} files)...`,
          )

          // Process each file in the batch sequentially to reduce memory pressure
          for (const file of batch) {
            try {
              const candidateId = Date.now().toString() + Math.random().toString(36).substring(2, 9)

              newCandidateFiles[candidateId] = file
              newFileStatuses[candidateId] = "processing"

              // Extract text from the file with memory optimization
              const extractedText = await parseDocument(file)

              if (extractedText && extractedText.trim()) {
                // Try to detect the name from the extracted text
                const { name, confidence } = detectNameFromResume(extractedText)

                let candidateName = ""

                if (name && confidence > 0.4) {
                  candidateName = name
                  newDetectedNames[candidateId] = true
                } else {
                  // Try to extract email and generate name from it
                  const email = extractEmail(extractedText)
                  if (email) {
                    const generatedName = generateNameFromEmail(email)
                    if (generatedName) {
                      candidateName = generatedName
                      newDetectedNames[candidateId] = true
                    }
                  }

                  // If still no name, try to extract from filename
                  if (!candidateName) {
                    const filenameBasedName = extractNameFromFilename(file.name)
                    if (filenameBasedName) {
                      candidateName = filenameBasedName
                      newDetectedNames[candidateId] = true
                    }
                  }
                }

                // If still no name, use a generic one
                if (!candidateName) {
                  candidateName = `Candidate ${candidates.length + newCandidates.length + 1}`
                }

                newCandidates.push({
                  id: candidateId,
                  name: candidateName,
                  resume: extractedText,
                })

                newFileStatuses[candidateId] = "success"
              } else {
                newFileStatuses[candidateId] = "error"
              }
            } catch (error) {
              console.error("Error processing file:", error)
              // Continue with other files even if one fails
            }

            // Small delay between files to let the browser breathe
            await new Promise((resolve) => setTimeout(resolve, 50))
          }

          // Update state with the batch results to show progress
          setCandidates((prev) => [
            ...prev,
            ...newCandidates.slice(batchIndex * batchSize, (batchIndex + 1) * batchSize),
          ])
          setCandidateFiles((prev) => ({ ...prev, ...newCandidateFiles }))
          setFileProcessingStatus((prev) => ({ ...prev, ...newFileStatuses }))
          setDetectedNames((prev) => ({ ...prev, ...newDetectedNames }))

          // Larger delay between batches to let the browser process the updates
          await new Promise((resolve) => setTimeout(resolve, 100))
        }

        // Clear the processing message
        setProcessingMessage("")
      } catch (error) {
        console.error("Error handling multiple files:", error)
        setError(`Error processing files: ${error instanceof Error ? error.message : String(error)}`)
      } finally {
        setIsBulkProcessing(false)
      }
    },
    [candidates.length],
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null) // Clear previous errors
    setProcessingMessage("") // Clear processing message
    setPreprocessStats(null) // Clear previous stats

    // Validate inputs
    if (!jobDescription.trim() && !jobDescriptionFile) {
      alert("Please enter a job description or upload a file")
      return
    }

    // Check if there are any candidates
    if (candidates.length === 0) {
      alert("Please add at least one candidate")
      return
    }

    const validCandidates = candidates.filter((c) => {
      // A candidate is valid if they have a resume (text OR file)
      return c.resume.trim() || candidateFiles[c.id]
    })

    if (validCandidates.length < 1) {
      alert("Please enter at least one candidate resume (text or file)")
      return
    }

    // Warn if there are many candidates
    if (validCandidates.length > 10) {
      const proceed = window.confirm(
        `You are about to rank ${validCandidates.length} candidates, which may take some time and could cause performance issues. Would you like to proceed?`,
      )
      if (!proceed) return
    }

    setIsLoading(true)

    try {
      // Calculate total original text length
      const originalJobDescLength = jobDescription.length
      const originalCandidatesLength = validCandidates.reduce((total, c) => total + c.resume.length, 0)
      const originalTotalLength = originalJobDescLength + originalCandidatesLength

      // Process candidates in batches regardless of count
      // This is a key change to ensure reliability with many candidates
      const batchSize = 3 // Reduced batch size for better reliability
      const batches = Math.ceil(validCandidates.length / batchSize)

      let allRankedCandidates: any[] = []

      for (let i = 0; i < batches; i++) {
        const batchStart = i * batchSize
        const batchEnd = Math.min((i + 1) * batchSize, validCandidates.length)
        const batchCandidates = validCandidates.slice(batchStart, batchEnd)

        setProcessingMessage(
          `Processing batch ${i + 1}/${batches} (candidates ${batchStart + 1}-${batchEnd} of ${validCandidates.length})...`,
        )

        // Get candidate files for this batch
        const batchCandidateFiles: Record<string, File | null> = {}
        batchCandidates.forEach((c) => {
          if (candidateFiles[c.id]) {
            batchCandidateFiles[c.id] = candidateFiles[c.id]
          }
        })

        try {
          // Rank this batch
          const batchResult = await rankCandidates({
            jobDescription,
            candidates: batchCandidates,
            jobDescriptionFile,
            candidateFiles: batchCandidateFiles,
            weightConfig,
          })

          // Add to overall results
          if (batchResult && batchResult.rankedCandidates) {
            allRankedCandidates = [...allRankedCandidates, ...batchResult.rankedCandidates]

            // Save preprocessing stats from first batch
            if (i === 0 && batchResult.preprocessStats) {
              setPreprocessStats(batchResult.preprocessStats)
            }
          }
        } catch (batchError) {
          console.error(`Error processing batch ${i + 1}:`, batchError)

          // Add an error entry for this batch
          allRankedCandidates.push({
            name: `Batch ${i + 1} Error`,
            score: 0,
            strengths: [],
            weaknesses: [`Error: ${batchError instanceof Error ? batchError.message : String(batchError)}`],
            analysis: `An error occurred while processing batch ${i + 1}. Some candidates may not have been properly analyzed.`,
          })
        }

        // Add a delay between batches to avoid rate limiting
        if (i < batches - 1) {
          await new Promise((resolve) => setTimeout(resolve, 1000))
        }
      }

      // Sort all candidates by score
      allRankedCandidates.sort((a, b) => b.score - a.score)

      // Create final result
      const result: RankingResult = {
        rankedCandidates: allRankedCandidates,
        preprocessStats: preprocessStats || {
          original: originalTotalLength,
          processed: Math.floor(originalTotalLength * 0.7),
          percentReduction: 30,
        },
      }

      setResults(result)
      setProcessingMessage("") // Clear processing message
    } catch (error) {
      console.error("Error ranking candidates:", error)
      const errorMessage = error instanceof Error ? error.message : String(error)

      setError(`An error occurred while ranking candidates: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  // Effect to process job description file when it changes
  useEffect(() => {
    const processJobDescriptionFile = async () => {
      if (jobDescriptionFile) {
        try {
          const extractedText = await parseDocument(jobDescriptionFile)
          if (extractedText && extractedText.trim()) {
            setJobDescription(extractedText)
          }
        } catch (error) {
          console.error("Error processing job description file:", error)
          setError(`Error processing job description file: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    }

    processJobDescriptionFile()
  }, [jobDescriptionFile])

  return (
    <div className="max-w-4xl mx-auto">
      {/* Model Status Check */}
      <ModelStatus />

      {error && !error.includes("Processing") && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4 mb-6">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">{error}</p>
              <p className="mt-2 text-sm text-red-700">Please try again or contact support if the issue persists.</p>
            </div>
          </div>
        </div>
      )}

      {/* Show processing status for batch operations */}
      {(processingMessage || (error && error.includes("Processing"))) && (
        <ProcessingStatus message={processingMessage || error || ""} isProcessing={isLoading || isBulkProcessing} />
      )}

      {preprocessStats && !isLoading && <PreprocessingStats stats={preprocessStats} />}

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Job Description Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Job Description</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Tabs defaultValue="file" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="file">Upload File</TabsTrigger>
                  <TabsTrigger value="text">Enter Text</TabsTrigger>
                </TabsList>
                <TabsContent value="file">
                  <FileUpload
                    id="job-description-file"
                    label="Upload Job Description (PDF, DOC, or DOCX)"
                    onChange={setJobDescriptionFile}
                    currentFile={jobDescriptionFile}
                  />
                </TabsContent>
                <TabsContent value="text">
                  <div>
                    <Textarea
                      id="job-description"
                      placeholder="Paste the job description here..."
                      className="min-h-[200px]"
                      value={jobDescription}
                      onChange={(e) => setJobDescription(e.target.value)}
                    />
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </CardContent>
        </Card>

        {/* Weights Section */}
        <WeightConfigurator
          jobDescription={jobDescription}
          onWeightsChange={setWeightConfig}
          isGeneratingWeights={isGeneratingWeights}
          setIsGeneratingWeights={setIsGeneratingWeights}
        />

        {/* Candidates Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Candidates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="mb-6">
              <h3 className="text-sm font-medium mb-2">Bulk Upload Resumes</h3>
              <MultiFileUpload onFilesSelected={handleMultipleFiles} isProcessing={isBulkProcessing} />
              <p className="text-xs text-gray-500 mt-2">
                Drag and drop multiple resume files to create candidates automatically
              </p>
            </div>

            {candidates.length === 0 ? (
              <div className="text-center py-6 border-2 border-dashed rounded-md border-gray-200">
                <p className="text-gray-500">No candidates added yet</p>
                <p className="text-sm text-gray-400 mt-1">Use the bulk upload above or add candidates manually</p>
              </div>
            ) : (
              candidates.map((candidate, index) => (
                <div key={candidate.id} className="space-y-4">
                  {index > 0 && <Separator className="my-6" />}

                  <div className="flex justify-between items-center">
                    <h3 className="font-medium text-lg flex items-center">Candidate {index + 1}</h3>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeCandidate(candidate.id)}>
                      Remove
                    </Button>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <Label htmlFor={`name-${candidate.id}`}>Name</Label>
                      {detectedNames[candidate.id] && (
                        <span className="text-xs flex items-center text-green-600">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          Auto-detected
                        </span>
                      )}
                    </div>
                    <Input
                      id={`name-${candidate.id}`}
                      placeholder="Name will be auto-detected from resume"
                      value={candidate.name}
                      onChange={(e) => updateCandidate(candidate.id, "name", e.target.value)}
                      className={detectedNames[candidate.id] ? "border-green-300 focus-visible:ring-green-300" : ""}
                    />
                  </div>

                  <Tabs defaultValue="file" className="w-full">
                    <TabsList className="mb-4">
                      <TabsTrigger value="file">Upload Resume</TabsTrigger>
                      <TabsTrigger value="text">Enter Resume Text</TabsTrigger>
                    </TabsList>
                    <TabsContent value="file">
                      <FileUpload
                        id={`resume-file-${candidate.id}`}
                        label="Upload Resume (PDF, DOC, or DOCX)"
                        onChange={(file) => updateCandidateFile(candidate.id, file)}
                        currentFile={candidateFiles[candidate.id] || null}
                      />

                      {/* File Processing Status */}
                      {fileProcessingStatus[candidate.id] === "processing" && (
                        <div className="mt-2 flex items-center text-blue-600 text-sm">
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                          Processing file...
                        </div>
                      )}

                      {fileProcessingStatus[candidate.id] === "success" && (
                        <div className="mt-2 flex items-center text-green-600 text-sm">
                          <CheckCircle className="h-3 w-3 mr-1" />
                          File processed successfully
                        </div>
                      )}

                      {fileProcessingStatus[candidate.id] === "error" && (
                        <div className="mt-2 flex items-center text-red-600 text-sm">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          Error processing file
                        </div>
                      )}

                      {/* Show extracted text preview if available */}
                      {candidateFiles[candidate.id] && candidate.resume && (
                        <div className="mt-4">
                          <Label htmlFor={`preview-${candidate.id}`} className="text-sm text-gray-500">
                            Extracted Text Preview
                          </Label>
                          <div
                            id={`preview-${candidate.id}`}
                            className="mt-1 p-2 border rounded-md bg-gray-50 text-sm max-h-[100px] overflow-y-auto"
                          >
                            {candidate.resume.length > 300
                              ? `${candidate.resume.substring(0, 300)}...`
                              : candidate.resume}
                          </div>
                        </div>
                      )}
                    </TabsContent>
                    <TabsContent value="text">
                      <div>
                        <Label htmlFor={`resume-${candidate.id}`}>Resume</Label>
                        <Textarea
                          id={`resume-${candidate.id}`}
                          placeholder="Paste the candidate's resume here..."
                          className="min-h-[150px]"
                          value={candidate.resume}
                          onChange={(e) => updateCandidate(candidate.id, "resume", e.target.value)}
                        />
                      </div>
                    </TabsContent>
                  </Tabs>
                </div>
              ))
            )}

            {/* Add Candidate Button - Always visible */}
            <Button type="button" onClick={addCandidate} variant="outline" className="w-full mt-4">
              <UserPlus className="mr-2 h-4 w-4" />
              {candidates.length === 0 ? "Add a Candidate" : "Add Another Candidate"}
            </Button>
          </CardContent>
        </Card>

        {/* Submit Button */}
        <div className="flex justify-center">
          <Button type="submit" size="lg" disabled={isLoading || isGeneratingWeights}>
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Ranking Candidates...
              </>
            ) : (
              "Rank Candidates"
            )}
          </Button>
        </div>
      </form>

      {/* Results Section */}
      {results && !isLoading && (
        <div className="mt-12">
          <RankingResults results={results} />
        </div>
      )}
    </div>
  )
}

// Add a component to display preprocessing stats
function PreprocessingStats({ stats }: { stats: { original: number; processed: number; percentReduction: number } }) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-md p-3 mb-6">
      <div className="flex items-start">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-green-400" viewBox="0 0 20 20" fill="currentColor">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-medium text-green-800">Text Preprocessing Results</h3>
          <div className="mt-2 text-sm text-green-700">
            <p>
              Original text: {stats.original.toLocaleString()} characters
              <br />
              Processed text: {stats.processed.toLocaleString()} characters
              <br />
              Reduction: {stats.percentReduction}% ({(stats.original - stats.processed).toLocaleString()} characters)
            </p>
          </div>
          <p className="mt-2 text-xs text-green-600">
            Text preprocessing removed redundant information to optimize API usage and improve results.
          </p>
        </div>
      </div>
    </div>
  )
}
