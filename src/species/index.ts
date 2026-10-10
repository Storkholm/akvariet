import { rayTemplate } from './ray';
import { turtleTemplate } from './turtle';
import type { Species, Template } from './types';

export type { Part, Species, Template } from './types';

export const TEMPLATES: Record<Species, Template> = { ray: rayTemplate, turtle: turtleTemplate };

/** Species in the order the carousel shows them (DESIGN 8.3: rokke, skildpadde, …). */
export const SPECIES: readonly Species[] = ['ray', 'turtle'];

export function getTemplate(species: Species): Template {
  return TEMPLATES[species];
}
