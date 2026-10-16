/**
 * G2-3 prep: display data for a pending choice whose kind the strategy panel has no dedicated
 * renderer for (armory, black market and similar). It never decides legality or price; the
 * choice is sent through the same public choose command and the rules answer.
 *
 * Optional display fields are read from `choice.display` when the rules provide them; until a
 * contract names them every field is absent and the offer falls back to its definition name.
 */
import { ITEM_DEFINITIONS } from '../simulation/content/g2-3-item-registry';
import { AUGMENT_DEFINITIONS } from '../simulation/content/augments';
import { ANOMALY_DEFINITIONS } from '../simulation/content/anomalies';
import { catalogEntry } from './item-codex';

export interface GenericChoiceOffer { readonly id: string; readonly name: string; readonly description: string; readonly price?: number }
export interface GenericChoiceExtras {
  readonly title?: string;
  readonly offers?: readonly GenericChoiceOffer[];
  readonly skip?: { readonly label?: string };
}

const KNOWN_KINDS: ReadonlySet<string> = new Set(['component', 'augment', 'anomaly']);
export const isKnownChoiceKind = (kind: string): boolean => KNOWN_KINDS.has(kind);

const text = (value: unknown): string | undefined => (typeof value === 'string' && value ? value : undefined);
const int = (value: unknown): number | undefined => (Number.isInteger(value) ? value as number : undefined);

/** Reads the optional `display` block defensively; malformed fields are dropped, never thrown. */
export function readChoiceExtras(choice: object): GenericChoiceExtras {
  const raw = (choice as { display?: unknown }).display;
  if (!raw || typeof raw !== 'object') return {};
  const display = raw as Record<string, unknown>;
  const offers = Array.isArray(display.offers) ? display.offers.flatMap(entry => {
    if (!entry || typeof entry !== 'object') return [];
    const offer = entry as Record<string, unknown>, id = text(offer.id);
    if (!id) return [];
    const price = int(offer.price);
    return [{ id, name: text(offer.name) ?? id, description: text(offer.description) ?? '', ...(price === undefined ? {} : { price }) }];
  }) : undefined;
  const skip = display.skip && typeof display.skip === 'object' ? { label: text((display.skip as Record<string, unknown>).label) } : display.skip === true ? {} : undefined;
  return { title: text(display.title), offers, skip };
}

type Named = { readonly name?: string; readonly description?: string };
/** Name and verbatim description of one offer id: the declared display entry, else any content definition, else the id. */
export function genericOffer(id: string, extras: GenericChoiceExtras): GenericChoiceOffer {
  const declared = extras.offers?.find(offer => offer.id === id);
  if (declared) return declared;
  const tables: readonly Readonly<Record<string, Named>>[] = [ITEM_DEFINITIONS, AUGMENT_DEFINITIONS, ANOMALY_DEFINITIONS];
  const definition = tables.map(table => (Object.hasOwn(table, id) ? table[id] : undefined)).find(Boolean);
  const name = definition?.name ?? catalogEntry(id)?.name ?? id;
  return { id, name, description: definition?.description ?? '' };
}
