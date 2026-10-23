import { Mesh, MeshStandardMaterial, type Object3D } from 'three';

/** Reviewed 3D silhouette simplification: the two red plates are Wing_Folded, not
 * particles or canisters. The source skin shows them initially; deliberately omit
 * this decorative pair here, keeping Weapon, Canisters and their animated bones. */
export function prepareRenataModel(scene: Object3D): void {
  scene.traverse(object => {
    if (object instanceof Mesh && !Array.isArray(object.material) && object.material.name === 'Wing_Folded') object.visible = false;
  });
  restoreRenataGlass(scene);
}

/** The 14.24 export's two procedural glass slots were flattened to opaque Glass_Color1
 * (bin-bindings.mjs). Repair that specific fallback on the owned template, before GPU upload.
 * Keep the textured Canisters/Weapon and all bones; future textured/blended exports win. */
export function restoreRenataGlass(scene: Object3D): void {
  scene.traverse(object => {
    if (!(object instanceof Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!(material instanceof MeshStandardMaterial) || material.map || material.transparent
        || !['Weapon_Glass', 'Canister_Glass'].includes(material.name)) continue;
      material.transparent = true;
      material.opacity = .65;
      material.depthWrite = false;
      material.roughness = .22;
      material.emissive.copy(material.color);
      material.emissiveIntensity = .16;
      // Thin, tinted glass: see through the face, retain the curved silhouette at grazing angles.
      // StandardMaterial still supplies the animated skin normals and the original source tint.
      material.onBeforeCompile = shader => {
        // Source material instances: Renata_Base_Glass[_Cannister]_Mat_inst.
        const canister = material.name === 'Canister_Glass';
        shader.fragmentShader = shader.fragmentShader.replace('#include <opaque_fragment>', `
          float glassRim = pow(1. - abs(dot(normalize(vNormal), normalize(vViewPosition))), ${canister ? '3.' : '.5'});
          diffuseColor.a *= clamp(glassRim ${canister ? '- .2' : '- .35'}, 0., 1.);
          outgoingLight = mix(outgoingLight, vec3(${canister ? '.7991913, .5360189, .6915084' : '.8664531, .6741894, .7877928'}), glassRim * .35);
          #include <opaque_fragment>
        `);
      };
      material.customProgramCacheKey = () => `renata-glass-v2/${material.name}`;
      material.needsUpdate = true;
    }
  });
}
