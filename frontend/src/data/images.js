import wizardSpells from '../assets/wizard_spells.png'
import chrisPerkins from '../assets/chris_perkins.png'
import dndCelebration from '../assets/dnd_celebration.png'
import magicTheory from '../assets/magic_theory.png'
import whiteHairWarrior from '../assets/white_hair_warrior.png'
import dungeonHall from '../assets/dungeon_hall.png'
import illithidLair from '../assets/illithid_lair.jpg'
import diceHydra from '../assets/dice_hydra.png'
import blueDragon from '../assets/blue_dragon.png'
import rulesHeroBg from '../assets/rules_hero_bg.jpg'
import skeletonWarrior from '../assets/skeleton_warrior.jpg'
import rangerGreen from '../assets/ranger_green.png'
import soldiersSnow from '../assets/soldiers_snow.png'
import goblinTavern from '../assets/goblin_tavern.png'

export const SITE_IMAGES = {
  wizard_spells: wizardSpells,
  chris_perkins: chrisPerkins,
  dnd_celebration: dndCelebration,
  magic_theory: magicTheory,
  white_hair_warrior: whiteHairWarrior,
  dungeon_hall: dungeonHall,
  illithid_lair: illithidLair,
  dice_hydra: diceHydra,
  blue_dragon: blueDragon,
  rules_hero_bg: rulesHeroBg,
  skeleton_warrior: skeletonWarrior,
  ranger_green: rangerGreen,
  soldiers_snow: soldiersSnow,
  goblin_tavern: goblinTavern,
}

const SITE_IMAGE_PREFIX = 'site:'

export function siteImage(key, fallbackKey = 'wizard_spells') {
  return SITE_IMAGES[key] || SITE_IMAGES[fallbackKey] || wizardSpells
}

export function siteImageValue(key) {
  return SITE_IMAGE_PREFIX + key
}

export function resolveSiteImage(value, fallbackKey = 'ranger_green') {
  if (!value) return siteImage(fallbackKey)
  if (value.startsWith(SITE_IMAGE_PREFIX)) {
    return siteImage(value.slice(SITE_IMAGE_PREFIX.length), fallbackKey)
  }
  return SITE_IMAGES[value] || value
}
