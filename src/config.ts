import { readFileSync, existsSync } from "node:fs";
import YAML from "yaml";
import { z } from "zod";

const ConfigSchema = z.object({
  scrape: z
    .object({
      scrollCount: z.number().default(10),
      scrollDelayMin: z.number().default(1.5),
      scrollDelayMax: z.number().default(3.5),
      headless: z.boolean().default(true),
      scrapeTrends: z.boolean().default(true),
      timeout: z.number().default(60),
    })
    .default({}),

  interests: z.array(z.string()).default([]),
  priorityAccounts: z.array(z.string()).default([]),

  filters: z
    .object({
      blockKeywords: z.array(z.string()).default([]),
      blockAccounts: z.array(z.string()).default([]),
      languages: z.array(z.string()).default(["en"]),
      minLikes: z.number().default(0),
      excludeRetweets: z.boolean().default(true),
      maxAgeHours: z.number().default(24),
    })
    .default({}),
});

export type Config = z.infer<typeof ConfigSchema>;

function resolveConfigPath(path: string): string {
  if (existsSync(path)) return path;

  let alt: string | null = null;
  if (path.endsWith(".yaml")) alt = path.replace(/\.yaml$/, ".yml");
  else if (path.endsWith(".yml")) alt = path.replace(/\.yml$/, ".yaml");

  return alt && existsSync(alt) ? alt : path;
}

export function loadConfig(path: string): Config {
  const resolved = resolveConfigPath(path);
  const raw = readFileSync(resolved, "utf-8");
  const parsed = YAML.parse(raw);
  return ConfigSchema.parse(parsed);
}
