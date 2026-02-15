import Anthropic from "@anthropic-ai/sdk";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import type { Config } from "./config.js";

export async function summarize(
  feedJson: string,
  config: Config
): Promise<string> {
  const client = new Anthropic();

  const systemPrompt = readFileSync(resolve("skill/prompt.md"), "utf-8");

  const userContext = [
    "## User Interests",
    ...(config.interests.map((i) => `- ${i}`)),
    "",
    "## Priority Accounts",
    ...(config.priorityAccounts.map((a) => `- @${a}`)),
    "",
    "## Feed Data",
    feedJson,
  ].join("\n");

  const response = await client.messages.create({
    model: config.llm.model,
    max_tokens: config.llm.maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userContext }],
  });

  return response.content
    .filter((block): block is Anthropic.TextBlock => block.type === "text")
    .map((block) => block.text)
    .join("\n");
}
