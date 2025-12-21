"use client";

import type { JSX } from "react";
import { useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import {
  CheckCircleIcon,
  CircleArrowDown,
  HammerIcon,
  RocketIcon,
  SaveIcon,
} from "lucide-react";
import useUpload, { StatusText } from "@/hooks/useUpload";
import useSubscription from "@/hooks/useSubscription";
import { toast } from "sonner";


const FileUploader = () => {
  const { progress, status, handleUpload, fileId } = useUpload();
  const {isOverFileLimit } = useSubscription();
  const router = useRouter();
  
  useEffect(() => {
    if (fileId) {
      router.push(`/dashboard/files/${fileId}`);
    }
  }, [fileId, router]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    if (file) {
      if(!isOverFileLimit) {
        await handleUpload(file);
      } else {
        toast.error("You've reached the maximum number of files allowed for your account, Please upgrade to add more documents")
      }
    }
  }, []);

  const {
    getRootProps,
    getInputProps,
    isDragActive,
    isDragAccept,
    isFocused,
  } = useDropzone({
    onDrop,
    maxFiles: 1,
    accept: { "application/pdf": [".pdf"] },
  });

  const statusIcons: Record<StatusText, JSX.Element> = {
    [StatusText.UPLOADING]: (
      <RocketIcon className="h-20 w-20 text-indigo-600" />
    ),
    [StatusText.UPLOADED]: (
      <CheckCircleIcon className="h-20 w-20 text-indigo-600" />
    ),
    [StatusText.SAVING]: <SaveIcon className="h-20 w-20 text-indigo-600" />,
    [StatusText.GENERATING]: (
      <HammerIcon className="h-20 w-20 text-indigo-600 animate-bounce" />
    ),
  };

  // ------------------------------
  // Improved progress logic
  // ------------------------------
  const isUploading =
    progress !== null && progress > 0 && progress < 100 && status === StatusText.UPLOADING;

  const isProcessing =
    status === StatusText.UPLOADED || status === StatusText.SAVING;

  // ------------------------------
  // Auto-reset after completion
  // ------------------------------
  useEffect(() => {
    if (status === StatusText.SAVING) {
      // After saving metadata, wait 1 second then reset UI
      const timer = setTimeout(() => {
        window.location.reload(); // or reset state in your hook
      }, 1000);

      return () => clearTimeout(timer);
    }
  }, [status]);

  return (
    <div className="flex flex-col gap-4 items-center max-w-7xl mx-auto">

      {/* ---------------------- UPLOAD UI ---------------------- */}
      {(isUploading || isProcessing) && (
        <div className="mt-32 flex flex-col justify-center items-center gap-5">

          {/* Radial Progress */}
          {isUploading && (
            <div
              className="radial-progress bg-indigo-300 text-white border-indigo-600 border-4"
              role="progressbar"
              style={{
                // @ts-ignore
                "--value": progress,
                "--size": "12rem",
                "--thickness": "1.3rem",
              }}
            >
              {progress} %
            </div>
          )}

          {/* Status Icon */}
          {status && statusIcons[status]}

          {/* Status Text */}
          <p className="text-indigo-600 animate-pulse">{status}</p>
        </div>
      )}

      {/* ---------------------- DROPZONE ---------------------- */}
      {!isUploading && !isProcessing && (
        <div
          {...getRootProps()}
          className={`p-10 border-2 border-dashed mt-10 w-[90%] border-indigo-600 text-indigo-600 rounded-lg h-96 flex items-center justify-center ${
            isFocused || isDragAccept ? "bg-indigo-300" : "bg-indigo-100"
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center justify-center">
            {isDragActive ? (
              <>
                <RocketIcon className="h-20 w-20 animate-ping" />
                <p>Drop the file here...</p>
              </>
            ) : (
              <>
                <CircleArrowDown className="h-20 w-20 animate-bounce" />
                <p>Drag & drop a PDF file, or click to select</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FileUploader;
