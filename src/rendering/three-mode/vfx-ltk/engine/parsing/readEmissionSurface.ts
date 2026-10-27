/*! @license GPL-3.0-or-later
 * Derived from ltk-manager (GPL-3.0-or-later).
 * Source: src/modules/workshop/bin/vfx/engine/parsing/readEmissionSurface.ts
 * Port/adaptation: catfish-xn/cat, 2026-10-26. See NOTICE.md and LICENSE.
 */
import type { VfxValue } from "../../bindings";

import { nameHash } from "../../binHash";
import type { EmissionSurfaceModel } from "../model/model";
import { field, flagOr, hashes, namedAsset, number } from "./readValue";

const SURFACE = nameHash("EmissionSurface");
const SKELETON = nameHash("VfxEmissionSkeletonData");
const MESH = nameHash("VfxEmissionMeshData");

/** The range the engine clamps `maxJointWeights` to. */
const JOINT_WEIGHTS = { least: 1, most: 4 } as const;

/**
 * Reads an emission surface in the layout before or after the 15.22 class split.
 *
 * Returns null for a linked mesh, because only a superward region links one.
 */
export function readEmissionSurface(node: VfxValue | null): EmissionSurfaceModel | null {
  if (node?.type !== "struct") return null;

  const nested = field(node, SURFACE);
  const held = nested?.type === "struct" ? nested : node;
  if (nested !== null && held.classHash !== SKELETON && held.classHash !== MESH) return null;

  const get = (name: string) => field(held, nameHash(name));
  const skeleton = held.classHash === SKELETON;
  const weights = Math.trunc(number(get("maxJointWeights")) ?? JOINT_WEIGHTS.most);

  return {
    kind: skeleton ? "skeleton" : "mesh",
    mesh: namedAsset(get("meshName")),
    skeleton: namedAsset(get("skeletonName")),
    submeshes: hashes(get("Submeshes")),
    joints: hashes(get("JointMask")),
    scale: number(get("meshScale")) ?? 1,
    maxJointWeights: Math.max(JOINT_WEIGHTS.least, Math.min(JOINT_WEIGHTS.most, weights)),
    useNormal: skeleton || flagOr(get("useSurfaceNormalForBirthPhysics"), true),
  };
}
