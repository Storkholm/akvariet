import { rayTemplate } from './ray';
import type { Species, Template } from './types';

export type { Part, Species, Template } from './types';

/** Species that have a template so far (the turtle arrives in M5). */
export const TEMPLATES: Partial<Record<Species, Template>> = { ray: rayTemplate };

export function getTemplate(species: Species): Template {
  const t = TEMPLATES[species];
  if (!t) throw new Error(`No template for species "${species}" yet`);
  return t;
}
