"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AlertCircle, RefreshCw } from "lucide-react"
import { Button } from "@/components/ui/button"

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error?: Error
  errorInfo?: ErrorInfo
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error("Error caught by ErrorBoundary:", error, errorInfo)
    this.setState({ error, errorInfo })
  }

  handleRefresh = (): void => {
    window.location.reload()
  }

  render(): ReactNode {
    if (this.state.hasError) {
      const errorType = this.state.error?.name || "Error"
      const errorMessage = this.state.error?.message || "An unknown error occurred"
      const isMemoryError = errorMessage.includes("memory") || errorMessage.includes("allocation")

      return (
        <Alert className="mb-6 bg-red-50 border-red-200">
          <AlertCircle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-800">
            <div className="font-medium mb-1">
              {errorType}: {errorMessage}
            </div>
            <div className="text-sm mb-3">
              {isMemoryError
                ? "The application ran out of memory. Try processing fewer candidates at once or using smaller files."
                : "Please try refreshing the page or contact support if the issue persists."}
            </div>
            <Button
              variant="outline"
              size="sm"
              className="bg-white text-red-600 border-red-300 hover:bg-red-50"
              onClick={this.handleRefresh}
            >
              <RefreshCw className="h-3 w-3 mr-2" />
              Refresh Page
            </Button>
          </AlertDescription>
        </Alert>
      )
    }

    return this.props.children
  }
}
