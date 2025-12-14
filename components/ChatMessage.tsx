import { Message } from "@/types/chat";
import { Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isHuman = message.role === "human";

  return (
    <div
      className={`flex gap-3 mb-4 ${
        isHuman ? "justify-end" : "justify-start"
      }`}
    >
      {!isHuman && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center">
          <Bot className="w-5 h-5 text-white" />
        </div>
      )}

      <div
        className={`max-w-[70%] rounded-lg px-4 py-2 ${
          isHuman
            ? "bg-indigo-600 text-white"
            : "bg-gray-100 text-gray-900 dark:bg-gray-800 dark:text-gray-100"
        }`}
      >
        <div className="prose prose-sm max-w-none dark:prose-invert">
          {isHuman ? (
            <p className="m-0">{message.message}</p>
          ) : (
            <ReactMarkdown
              components={{
                p: ({ children }) => <p className="m-0 mb-2 last:mb-0">{children}</p>,
                ul: ({ children }) => <ul className="my-2 ml-4">{children}</ul>,
                ol: ({ children }) => <ol className="my-2 ml-4">{children}</ol>,
                li: ({ children }) => <li className="mb-1">{children}</li>,
                code: ({ inline, children, ...props }: any) =>
                  inline ? (
                    <code className="bg-gray-200 dark:bg-gray-700 rounded px-1 py-0.5" {...props}>
                      {children}
                    </code>
                  ) : (
                    <code className="block bg-gray-200 dark:bg-gray-700 rounded p-2 my-2 overflow-x-auto" {...props}>
                      {children}
                    </code>
                  ),
              }}
            >
              {message.message}
            </ReactMarkdown>
          )}
        </div>

        <div
          className={`text-xs mt-1 ${
            isHuman ? "text-indigo-200" : "text-gray-500 dark:text-gray-400"
          }`}
        >
          {new Date(message.createdAt).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      </div>

      {isHuman && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-700 flex items-center justify-center">
          <User className="w-5 h-5 text-gray-700 dark:text-gray-300" />
        </div>
      )}
    </div>
  );
}