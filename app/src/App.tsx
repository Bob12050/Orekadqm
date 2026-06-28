import { useState } from 'react'
import BattleScreen from './components/BattleScreen'
import FusionScreen from './components/FusionScreen'
import TrainScreen from './components/TrainScreen'
import './App.css'

type View = 'train' | 'battle' | 'fusion'

export default function App() {
  const [view, setView] = useState<View>('train')

  return (
    <div className="app">
      <header className="app-head">
        <h1>コドモナ・サーガ</h1>
        <p className="sub">プロトタイプ ｜ 育成・配合・バトル・スカウトの統合ループ</p>
      </header>

      <div className="view-tabs">
        <button className={view === 'train' ? 'on' : ''} onClick={() => setView('train')}>
          そだてる
        </button>
        <button className={view === 'battle' ? 'on' : ''} onClick={() => setView('battle')}>
          バトル
        </button>
        <button className={view === 'fusion' ? 'on' : ''} onClick={() => setView('fusion')}>
          配合
        </button>
      </div>

      {view === 'train' && <TrainScreen />}
      {view === 'battle' && <BattleScreen />}
      {view === 'fusion' && <FusionScreen />}

      <footer className="foot">
        データ源: <code>/data/monsters.json</code> ・ 保存: ローカル（localStorage）｜ 仕様:{' '}
        <code>docs/design-decisions.md</code>
      </footer>
    </div>
  )
}
