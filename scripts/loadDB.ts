import { DataAPIClient, Db } from "@datastax/astra-db-ts";
import { PuppeteerWebBaseLoader } from "@langchain/community/document_loaders/web/puppeteer";
import OpenAI from "openai";
import "dotenv/config";
import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";
import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({});

type SimilarityMetric = "dot_product" | "cosine" | "euclidean";

const {
  ASTRA_DB_APPLICATION_TOKEN,
  ASTRA_DB_API_ENDPOINT,
  ASTRA_DB_COLLECTION,
  ASTRA_DB_NAMESPACE,
  OPEN_ROUTER_API_KEY,
} = process.env;

const openai = new OpenAI({
  baseURL: "https://openrouter.ai/api/v1",
  apiKey: OPEN_ROUTER_API_KEY,
});

const f1Data = [
  "https://en.wikipedia.org/wiki/Formula_One",
  "https://www.formula1.com/en/latest/all",
  "https://en.wikipedia.org/wiki/2023_Formula_One_World_Championship",
  "https://en.wikipedia.org/wiki/2022_Formula_One_World_Championship",
  "https://en.wikipedia.org/wiki/2024_Formula_One_World_Championship",
];

const client = new DataAPIClient(ASTRA_DB_APPLICATION_TOKEN);
const db = client.db(ASTRA_DB_API_ENDPOINT!, { namespace: ASTRA_DB_NAMESPACE });

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 512,
  chunkOverlap: 100,
});

const createCollection = async (
  similarityMetric: SimilarityMetric = "dot_product"
) => {
  const res = await db.createCollection(ASTRA_DB_COLLECTION!, {
    vector: {
      dimension: 3072, // get this from docs for open AI embedding model
      metric: similarityMetric,
    },
  });

  console.log(res);
};

const loadSampleData = async () => {
  const collection = await db.collection(ASTRA_DB_COLLECTION!);

  for await (const url of f1Data) {
    const content = await scrapePage(url);
    const chunks = await splitter.splitText(content);

    for await (const chunk of chunks) {
      const response = await ai.models.embedContent({
        model: "gemini-embedding-001",
        contents: [chunk], // pass as array
        config: {
          taskType: "SEMANTIC_SIMILARITY",
          outputDimensionality: 3072, // optional; default is 3072
        },
      });

      // For a single chunk request, response.embeddings[0].values holds the vector
      const vector = response.embeddings![0].values;

      await collection.insertOne({
        $vector: vector,
        text: chunk,
      });
    }
  }
};

const scrapePage = async (url: string) => {
  // use Puppeteer
  const loader = new PuppeteerWebBaseLoader(url, {
    launchOptions: {
      headless: true,
    },
    gotoOptions: {
      waitUntil: "domcontentloaded",
    },
    evaluate: async (page, browser) => {
      const result = await page.evaluate(() => document.body.innerHTML);
      await browser.close();
      return result;
    },
  });
  return (await loader.scrape())?.replace(/<[^>]*>?/gm, ""); // only care about text - stripe out html elements
};

createCollection().then(() => loadSampleData());
