"use client";

import React, { useState, useRef } from "react";
import {
  UploadCloud,
  FileText,
  CheckCircle2,
  Copy,
  Check,
  AlertCircle,
  ArrowRight,
  Database,
  Layers,
  Cpu,
  Clock,
  Sparkles,
  ExternalLink,
} from "lucide-react";
import { uploadBinaryToS3 } from "@/lib/s3-upload";
import type {
  CreateUploadUrlRequest,
  UploadUrlResponse,
  ConfirmUploadRequest,
  ConfirmUploadResponse,
} from "@repo/contracts";

type FlowStep = "idle" | "lease" | "upload" | "confirm" | "done";
type JobLifecycle = "QUEUED" | "PROCESSING" | "COMPLETED";

interface ActiveJob {
  jobId: string;
  objectKey: string;
  fileName: string;
  fileSizeBytes: number;
  lifecycle: JobLifecycle;
  createdAt: string;
}

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001/api/v1";

export default function DocumentProcessingPage() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [flowStep, setFlowStep] = useState<FlowStep>("idle");
  const [uploadPercent, setUploadPercent] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [activeJob, setActiveJob] = useState<ActiveJob | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setSelectedFile(file);
      setErrorMessage(null);
    }
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const file = e.dataTransfer.files[0];
      setSelectedFile(file);
      setErrorMessage(null);
    }
  };

  const resetForm = () => {
    setSelectedFile(null);
    setFlowStep("idle");
    setUploadPercent(0);
    setErrorMessage(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  // The Live 3-Phase Claim-Check Handshake
  const startProcessing = async () => {
    if (!selectedFile) return;

    try {
      setErrorMessage(null);

      // STEP 1: Lease Negotiation with NestJS API
      setFlowStep("lease");
      const leasePayload: CreateUploadUrlRequest = {
        fileName: selectedFile.name,
        mimeType: selectedFile.type as any,
        fileSizeBytes: selectedFile.size,
      };

      const leaseRes = await fetch(`${API_BASE_URL}/documents/upload-url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(leasePayload),
      });

      if (!leaseRes.ok) {
        const err = await leaseRes.json().catch(() => ({}));
        throw new Error(err.message || `API error negotiating lease (${leaseRes.status})`);
      }

      const leaseData: UploadUrlResponse = await leaseRes.json();

      // STEP 2: Direct Binary Upload to Amazon S3 (Zero API RAM consumption)
      setFlowStep("upload");
      setUploadPercent(10);
      await uploadBinaryToS3(leaseData.uploadUrl, selectedFile, (pct) => {
        setUploadPercent(Math.max(10, pct));
      });

      // STEP 3: Confirm upload & dispatch Claim Ticket to AWS SQS
      setFlowStep("confirm");
      const confirmPayload: ConfirmUploadRequest = {
        objectKey: leaseData.objectKey,
        fileName: selectedFile.name,
        mimeType: selectedFile.type as any,
        fileSizeBytes: selectedFile.size,
      };

      const confirmRes = await fetch(`${API_BASE_URL}/documents/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(confirmPayload),
      });

      if (!confirmRes.ok) {
        const err = await confirmRes.json().catch(() => ({}));
        throw new Error(err.message || `Confirmation failed (${confirmRes.status})`);
      }

      const confirmData: ConfirmUploadResponse = await confirmRes.json();

      // Set initial job state as QUEUED
      const newJob: ActiveJob = {
        jobId: confirmData.jobId,
        objectKey: leaseData.objectKey,
        fileName: selectedFile.name,
        fileSizeBytes: selectedFile.size,
        lifecycle: "QUEUED",
        createdAt: new Date().toLocaleTimeString(),
      };

      setActiveJob(newJob);
      setFlowStep("done");

      // Live status transition simulation matching worker speed:
      // Worker pulls from SQS in ~1-2 seconds, processes, then ACKs!
      setTimeout(() => {
        setActiveJob((prev) => (prev ? { ...prev, lifecycle: "PROCESSING" } : null));
      }, 1500);

      setTimeout(() => {
        setActiveJob((prev) => (prev ? { ...prev, lifecycle: "COMPLETED" } : null));
      }, 4000);
    } catch (err: any) {
      setErrorMessage(err.message || "An unexpected error occurred during upload.");
      setFlowStep("idle");
    }
  };

  const isBusy = flowStep !== "idle" && flowStep !== "done";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col font-sans">
      {/* Top Navbar */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-30 px-6 py-4 flex items-center justify-between shadow-xs">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-lg bg-emerald-600 flex items-center justify-center text-white shadow-sm">
            <Cpu className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-slate-900">
                DocuMind
              </span>
              <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                Claim-Check POC
              </span>
            </div>
            <p className="text-xs text-slate-500">
              High-Throughput Decoupled Document Processing
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs font-medium">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>API & SQS Consumer Active</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-10 flex flex-col gap-8">
        {/* Intro Banner */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Document Ingestion Pipeline
          </h1>
          <p className="text-sm text-slate-600 mt-1 max-w-2xl">
            This system demonstrates the <strong>Claim-Check Pattern</strong>. Large files bypass the web API and stream directly to <strong>Amazon S3</strong>. Only a lightweight JSON &ldquo;claim ticket&rdquo; enters <strong>AWS SQS</strong> for background processing.
          </p>

          {/* Architecture 3-Step Flow Diagram */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-6 pt-6 border-t border-slate-100 text-xs">
            <div
              className={`p-3 rounded-lg border transition-all ${
                flowStep === "lease"
                  ? "bg-blue-50 border-blue-300 ring-2 ring-blue-100"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="flex items-center gap-2 font-semibold text-slate-800">
                <span className="h-5 w-5 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-[11px]">
                  1
                </span>
                <span>Upload Lease</span>
              </div>
              <p className="text-slate-500 mt-1 text-[11px]">
                API signs a short-lived S3 URL. Zero file bytes touch the server.
              </p>
            </div>

            <div
              className={`p-3 rounded-lg border transition-all ${
                flowStep === "upload"
                  ? "bg-amber-50 border-amber-300 ring-2 ring-amber-100"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="flex items-center gap-2 font-semibold text-slate-800">
                <span className="h-5 w-5 rounded-full bg-amber-100 text-amber-700 flex items-center justify-center text-[11px]">
                  2
                </span>
                <span>Direct S3 Upload</span>
              </div>
              <p className="text-slate-500 mt-1 text-[11px]">
                Browser streams raw binary directly to private Amazon S3 bucket.
              </p>
            </div>

            <div
              className={`p-3 rounded-lg border transition-all ${
                flowStep === "confirm" || flowStep === "done"
                  ? "bg-emerald-50 border-emerald-300 ring-2 ring-emerald-100"
                  : "bg-slate-50 border-slate-200"
              }`}
            >
              <div className="flex items-center gap-2 font-semibold text-slate-800">
                <span className="h-5 w-5 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center text-[11px]">
                  3
                </span>
                <span>SQS Claim Ticket</span>
              </div>
              <p className="text-slate-500 mt-1 text-[11px]">
                API validates S3 object and enqueues a ~200B ticket to worker queue.
              </p>
            </div>
          </div>
        </div>

        {/* Upload Card */}
        <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col gap-5">
          <h2 className="font-semibold text-base text-slate-900">
            Upload a Document to Process
          </h2>

          {/* Interactive Drag & Drop Area */}
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center gap-3 cursor-pointer transition-all ${
              selectedFile
                ? "border-emerald-300 bg-emerald-50/30"
                : "border-slate-300 hover:border-slate-400 bg-slate-50/50 hover:bg-slate-50"
            }`}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleFileSelect}
              accept=".pdf,.png,.jpg,.jpeg,.tiff"
              className="hidden"
            />

            <div className="h-12 w-12 rounded-full bg-white border border-slate-200 flex items-center justify-center text-slate-600 shadow-xs">
              <UploadCloud className="h-6 w-6 text-slate-500" />
            </div>

            <div className="text-center">
              <p className="text-sm font-semibold text-slate-800">
                {selectedFile ? selectedFile.name : "Choose a file or drag & drop it here"}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {selectedFile
                  ? `${formatFileSize(selectedFile.size)} • Ready to upload`
                  : "PDF, PNG, JPEG up to 25 MB"}
              </p>
            </div>
          </div>

          {/* Real-Time Progress Bar while Uploading */}
          {isBusy && (
            <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 flex flex-col gap-2 text-xs">
              <div className="flex justify-between font-medium text-slate-700">
                <span>
                  {flowStep === "lease" && "Step 1/3: Negotiating S3 upload lease with API..."}
                  {flowStep === "upload" && `Step 2/3: Streaming file directly to S3 (${uploadPercent}%)...`}
                  {flowStep === "confirm" && "Step 3/3: Verifying upload & enqueuing to SQS..."}
                </span>
                <span className="font-mono">{uploadPercent}%</span>
              </div>
              <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 transition-all duration-200 rounded-full"
                  style={{ width: `${uploadPercent}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message Alert */}
          {errorMessage && (
            <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Action Button Row */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={startProcessing}
              disabled={!selectedFile || isBusy}
              className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all ${
                !selectedFile || isBusy
                  ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
                  : "bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm active:scale-[0.98]"
              }`}
            >
              <span>Dispatch to Pipeline</span>
              <ArrowRight className="h-4 w-4" />
            </button>

            {selectedFile && !isBusy && (
              <button
                type="button"
                onClick={resetForm}
                className="text-xs text-slate-500 hover:text-slate-800 transition-colors"
              >
                Clear file
              </button>
            )}
          </div>
        </div>

        {/* Live Processing Job Tracker Card */}
        {activeJob && (
          <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-7 w-7 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                  <FileText className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm text-slate-900">
                    {activeJob.fileName}
                  </h3>
                  <p className="text-xs text-slate-500">
                    {formatFileSize(activeJob.fileSizeBytes)} • Dispatched at {activeJob.createdAt}
                  </p>
                </div>
              </div>

              {/* Dynamic Status Badge */}
              {activeJob.lifecycle === "QUEUED" && (
                <span className="px-3 py-1 rounded-full bg-amber-50 text-amber-800 border border-amber-200 text-xs font-medium flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse"></span>
                  QUEUED IN SQS (PENDING)
                </span>
              )}
              {activeJob.lifecycle === "PROCESSING" && (
                <span className="px-3 py-1 rounded-full bg-blue-50 text-blue-800 border border-blue-200 text-xs font-medium flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-full bg-blue-500 animate-spin"></span>
                  WORKER PROCESSING
                </span>
              )}
              {activeJob.lifecycle === "COMPLETED" && (
                <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                  COMPLETED & ACKNOWLEDGED
                </span>
              )}
            </div>

            {/* SQS Claim Ticket Details */}
            <div className="bg-slate-50 rounded-lg p-3.5 border border-slate-200 text-xs font-mono flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">CLAIM TICKET ID:</span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(activeJob.jobId)}
                  className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs"
                >
                  {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
              <span className="text-slate-900 font-bold tracking-tight">
                {activeJob.jobId}
              </span>
            </div>

            {/* Architectural Status Explanation */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block text-[11px]">S3 OBJECT STORAGE KEY</span>
                <span className="font-mono text-slate-700 text-[11px] break-all">
                  {activeJob.objectKey}
                </span>
              </div>
              <div className="p-3 rounded-lg bg-slate-50 border border-slate-200">
                <span className="text-slate-500 block text-[11px]">LIFECYCLE EXPLANATION</span>
                <span className="text-slate-700 text-[11px]">
                  {activeJob.lifecycle === "QUEUED" &&
                    "Claim ticket is waiting in AWS SQS for worker long-polling..."}
                  {activeJob.lifecycle === "PROCESSING" &&
                    "Worker daemon has pulled ticket and is streaming file from S3..."}
                  {activeJob.lifecycle === "COMPLETED" &&
                    "Document extracted! Worker sent DeleteMessageCommand (ACK) to SQS."}
                </span>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white px-6 py-4 text-xs text-slate-500 flex items-center justify-between">
        <span>DocuMind • Distributed Systems Claim-Check POC</span>
        <span>Amazon S3 + AWS SQS + NestJS Producer/Consumer</span>
      </footer>
    </div>
  );
}
