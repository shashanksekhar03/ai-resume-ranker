"use client"

import type React from "react"

import { useState, useRef } from "react"
import { UploadIcon, Loader2 } from "lucide-react"

interface MultiFileUploadProps {
  onFilesSelected: (files: File[]) => void
  isProcessing: boolean
}

export function MultiFileUpload({ onFilesSelected, isProcessing }: MultiFileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(Array.from(e.dataTransfer.files))
    }
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processFiles(Array.from(e.target.files))
    }
  }

  const processFiles = (files: File[]) => {
    // Filter for supported file types
    const supportedFiles = files.filter((file) => {
      const fileType = file.type
      const fileName = file.name.toLowerCase()

      return (
        fileType === "application/pdf" ||
        fileType === "application/msword" ||
        fileType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
        fileName.endsWith(".pdf") ||
        fileName.endsWith(".doc") ||
        fileName.endsWith(".docx")
      )
    })

    if (supportedFiles.length === 0) {
      alert("Please upload PDF, DOC, or DOCX files only")
      return
    }

    onFilesSelected(supportedFiles)

    // Clear the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  return (
    <div
      className={`border-2 border-dashed rounded-md p-8 text-center cursor-pointer transition-colors ${
        isDragging ? "border-primary bg-primary/5" : "border-gray-300 hover:border-primary"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
    >
      {isProcessing ? (
        <>
          <Loader2 className="mx-auto h-8 w-8 text-primary animate-spin mb-2" />
          <p className="text-sm text-gray-500">Processing files...</p>
        </>
      ) : (
        <>
          <UploadIcon className="mx-auto h-8 w-8 text-gray-400 mb-2" />
          <p className="text-sm text-gray-500">
            Drag and drop multiple resumes here, or <span className="text-primary font-medium">click to browse</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">Supports PDF, DOC, and DOCX files</p>
        </>
      )}
      <input
        type="file"
        ref={fileInputRef}
        className="hidden"
        accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        onChange={handleFileChange}
        multiple
        disabled={isProcessing}
      />
    </div>
  )
}
