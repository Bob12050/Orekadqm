// 装備の可否判定と、装備セットの解決。純TS。

import type { EquipmentDef, GameData, JobDef } from '../data/types.ts'
import type { EquippedMap, SaveData } from '../save/schema.ts'
import { EQUIP_SLOTS } from '../data/types.ts'

export interface EquipCheck {
  ok: boolean
  reason?: string
}

/** その職業がこの装備を着けられるか（武器タグ制限・職位ゲート）。 */
export function canEquip(job: JobDef, def: EquipmentDef): EquipCheck {
  if (def.reqTier > job.tier) {
    return { ok: false, reason: `職位 T${def.reqTier} 以上が必要` }
  }
  if (def.slot === 'weapon' && def.weaponTag) {
    if (!job.weaponTags.includes(def.weaponTag)) {
      return { ok: false, reason: `${job.name}は${def.weaponTag}を装備できない` }
    }
  }
  return { ok: true }
}

/** 装備中スロットを EquipmentDef の配列に解決する（未装備・未知IDは除外）。 */
export function resolveEquipped(data: GameData, equipped: EquippedMap): EquipmentDef[] {
  const out: EquipmentDef[] = []
  for (const slot of EQUIP_SLOTS) {
    const id = equipped[slot]
    if (!id) continue
    const def = data.equipment[id]
    if (def) out.push(def)
  }
  return out
}

/** 所持装備から、そのスロットに装備可能なものを列挙する。 */
export function equippableForSlot(
  save: SaveData,
  data: GameData,
  job: JobDef,
  slot: string,
): EquipmentDef[] {
  const seen = new Set<string>()
  const out: EquipmentDef[] = []
  for (const id of save.ownedEquipment) {
    if (seen.has(id)) continue
    const def = data.equipment[id]
    if (!def || def.slot !== slot) continue
    if (!canEquip(job, def).ok) continue
    seen.add(id)
    out.push(def)
  }
  return out
}
