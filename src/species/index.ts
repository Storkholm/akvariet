import { rayTemplate } from './ray';
import { seaCucumberTemplate } from './seaCucumber';
import { seaUrchinTemplate } from './seaUrchin';
import { starfishTemplate } from './starfish';
import { turtleTemplate } from './turtle';
import type { Species, Template } from './types';

export type { Part, Species, Template } from './types';

export const TEMPLATES: Record<Species, Template> = {
  ray: rayTemplate,
  turtle: turtleTemplate,
  starfish: starfishTemplate,
  seaUrchin: seaUrchinTemplate,
  seaCucumber: seaCucumberTemplate,
};

/** Species in the order the carousel shows them (DESIGN 8.3: rokke, skildpadde, …; the fish of M11 go between the turtle and the starfish). */
export const SPECIES: readonly Species[] = ['ray', 'turtle', 'starfish', 'seaUrchin', 'seaCucumber'];

export function getTemplate(species: Species): Template {
  return TEMPLATES[species];
}
