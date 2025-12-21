"use client";

import { FormEvent, useEffect, useRef, useState, useTransition } from "react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { toast } from "sonner";
import { Loader2Icon, SendIcon, BotIcon } from "lucide-react";
import { askQuestion } from "@/actions/askQuestion";
import ChatMessage from "./ChatMessage";
import { useChatMessages } from "@/hooks/useChatMessages";
import { Message } from "@/types/chat";
import { useUser } from "@clerk/nextjs";

import useSubscription from "@/hooks/useSubscription";

interface ChatProps {
  id: string;
}

export default function Chat({ id }: ChatProps) {
  const { user } = useUser();
  const { hasActiveMembership } = useSubscription();
  const [input, setInput] = useState("");
  const [optimisticMessages, setOptimisticMessages] = useState<Message[]>([]);
  const [isPending, startTransition] = useTransition();
  const bottomOfChatRef = useRef<HTMLDivElement>(null);
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Get real-time messages from Appwrite
  const { messages, loading, error } = useChatMessages(id);

  // Combine real messages with optimistic updates, avoiding duplicates
  const displayMessages = [...messages];
  
  // Only add optimistic messages if they're not already in the real messages
  optimisticMessages.forEach((optMsg) => {
    const isDuplicate = messages.some(
      (realMsg) =>
        realMsg.message === optMsg.message &&
        realMsg.role === optMsg.role &&
        Math.abs(new Date(realMsg.createdAt).getTime() - new Date(optMsg.createdAt).getTime()) < 5000
    );
    
    if (!isDuplicate) {
      displayMessages.push(optMsg);
    }
  });

  useEffect(() => {
    if (shouldAutoScroll) {
      bottomOfChatRef.current?.scrollIntoView({
        behavior: "smooth",
      });
    }
  }, [displayMessages, shouldAutoScroll]);

  // Detect if user is scrolling up manually
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const element = e.currentTarget;
    const isAtBottom = Math.abs(
      element.scrollHeight - element.scrollTop - element.clientHeight
    ) < 50; // 50px threshold
    
    setShouldAutoScroll(isAtBottom);
  };

  useEffect(() => {
    if (!displayMessages) return;

    // Get last message to check if AI is thinking
    const lastMessage = displayMessages[displayMessages.length - 1];

    if (lastMessage?.role === "ai" && lastMessage?.message === "Thinking...") {
      // Return as this is a dummy placeholder message
      return;
    }
  });

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    const question = input.trim();
    
    if (!question) return;

    console.log("🔵 [Chat] Submitting question:", question);
    console.log("🔵 [Chat] Current messages count:", messages.length);
    console.log("🔵 [Chat] Has active membership:", hasActiveMembership);

    // Count human messages only
    const humanMessageCount = messages.filter(m => m.role === "human").length;
    console.log("🔵 [Chat] Human messages count:", humanMessageCount);

    // Client-side limit check (server will double-check)
    if (!hasActiveMembership && humanMessageCount >= 2) {
      console.log("🚫 [Chat] Client-side limit check failed");
      toast.error("You've reached the free limit of 2 questions. Upgrade to PRO to continue!");
      return;
    }

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

    // Force auto-scroll when user sends a message
    setShouldAutoScroll(true);

    startTransition(async () => {
      try {
        console.log("🔵 [Chat] Calling askQuestion server action...");
        const { success, message } = await askQuestion(id, question);

        console.log("📡 [Chat] Server response - success:", success, "message:", message);

        if (!success) {
          // Clear optimistic messages and show error
          setOptimisticMessages([]);
          toast.error(message || "Failed to send message");
          console.error("❌ [Chat] Server returned error:", message);
        } else {
          console.log("✅ [Chat] Message sent successfully");
          // Wait a bit for the real message to be fetched, then clear optimistic
          setTimeout(() => {
            setOptimisticMessages([]);
          }, 3000);
        }
      } catch (err: any) {
        setOptimisticMessages([]);
        console.error("❌ [Chat] Exception in handleSubmit:", err);
        toast.error("An error occurred. Please try again.");
      }
    });
  };

  return (
    <div className="flex flex-col h-full bg-white">
      {/* Chat Header */}
      <div className="border-b border-gray-200 px-6 py-4 bg-white">
        <h2 className="text-lg font-semibold text-gray-900">Chat with your document</h2>
        <p className="text-sm text-gray-500">Ask questions and get instant answers</p>
      </div>

      {/* Chat Messages Container */}
      <div className="flex-1 overflow-y-auto" onScroll={handleScroll}>
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Loader2Icon className="animate-spin h-12 w-12 text-indigo-600 mx-auto mb-4" />
              <p className="text-gray-500">Loading conversation...</p>
            </div>
          </div>
        ) : (
          <div className="px-6 py-8 space-y-6 max-w-4xl mx-auto w-full">
            {displayMessages.length === 0 && (
              <div className="text-center py-12">
                <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-indigo-100 mb-4">
                  <BotIcon className="h-8 w-8 text-indigo-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Start a conversation
                </h3>
                <p className="text-gray-600 max-w-md mx-auto">
                  Ask me anything about the document! I'm here to help you understand the content.
                </p>
              </div>
            )}

            {displayMessages.map((message, index) => (
              <ChatMessage key={message.id || `msg-${index}`} message={message} />
            ))}

            <div ref={bottomOfChatRef} />
          </div>
        )}
      </div>

      {/* Input Form */}
      <div className="border-t border-gray-200 bg-white">
        <form
          onSubmit={handleSubmit}
          className="px-6 py-4 max-w-4xl mx-auto w-full"
        >
          <div className="flex gap-3 items-end">
            <div className="flex-1">
              <Input
                placeholder="Ask a question about your document..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={isPending}
                className="w-full rounded-xl border-gray-300 focus:border-indigo-500 focus:ring-indigo-500 px-4 py-3 text-base"
              />
            </div>

            <Button
              type="submit"
              disabled={!input.trim() || isPending}
              className="bg-indigo-600 hover:bg-indigo-700 rounded-xl px-6 py-3 h-auto"
            >
              {isPending ? (
                <Loader2Icon className="animate-spin h-5 w-5" />
              ) : (
                <>
                  <SendIcon className="h-5 w-5 mr-2" />
                  Send
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}