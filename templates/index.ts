import { validateTemplate, type Template } from "@/domain/template";
import { coffinworm } from "./coffinworm";
import { fbbbb } from "./fbbbb";
import { fiveAndDime } from "./five-and-dime";
import { godIsABeast } from "./god-is-a-beast";
import { krypteia } from "./krypteia";
import { leviathan } from "./leviathan";
import { pervertor } from "./pervertor";

/** All seeded templates, validated once at module load. */
export const TEMPLATES: Template[] = [krypteia, fiveAndDime, coffinworm, fbbbb, leviathan, godIsABeast, pervertor].map(validateTemplate);

export function getTemplate(id: string): Template | undefined {
  return TEMPLATES.find((t) => t.id === id);
}
