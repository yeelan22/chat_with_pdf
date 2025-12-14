"use client";

import { FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Loader2Icon } from "lucide-react";
// import { useToast } from "./ui/use-toast";
import { askQuestion } from "@/actions/askQuestion";
import ChatMessage from "./ChatMessage";
import { useChatMessages } from "@/hooks/useChatMessages";
import { Message } from "@/types/chat";

interface ChatProps {
  id: string;
}

export default function Chat({ id }: ChatProps) {
  // const { toast } = useToast();
  const [input, setInput] = useState("");
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [isPending, startTransition] = useTransition();
  const bottomOfChatRef = useRef<HTMLDivElement>(null);

  // Get real-time messages from Appwrite
  console.log("Chat component rendering with id:", id);
  const { messages, loading, error } = useChatMessages(id);
  console.log("Current messages:", messages);

  // Combine real messages with optimistic updates
  const displayMessages = [...messages, ...optimisticMessages];

  useEffect(() => {
    bottomOfChatRef.current?.scrollIntoView({
      behavior: "smooth",
    });
  }, [displayMessages]);

  useEffect(() => {
    if (error) {
      // toast({
      //   variant: "destructive",
      //   title: "Connection Error",
      //   description: "Failed to load chat messages",
      // });
      console.log("Failed to load chat messages", error)
    }
  }, [error]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const question = input.trim();
    if (!question) return;

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
          
         
          console.log("Error", "Failed to send message", message);
        } else {
          // Clear optimistic messages - real message will come via subscription
          setOptimisticMessages([]);
        }
      } catch (err) {
        setOptimisticMessages([]);
        console.log("Error", "Failed to send message", err);
        // toast({
        //   variant: "destructive",
        //   title: "Error",
        //   description: "Failed to send message",
        // });
      }
    });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Chat contents */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <Loader2Icon className="animate-spin h-20 w-20 text-indigo-600" />
          </div>
        ) : (
          <div className="p-5">
            {displayMessages.length === 0 && (
              <ChatMessage
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
            <Loader2Icon className="animate-spin text-white" />
          ) : (
            "Ask"
          )}
        </Button>
      </form>
    </div>
  );
}