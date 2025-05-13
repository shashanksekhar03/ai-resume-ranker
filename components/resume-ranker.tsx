"use client"

import type React from "react"

import { useState, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { rankCandidates } from "@/actions/rank-candidates"
import { RankingResults } from "@/components/ranking-results"
import type { Candidate, RankingResult, WeightConfig } from "@/types/resume-ranker"
import { Loader2, AlertCircle, UserPlus } from "lucide-react"
import { FileUpload } from "@/components/file-upload"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { WeightConfigurator } from "@/components/weight-configurator"
import { ModelStatus } from "@/components/model-status"
import { Separator } from "@/components/ui/separator"

export function ResumeRanker() {
  const [jobDescription, setJobDescription] = useState("")
  const [candidates, setCandidates] = useState<Candidate[]>([{ id: "1", name: "", resume: "" }])
  const [results, setResults] = useState<RankingResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isGeneratingWeights, setIsGeneratingWeights] = useState(false)

  // Weight configuration state
  const [weightConfig, setWeightConfig] = useState<WeightConfig>({
    categories: [],
    useCustomWeights: false,
  })

  // File state
  const [jobDescriptionFile, setJobDescriptionFile] = useState<File | null>(null)
  const [candidateFiles, setCandidateFiles] = useState<Record<string, File | null>>({})

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
      }
    },
    [candidates.length],
  )

  const updateCandidate = useCallback((id: string, field: "name" | "resume", value: string) => {
    setCandidates((prev) =>
      prev.map((candidate) => (candidate.id === id ? { ...candidate, [field]: value } : candidate)),
    )
  }, [])

  const updateCandidateFile = useCallback((id: string, file: File | null) => {
    setCandidateFiles((prev) => ({
      ...prev,
      [id]: file,
    }))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null) // Clear previous errors

    // Validate inputs
    if (!jobDescription.trim() && !jobDescriptionFile) {
      alert("Please enter a job description or upload a file")
      return
    }

    const validCandidates = candidates.filter((c) => {
      // A candidate is valid if they have a name AND either resume text OR a file
      return c.name.trim() && (c.resume.trim() || candidateFiles[c.id])
    })

    if (validCandidates.length < 1) {
      alert("Please enter at least one candidate with name and resume (text or file)")
      return
    }

    setIsLoading(true)

    try {
      const result = await rankCandidates({
        jobDescription,
        candidates: validCandidates,
        jobDescriptionFile,
        candidateFiles,
        weightConfig,
      })

      // Validate the result
      if (!result || !result.rankedCandidates || !Array.isArray(result.rankedCandidates)) {
        throw new Error("Invalid response format from ranking service")
      }

      setResults(result)
    } catch (error) {
      console.error("Error ranking candidates:", error)
      const errorMessage = error instanceof Error ? error.message : String(error)

      setError(`An error occurred while ranking candidates: ${errorMessage}`)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* Model Status Check */}
      <ModelStatus />

      {error && (
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

      <Alert className="mb-6 bg-amber-50 border-amber-200">
        <AlertCircle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          File upload functionality is currently limited in this preview. For best results, please use the text input
          option.
        </AlertDescription>
      </Alert>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Job Description Section */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle>Job Description</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Tabs defaultValue="text" className="w-full">
                <TabsList className="mb-4">
                  <TabsTrigger value="text">Enter Text</TabsTrigger>
                  <TabsTrigger value="file">Upload File</TabsTrigger>
                </TabsList>
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
                <TabsContent value="file">
                  <FileUpload
                    id="job-description-file"
                    label="Upload Job Description (PDF, DOC, or DOCX)"
                    onChange={setJobDescriptionFile}
                    currentFile={jobDescriptionFile}
                  />
                  <p className="text-sm text-amber-600 mt-2">
                    Note: File text extraction is simplified in this preview. For best results, copy-paste the text.
                  </p>
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
            {candidates.map((candidate, index) => (
              <div key={candidate.id} className="space-y-4">
                {index > 0 && <Separator className="my-6" />}

                <div className="flex justify-between items-center">
                  <h3 className="font-medium text-lg flex items-center">Candidate {index + 1}</h3>
                  {candidates.length > 1 && (
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeCandidate(candidate.id)}>
                      Remove
                    </Button>
                  )}
                </div>

                <div>
                  <Label htmlFor={`name-${candidate.id}`}>Name</Label>
                  <Input
                    id={`name-${candidate.id}`}
                    placeholder="Candidate name"
                    value={candidate.name}
                    onChange={(e) => updateCandidate(candidate.id, "name", e.target.value)}
                  />
                </div>

                <Tabs defaultValue="text" className="w-full">
                  <TabsList className="mb-4">
                    <TabsTrigger value="text">Enter Resume Text</TabsTrigger>
                    <TabsTrigger value="file">Upload Resume</TabsTrigger>
                  </TabsList>
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
                  <TabsContent value="file">
                    <FileUpload
                      id={`resume-file-${candidate.id}`}
                      label="Upload Resume (PDF, DOC, or DOCX)"
                      onChange={(file) => updateCandidateFile(candidate.id, file)}
                      currentFile={candidateFiles[candidate.id] || null}
                    />
                    <p className="text-sm text-amber-600 mt-2">
                      Note: File text extraction is simplified in this preview. For best results, copy-paste the text.
                    </p>
                  </TabsContent>
                </Tabs>
              </div>
            ))}

            {/* Add Candidate Button - Now at the bottom */}
            <Button type="button" onClick={addCandidate} variant="outline" className="w-full mt-4">
              <UserPlus className="mr-2 h-4 w-4" />
              Add Another Candidate
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
