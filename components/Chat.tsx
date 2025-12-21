"use client";

import { FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "sonner";
import { Loader2Icon } from "lucide-react";
import { askQuestion } from "@/actions/askQuestion";
import ChatMessage from "./ChatMessage";
import { useChatMessages } from "@/hooks/useChatMessages";
import { Message } from "@/types/chat";
import { useUser } from "@clerk/nextjs";

interface ChatProps {
  id: string;
}

export default function Chat({ id }: ChatProps) {
  const { user } = useUser();
  const [input, setInput] = useState("");
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [isPending, startTransition] = useTransition();
  const bottomOfChatRef = useRef<HTMLDivElement>(null);

  // Get real-time messages from Appwrite
  const { messages, loading, error } = useChatMessages(id);

  // Combine real messages with optimistic updates
  const displayMessages = [...messages, ...optimisticMessages];

  useEffect(() => {
    bottomOfChatRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [displayMessages]);

  useEffect(() => {
    if(!displayMessages) return;

    //get second las message to check id AI is thinking
    const lastMessage = displayMessages[displayMessages.length -1];

    if (lastMessage?.role === "ai" && lastMessage?.message === "Thinking...") {
      //return as this is a dummy placeholder message
      return;
    }
    
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const question = input;

    setInput("");

    // Optimistic UI update
    const userMessage: Message = {
      role: "human",
      message: question,
      createdAt: new Date(),
    };

    const thinkingMessage: Message = {
      role: "ai",
      message: "Thinking...",
      createdAt: new Date(),
    };

    setOptimisticMessages([userMessage, thinkingMessage]);

    startTransition(async () => {
      try {
        const { success, message } = await askQuestion(id, question);

        if (!success) {
          // Clear optimistic messages and show error
          setOptimisticMessages([]);
          toast.error(message);
          console.log("Error", "Failed to send message", message);
        } else {
          // Clear optimistic messages - real message will come via subscription
          setOptimisticMessages([]);
        }
      } catch (err) {
        setOptimisticMessages([]);
        console.log("Error", "Failed to send message", err);
      }
    });
  };

  return (
    <div className="flex flex-col h-full overflow-scroll">
      {/* Chat contents */}
      <div className="flex-1 w-full">
        {/* Chat messages */}
        {loading ? (
          <div className="flex items-center justify-center">
            <Loader2Icon className="animate-spin h-20 w-20 text-indigo-600 mt-20" />
          </div>
        ) : (
          <div className="p-5">
            {displayMessages.length === 0 && (
              <ChatMessage
                key={"placeholder"}
                message={{
                  role: "ai",
                  message: "Ask me anything about the document!",
                  createdAt: new Date(),
                }}
              />
            )}

            {displayMessages.map((message, index) => (
              <ChatMessage key={message.id || `msg-${index}`} message={message} />
            ))}

            <div ref={bottomOfChatRef} />
          </div>
        )}
      </div>

      {/* Input form */}
      <form
        onSubmit={handleSubmit}
        className="flex sticky bottom-0 space-x-2 p-5 bg-indigo-600/75 backdrop-blur-sm"
      >
        <Input
          placeholder="Ask a Question..."
          value={input}
          onChange={(e) => setInput(e.target.value)}
          disabled={isPending}
          className="flex-1"
        />

        <Button type="submit" disabled={!input || isPending}>
          {isPending ? (
            <Loader2Icon className="animate-spin text-indigo-600" />
          ) : (
            "Ask"
          )}
        </Button>
      </form>
    </div>
  );
}