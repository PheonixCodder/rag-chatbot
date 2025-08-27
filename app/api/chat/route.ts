import { DataAPIClient } from "@datastax/astra-db-ts";
import { GoogleGenAI } from "@google/genai";

const {
  ASTRA_DB_NAMESPACE,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_APPLICATION_TOKEN,
  OPEN_ROUTER_API_KEY,
} = process.env;

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(ASTRA_DB_API_ENDPOINT!, { namespace: ASTRA_DB_NAMESPACE });


export async function POST(req: Request) {
  try {
    const { messages } = await req.json();
    const latestMessage = messages[messages.length - 1]?.content;

    let docContext = "";

    // Google GenAI Embedding
    const ai = new GoogleGenAI({});
    const embedding = await ai.models.embedContent({
      model: "gemini-embedding-001",
      contents: [latestMessage],
      config: {
        taskType: "SEMANTIC_SIMILARITY",
        outputDimensionality: 3072,
      },
    });

    try {
      const collection = await db.collection(ASTRA_DB_COLLECTION!);
      const cursor = collection.find(null, {
        sort: { $vector: embedding.embeddings![0].values },
        limit: 10,
      });
      const documents = await cursor.toArray();
      docContext = JSON.stringify(documents.map((doc) => doc.text));
    } catch {
      console.log("Error fetching context");
    }

    const systemPrompt = {
      role: "system",
      content: `You are an AI assistant who knows everything about Formula One. Use the context below to answer:
      CONTEXT:
      ${docContext}
      QUESTION: ${latestMessage}`,
    };

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPEN_ROUTER_API_KEY}`,
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-20b:free",
        stream: true,
        messages: [systemPrompt, ...messages],
      }),
    });

    if (!response.body) {
      return new Response("No response body from OpenRouter", { status: 500 });
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const reader = response.body!.getReader();
        const decoder = new TextDecoder();

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            const chunk = decoder.decode(value, { stream: true });
            controller.enqueue(encoder.encode(chunk));
          }
        } catch (err) {
          console.error("Streaming error:", err);
        } finally {
          controller.close();
        }
      },
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    console.error("Error querying AI:", error);
    return new Response("Internal Server Error", { status: 500 });
  }
}
