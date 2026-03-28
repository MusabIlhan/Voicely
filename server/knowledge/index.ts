import { readFileSync, writeFileSync, existsSync } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const KB_PATH = path.join(__dirname, "base.json");

export interface KnowledgeBase {
  company: {
    name: string;
    industry: string;
    description: string;
    founded: string;
    website: string;
  };
  products: Array<{
    name: string;
    description: string;
    price: string;
    category: string;
    bestSeller: boolean;
    features: string[];
  }>;
  faq: Array<{
    question: string;
    answer: string;
  }>;
  policies: Record<string, string>;
  team: Record<string, string>;
}

let cached: KnowledgeBase | null = null;

/** Load the knowledge base from disk. Caches after first read. */
export function loadKnowledgeBase(): KnowledgeBase {
  if (cached) return cached;
  if (!existsSync(KB_PATH)) {
    throw new Error(`Knowledge base not found at ${KB_PATH}`);
  }
  cached = JSON.parse(readFileSync(KB_PATH, "utf-8")) as KnowledgeBase;
  return cached;
}

/** Write updated knowledge base to disk and clear cache. */
export function saveKnowledgeBase(kb: KnowledgeBase): void {
  writeFileSync(KB_PATH, JSON.stringify(kb, null, 2), "utf-8");
  cached = null;
}

/** Clear the in-memory cache so the next load reads from disk. */
export function clearKnowledgeCache(): void {
  cached = null;
}

/**
 * Format the knowledge base into a text block suitable for
 * injection into a Gemini system prompt.
 */
export function formatKnowledgeForPrompt(): string {
  const kb = loadKnowledgeBase();
  const sections: string[] = [];

  // Company overview
  sections.push(
    `Company: ${kb.company.name}`,
    `Industry: ${kb.company.industry}`,
    `About: ${kb.company.description}`,
  );

  // Products
  const bestSeller = kb.products.find((p) => p.bestSeller);
  const productLines = kb.products.map((p) => {
    const tag = p.bestSeller ? " [BEST SELLER]" : "";
    return `- ${p.name}${tag}: ${p.description} (${p.price})`;
  });
  sections.push("", "Products:", ...productLines);

  if (bestSeller) {
    sections.push("", `Best-selling product: ${bestSeller.name} at ${bestSeller.price}.`);
  }

  // FAQ
  if (kb.faq.length > 0) {
    sections.push("", "Frequently Asked Questions:");
    for (const entry of kb.faq) {
      sections.push(`Q: ${entry.question}`, `A: ${entry.answer}`, "");
    }
  }

  // Policies
  const policyEntries = Object.entries(kb.policies);
  if (policyEntries.length > 0) {
    sections.push("Policies:");
    for (const [key, value] of policyEntries) {
      sections.push(`- ${key}: ${value}`);
    }
  }

  // Contact
  const contactEntries = Object.entries(kb.team);
  if (contactEntries.length > 0) {
    sections.push("", "Contact:");
    for (const [key, value] of contactEntries) {
      sections.push(`- ${key}: ${value}`);
    }
  }

  return sections.join("\n");
}
