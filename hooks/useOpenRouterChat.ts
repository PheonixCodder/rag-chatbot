import { useState, useRef } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function useOpenRouterChat(apiUrl: string) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState("");
  const controllerRef = useRef<AbortController | null>(null);

  const sendMessage = async (content: string) => {
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content,
    };
    setMessages((prev) => [...prev, userMessage]);

    setIsLoading(true);
    controllerRef.current = new AbortController();

    try {
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: [...messages, userMessage] }),
        signal: controllerRef.current.signal,
      });

      if (!response.body) {
        throw new Error("No response body from server");
      }

      const reader = response.body.getReader();
      let assistantText = "";
      let assistantMessage: Message = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: "",
      };

      setMessages((prev) => [...prev, assistantMessage]);

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        setMessages((prev) =>
          prev.map((msg) =>
            msg.id === assistantMessage.id
              ? { ...msg, content: assistantText }
              : msg
          )
        );
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const stopResponse = () => {
    controllerRef.current?.abort();
    setIsLoading(false);
  };

  return {
    messages,
    input,
    setInput,
    sendMessage,
    isLoading,
    stopResponse,
  };
}
