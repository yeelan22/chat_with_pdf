"use client";

import { useUser } from "@clerk/nextjs";
import Image from "next/image";
import { BotIcon, Loader2Icon } from "lucide-react";
import Markdown from "react-markdown";
import { Message } from "@/types/chat";

function ChatMessage({ message }: { message: Message }) {
  const isHuman = message.role === "human";
  const { user } = useUser();

  return (
    <div className={`flex gap-3 mb-6 ${isHuman ? "flex-row-reverse" : "flex-row"}`}>
      {/* Avatar */}
      <div className="flex-shrink-0">
        <div className="w-10 h-10 rounded-full overflow-hidden">
          {isHuman ? (
            user?.imageUrl ? (
              <Image
                src={user.imageUrl}
                alt="Profile Picture"
                width={40}
                height={40}
                className="rounded-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-indigo-600 flex items-center justify-center text-white font-semibold">
                {user?.firstName?.[0] || "U"}
              </div>
            )
          ) : (
            <div className="w-full h-full bg-indigo-600 flex items-center justify-center">
              <BotIcon className="text-white h-6 w-6" />
            </div>
          )}
        </div>
      </div>

      {/* Message Bubble */}
      <div
        className={`flex-1 max-w-[80%] rounded-2xl px-4 py-3 ${
          isHuman
            ? "bg-indigo-600 text-white rounded-tr-sm"
            : "bg-gray-100 text-gray-900 rounded-tl-sm"
        }`}
      >
        {message.message === "Thinking..." ? (
          <div className="flex items-center gap-2 py-1">
            <Loader2Icon className={`animate-spin h-5 w-5 ${isHuman ? "text-white" : "text-indigo-600"}`} />
            <span className={`text-sm ${isHuman ? "text-white" : "text-gray-600"}`}>
              Thinking...
            </span>
          </div>
        ) : (
          <div className={`prose prose-sm max-w-none ${isHuman ? "prose-invert" : ""}`}>
            <Markdown
              components={{
                // Style links
                a: ({ node, ...props }) => (
                  <a
                    {...props}
                    className={`underline ${isHuman ? "text-white hover:text-indigo-200" : "text-indigo-600 hover:text-indigo-800"}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  />
                ),
                // Style code blocks
                code: ({ node, inline, ...props }: any) =>
                  inline ? (
                    <code
                      {...props}
                      className={`px-1.5 py-0.5 rounded ${
                        isHuman ? "bg-indigo-700 text-white" : "bg-gray-200 text-gray-900"
                      }`}
                    />
                  ) : (
                    <code
                      {...props}
                      className={`block p-3 rounded-lg ${
                        isHuman ? "bg-indigo-700 text-white" : "bg-gray-200 text-gray-900"
                      }`}
                    />
                  ),
                // Style paragraphs
                p: ({ node, ...props }) => (
                  <p {...props} className="mb-2 last:mb-0" />
                ),
                // Style lists
                ul: ({ node, ...props }) => (
                  <ul {...props} className="list-disc list-inside mb-2 space-y-1" />
                ),
                ol: ({ node, ...props }) => (
                  <ol {...props} className="list-decimal list-inside mb-2 space-y-1" />
                ),
              }}
            >
              {message.message}
            </Markdown>
          </div>
        )}
      </div>
    </div>
  );
}

export default ChatMessage;