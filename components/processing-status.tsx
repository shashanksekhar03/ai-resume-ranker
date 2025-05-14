import { Alert, AlertDescription } from "@/components/ui/alert"
import { Progress } from "@/components/ui/progress"
import { Loader2 } from "lucide-react"

interface ProcessingStatusProps {
  message: string
  isProcessing: boolean
}

export function ProcessingStatus({ message, isProcessing }: ProcessingStatusProps) {
  // Extract batch information if available
  const batchMatch = message.match(/Processing batch (\d+)\/(\d+)/)
  const hasBatchInfo = batchMatch && batchMatch.length === 3

  const currentBatch = hasBatchInfo ? Number.parseInt(batchMatch[1]) : 0
  const totalBatches = hasBatchInfo ? Number.parseInt(batchMatch[2]) : 0
  const progress = hasBatchInfo ? (currentBatch / totalBatches) * 100 : null

  if (!isProcessing || !message) return null

  return (
    <Alert className="mb-6 bg-blue-50 border-blue-200">
      <div className="flex items-center">
        <Loader2 className="h-4 w-4 text-blue-600 animate-spin mr-2" />
        <AlertDescription className="text-blue-800 flex-grow">{message}</AlertDescription>
      </div>

      {hasBatchInfo && progress !== null && (
        <div className="mt-2">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between mt-1 text-xs text-blue-600">
            <span>
              Batch {currentBatch} of {totalBatches}
            </span>
            <span>{Math.round(progress)}% complete</span>
          </div>
        </div>
      )}
    </Alert>
  )
}
