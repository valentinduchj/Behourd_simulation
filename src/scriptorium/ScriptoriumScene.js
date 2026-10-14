import { SCRIPTORIUM_LAYOUT } from '../data/scriptoriumLayout.js';
import { walkersAt } from '../borough/BoroughScene.js';
import { CatAmbience } from './CatBehavior.js';
import { FlaviaAmbience } from './FlaviaBehavior.js';

const inArea = (area, x, y) => x >= area.x && x < area.x + area.w && y >= area.y && y < area.y + area.h;

/**
 * Modèle de la scène du Scriptorium (sans rendu) : décor, Bureau d'étude, Professeure Flavia,
 * personnages et animaux d'ambiance, combattants en étude. Aucune règle ici : les études et les
 * améliorations sont fournies par l'écran (StudyService, ScriptoriumUpgradeService).
 */
export class ScriptoriumScene {
  constructor(layout = SCRIPTORIUM_LAYOUT) {
    this.layout = layout;
    this.width = layout.width;
    this.height = layout.height;
    this.desk = layout.desk;
    this.flavia = layout.flavia;
    this.workers = layout.workers ?? [];
    this.cat = new CatAmbience(layout.cat, layout.mouse);
    // Flavia se promène dans son cabinet et vient caresser le chat.
    this.flaviaAmbience = new FlaviaAmbience(layout.flavia, this.cat);
    // Combattants au Bureau d'étude : [{ fighter, study, seat }].
    this.students = [];
    // Artefact actif, posé sur la table de Flavia : { id, name, look } ou null.
    this.artifact = null;
    this.setUpgrades([]);
  }

  /** Artefact actif (data/scriptorium.js), ou null : il est posé sur la table de Flavia. */
  setArtifact(artifact) {
    this.artifact = artifact?.look ? artifact : null;
  }

  /** Améliorations acquises (ex. ['extra-desk']) : le second bureau et sa place apparaissent. */
  setUpgrades(upgrades) {
    const owned = new Set(upgrades);
    this.upgrades = owned;
    this.props = this.layout.props.filter((prop) => !prop.requires || owned.has(prop.requires));
    this.groundProps = this.props.filter((prop) => prop.layer === 'ground');
    this.standingProps = this.props.filter((prop) => prop.layer !== 'ground');
    this.seats = this.desk.seats.filter((seat) => !seat.requires || owned.has(seat.requires));
  }

  /** Combattants en étude [{ fighter, study }] : chacun prend une place du Bureau, dans l'ordre. */
  setStudents(students) {
    this.students = (students ?? []).slice(0, this.seats.length).map((student, i) => ({ ...student, seat: this.seats[i] }));
  }

  /** La case (x, y) appartient-elle au Bureau d'étude ? */
  isDeskTile(x, y) {
    return inArea(this.desk.area, x, y);
  }

  /** La case (x, y) appartient-elle à la zone de Flavia (4 × 4 cases) ? */
  isFlaviaTile(x, y) {
    return inArea(this.flavia.area, x, y);
  }

  /** Personnages qui circulent à l'instant `time` (tournées, groupes qui discutent). */
  walkersAt(time) {
    return walkersAt(this.layout.walkers ?? [], time);
  }

  /** Fait vivre le chat, la souris et Flavia (temps des images affichées). */
  update(dt) {
    this.cat.update(dt);
    this.flaviaAmbience.update(dt);
  }
}
