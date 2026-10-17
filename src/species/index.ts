import { clownfishTemplate } from './clownfish';
import { pufferfishTemplate } from './pufferfish';
import { rayTemplate } from './ray';
import { sharkTemplate } from './shark';
import { seaCucumberTemplate } from './seaCucumber';
import { seaUrchinTemplate } from './seaUrchin';
import { starfishTemplate } from './starfish';
import { turtleTemplate } from './turtle';
import type { Species, Template } from './types';

export type { Part, Species, Template } from './types';

export const TEMPLATES: Record<Species, Template> = {
  ray: rayTemplate,
  turtle: turtleTemplate,
  clownfish: clownfishTemplate,
  pufferfish: pufferfishTemplate,
  shark: sharkTemplate,
  starfish: starfishTemplate,
  seaUrchin: seaUrchinTemplate,
  seaCucumber: seaCucumberTemplate,
};

/** Species in the order the carousel shows them (DESIGN 8.3: rokke, skildpadde, …; fish, then bottom dwellers). */
export const SPECIES: readonly Species[] = ['ray', 'turtle', 'clownfish', 'pufferfish', 'shark', 'starfish', 'seaUrchin', 'seaCucumber'];

export function getTemplate(species: Species): Template {
  return TEMPLATES[species];
}
