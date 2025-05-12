"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Loader2, InfoIcon } from "lucide-react"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import type { WeightCategory, WeightConfig } from "@/types/resume-ranker"
import { suggestWeights } from "@/actions/suggest-weights"

interface WeightConfiguratorProps {
  jobDescription: string
  onWeightsChange: (weights: WeightConfig) => void
  isGeneratingWeights: boolean
  setIsGeneratingWeights: (value: boolean) => void
}

export function WeightConfigurator({
  jobDescription,
  onWeightsChange,
  isGeneratingWeights,
  setIsGeneratingWeights,
}: WeightConfiguratorProps) {
  const [useCustomWeights, setUseCustomWeights] = useState(false)
  const [categories, setCategories] = useState<WeightCategory[]>([
    {
      id: "technical_skills",
      name: "Technical Skills",
      description: "Programming languages, tools, and technologies",
      weight: 5,
      defaultWeight: 5,
    },
    {
      id: "experience",
      name: "Experience",
      description: "Years of relevant work experience",
      weight: 5,
      defaultWeight: 5,
    },
    {
      id: "education",
      name: "Education",
      description: "Degrees, certifications, and academic achievements",
      weight: 3,
      defaultWeight: 3,
    },
    {
      id: "location",
      name: "Location",
      description: "Proximity to job location or willingness to relocate",
      weight: 2,
      defaultWeight: 2,
    },
    {
      id: "soft_skills",
      name: "Soft Skills",
      description: "Communication, teamwork, and interpersonal abilities",
      weight: 3,
      defaultWeight: 3,
    },
    {
      id: "industry_knowledge",
      name: "Industry Knowledge",
      description: "Familiarity with the specific industry and domain",
      weight: 4,
      defaultWeight: 4,
    },
    {
      id: "certifications",
      name: "Certifications",
      description: "Professional certifications and licenses",
      weight: 2,
      defaultWeight: 2,
    },
  ])

  // Update parent component when weights change
  useEffect(() => {
    onWeightsChange({
      categories,
      useCustomWeights,
    })
  }, [categories, useCustomWeights, onWeightsChange])

  const updateCategoryWeight = (id: string, weight: number) => {
    setCategories(categories.map((category) => (category.id === id ? { ...category, weight } : category)))
  }

  const resetToDefaults = () => {
    setCategories(
      categories.map((category) => ({
        ...category,
        weight: category.defaultWeight,
        aiSuggested: false,
      })),
    )
  }

  const generateAiWeights = async () => {
    if (!jobDescription.trim()) {
      alert("Please enter a job description first to generate AI-suggested weights")
      return
    }

    setIsGeneratingWeights(true)
    try {
      const suggestedWeights = await suggestWeights(jobDescription)

      // Update categories with AI suggestions
      setCategories(
        categories.map((category) => {
          const suggestion = suggestedWeights.find((s) => s.id === category.id)
          return suggestion
            ? {
                ...category,
                weight: suggestion.weight,
                aiSuggested: true,
              }
            : category
        }),
      )
    } catch (error) {
      console.error("Error generating AI weights:", error)
      alert("Failed to generate AI-suggested weights. Please try again.")
    } finally {
      setIsGeneratingWeights(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex justify-between items-center">
          <CardTitle>Ranking Weights</CardTitle>
          <div className="flex items-center space-x-2">
            <Label htmlFor="use-custom-weights" className="text-sm cursor-pointer">
              Customize Weights
            </Label>
            <Switch id="use-custom-weights" checked={useCustomWeights} onCheckedChange={setUseCustomWeights} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {!useCustomWeights ? (
          <div className="text-center py-4">
            <p className="text-sm text-gray-500 mb-4">
              AI will automatically assign appropriate weights to each category based on the job description.
            </p>
            <Button variant="outline" onClick={() => setUseCustomWeights(true)} className="mr-2">
              Customize Weights
            </Button>
            <Button onClick={generateAiWeights} disabled={isGeneratingWeights || !jobDescription.trim()}>
              {isGeneratingWeights ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Generating...
                </>
              ) : (
                "Generate AI Weights"
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
            <div className="flex justify-end space-x-2">
              <Button variant="outline" size="sm" onClick={resetToDefaults}>
                Reset to Defaults
              </Button>
              <Button size="sm" onClick={generateAiWeights} disabled={isGeneratingWeights || !jobDescription.trim()}>
                {isGeneratingWeights ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Generate AI Weights"
                )}
              </Button>
            </div>

            <div className="space-y-4">
              {categories.map((category) => (
                <div key={category.id} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <span className="font-medium">{category.name}</span>
                      {category.aiSuggested && (
                        <Badge variant="outline" className="ml-2 bg-blue-50 text-blue-700 border-blue-200">
                          AI Suggested
                        </Badge>
                      )}
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <InfoIcon className="h-4 w-4 text-gray-400 ml-1 cursor-help" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">{category.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <span className="text-sm font-medium">{category.weight}/10</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs">1</span>
                    <Slider
                      value={[category.weight]}
                      min={1}
                      max={10}
                      step={1}
                      onValueChange={(value) => updateCategoryWeight(category.id, value[0])}
                      className="flex-1"
                    />
                    <span className="text-xs">10</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
