import dragon2 from '../assets/sprites/dragon2.png'
import dwarfIdle from '../assets/sprites/dwarf-idle.png'
import dwarfRun from '../assets/sprites/dwarf-run.png'
import dwarfWeapon from '../assets/sprites/dwarf-weapon.png'
import elfIdle from '../assets/sprites/elf-idle.png'
import elfRun from '../assets/sprites/elf-run.png'
import elfWeapon from '../assets/sprites/elf-weapon.png'
import goblinIdle from '../assets/sprites/goblin-idle.png'
import goblinRun from '../assets/sprites/goblin-run.png'
import goblinWeapon from '../assets/sprites/goblin-weapon.png'
import knightIdle from '../assets/sprites/knight-idle.png'
import knightRun from '../assets/sprites/knight-run.png'
import knightWeapon from '../assets/sprites/knight-weapon.png'
import lizardIdle from '../assets/sprites/lizard-idle.png'
import lizardRun from '../assets/sprites/lizard-run.png'
import ogreIdle from '../assets/sprites/ogre-idle.png'
import ogreRun from '../assets/sprites/ogre-run.png'
import ogreWeapon from '../assets/sprites/ogre-weapon.png'
import orcIdle from '../assets/sprites/orc-idle.png'
import orcRun from '../assets/sprites/orc-run.png'
import orcWeapon from '../assets/sprites/orc-weapon.png'
import shotArrow from '../assets/sprites/shot-arrow.png'
import shotFire from '../assets/sprites/shot-fire.gif'
import skeletonIdle from '../assets/sprites/skeleton-idle.png'
import skeletonRun from '../assets/sprites/skeleton-run.png'
import skeletonWeapon from '../assets/sprites/skeleton-weapon.png'
import wizardIdle from '../assets/sprites/wizard-idle.png'
import wizardRun from '../assets/sprites/wizard-run.png'
import wizardWeapon from '../assets/sprites/wizard-weapon.png'

export const SHOT_ARROW = shotArrow
export const SHOT_FIRE = shotFire

export const WANDER_CAST = [
  {
    idle: knightIdle,
    run: knightRun,
    weapon: knightWeapon,
    frame: [16, 28],
    arm: [10, 29],
    attack: 'swing',
    nameUa: 'Лицар',
    nameEn: 'Knight',
  },
  {
    idle: elfIdle,
    run: elfRun,
    weapon: elfWeapon,
    frame: [16, 28],
    arm: [14, 26],
    armPos: { left: 58, bottom: 0 },
    attack: 'shoot',
    nameUa: 'Ельфійка',
    nameEn: 'Elf',
  },
  {
    idle: wizardIdle,
    run: wizardRun,
    weapon: wizardWeapon,
    frame: [16, 28],
    arm: [8, 30],
    attack: 'cast',
    nameUa: 'Чарівник',
    nameEn: 'Wizard',
  },
  {
    idle: dragon2,
    run: dragon2,
    frame: [154, 121],
    frames: 3,
    fly: true,
    dragon: true,
    scale: 1,
    attack: 'fire',
    shot: { left: 90, bottom: 4, size: 0.42 },
    nameUa: 'Дракон',
    nameEn: 'Dragon',
  },
  {
    idle: lizardIdle,
    run: lizardRun,
    frame: [16, 28],
    scale: 2.5,
    attack: 'fire',
    shot: { left: 82, bottom: 29, size: 0.5 },
    nameUa: 'Драконід',
    nameEn: 'Dragonborn',
  },
  {
    idle: goblinIdle,
    run: goblinRun,
    weapon: goblinWeapon,
    frame: [16, 16],
    arm: [6, 13],
    attack: 'swing',
    nameUa: 'Гоблін',
    nameEn: 'Goblin',
  },
  {
    idle: ogreIdle,
    run: ogreRun,
    weapon: ogreWeapon,
    frame: [32, 36],
    arm: [10, 37],
    scale: 1.5,
    attack: 'swing',
    nameUa: 'Огр',
    nameEn: 'Ogre',
  },
  {
    idle: skeletonIdle,
    run: skeletonRun,
    weapon: skeletonWeapon,
    frame: [16, 16],
    arm: [10, 21],
    attack: 'swing',
    nameUa: 'Скелет',
    nameEn: 'Skeleton',
  },
  {
    idle: orcIdle,
    run: orcRun,
    weapon: orcWeapon,
    frame: [16, 23],
    arm: [9, 21],
    attack: 'swing',
    nameUa: 'Орк',
    nameEn: 'Orc',
  },
  {
    idle: dwarfIdle,
    run: dwarfRun,
    weapon: dwarfWeapon,
    frame: [16, 28],
    arm: [10, 24],
    attack: 'swing',
    nameUa: 'Гном',
    nameEn: 'Dwarf',
  },
]
