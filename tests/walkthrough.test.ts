// 序盤の導線を通しでシミュレートする（前作の walkthrough テストにならう）。
// 新規作成→クエスト受注→討伐→報酬→素材収集→クラフト→装備→レベルアップ→セーブ。

import { describe, expect, it } from 'vitest'
import { loadGameData } from '../src/data/loader.ts'
import { Session } from '../src/state/Session.ts'
import { getProgress } from '../src/quests/quests.ts'
import { hasItem } from '../src/save/inventory.ts'
import { clearSave, loadSave, writeSave } from '../src/save/db.ts'

const data = loadGameData()

describe('序盤の通しプレイ', () => {
  it('18ステップの導線が破綻なく進む', async () => {
    const steps: string[] = []
    const step = (label: string, cond: boolean): void => {
      steps.push(label)
      expect(cond, label).toBe(true)
    }

    // 1. 新規作成（戦士）
    const s = Session.newGame(data, 'job_warrior')
    step('1 戦士で開始', s.job.id === 'job_warrior')
    // 2. 初期装備
    step('2 木剣を装備', s.save.equipped.weapon === 'eq_wood_sword')
    // 3. 開始スキル習得
    step('3 パワースラッシュ習得', s.save.player.learnedSkills.includes('sk_power_slash'))
    // 4. HP満タン
    step('4 HP満タン', s.hp === s.derived.maxHp && s.hp > 0)
    // 5. クエスト受注
    step('5 スライム退治を受注', s.acceptQuest('q_slime_cull'))

    // 6-10. スライム5体討伐
    const slime = data.enemies['en_slime']!
    let completed: string[] = []
    for (let i = 0; i < 5; i++) {
      s.gainExp(slime.exp)
      completed = s.recordKill('en_slime')
    }
    step('6 5体目でクエスト達成通知', completed.includes('q_slime_cull'))
    step('7 クエストが done', getProgress(s.save, 'q_slime_cull')?.done === true)
    // 8. 報酬のポーション
    step('8 報酬ポーション所持', hasItem(s.save, 'item_potion_s', 2))
    // 9. レベルアップ
    step('9 レベルが2以上', s.save.player.level >= 2)
    const defBefore = s.derived.def

    // 10-12. 素材収集→盾をクラフト
    s.collectLoot('mat_iron_shard', 4)
    step('10 くず鉄4個', hasItem(s.save, 'mat_iron_shard', 4))
    const recipe = data.recipes['rc_round_shield']!
    const { craft, canCraft } = await import('../src/crafting/crafting.ts')
    step('11 盾を作成可能', canCraft(s.save, recipe).ok)
    step('12 盾を作成', craft(s.save, data, recipe))
    step('13 盾を所持', s.save.ownedEquipment.includes('eq_round_shield'))

    // 14. 盾を装備 → 防御上昇
    step('14 盾を背中に装備', s.equip('back', 'eq_round_shield'))
    step('15 防御力が上がる', s.derived.def > defBefore)

    // 16. 被弾→回復
    const hp0 = s.hp
    s.damage(10)
    step('16 ダメージでHP減少', s.hp === hp0 - 10)
    s.heal(999)
    step('17 全回復', s.hp === s.derived.maxHp)

    // 18. セーブのラウンドトリップ
    await clearSave()
    await writeSave(s.syncForSave())
    const loaded = await loadSave()
    step('18 セーブ復元', loaded?.player.jobId === 'job_warrior' && loaded!.ownedEquipment.includes('eq_round_shield'))

    expect(steps.length).toBe(18)
  })
})
