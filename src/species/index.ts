import { rayTemplate } from './ray';
import { turtleTemplate } from './turtle';
import type { Species, Template } from './types';

export type { Part, Species, Template } from './types';

export const TEMPLATES: Record<Species, Template> = { ray: rayTemplate, turtle: turtleTemplate };

/** Species in the order the picker shows them. */
export const SPECIES: readonly Species[] = ['turtle', 'ray'];

export function getTemplate(species: Species): Template {
  return TEMPLATES[species];
}
