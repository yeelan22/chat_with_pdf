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
  const { isOverFileLimit } = useSubscription();
  const router = useRouter();

  // Only redirect after embeddings are generated
  useEffect(() => {
    if (fileId && status === StatusText.GENERATING) {
      // Wait a bit to show the "generating" status, then redirect
      const timer = setTimeout(() => {
        router.push(`/dashboard/files/${fileId}`);
      }, 1500);

      return () => clearTimeout(timer);
    }
  }, [fileId, status, router]);

  const onDrop = useCallback(
    async (acceptedFiles: File[]) => {
      const file = acceptedFiles[0];
      if (file) {
        if (!isOverFileLimit) {
          try {
            await handleUpload(file);
          } catch (error) {
            toast.error("Failed to upload file. Please try again.");
          }
        } else {
          toast.error(
            "You've reached the maximum number of files allowed for your account. Please upgrade to add more documents."
          );
        }
      }
    },
    [isOverFileLimit, handleUpload]
  );

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

  const isUploading = progress !== null && progress < 100;
  const isProcessing = status !== null && status !== StatusText.UPLOADING;
  const showUploadUI = status !== null;

  const currentIcon = status ? statusIcons[status as StatusText] : null;

  return (
    <div className="flex flex-col gap-4 items-center max-w-7xl mx-auto">
      {/* UPLOAD UI */}
      {showUploadUI && (
        <div className="mt-32 flex flex-col justify-center items-center gap-5">
          {/* Radial Progress - only show during upload */}
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
              {progress}%
            </div>
          )}

          {/* Status Icon - show after upload completes */}
          {isProcessing && currentIcon }

          {/* Status Text */}
          <p className="text-indigo-600 animate-pulse">{status as string}</p>
        </div>
      )}

      {/* DROPZONE - only show when not uploading */}
      {!showUploadUI && (
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