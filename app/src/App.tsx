import { useState } from 'react'
import AdventureScreen from './components/AdventureScreen'
import DexScreen from './components/DexScreen'
import FusionScreen from './components/FusionScreen'
import TrainScreen from './components/TrainScreen'
import './App.css'

type View = 'train' | 'adventure' | 'fusion' | 'dex'

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
        <button className={view === 'adventure' ? 'on' : ''} onClick={() => setView('adventure')}>
          ぼうけん
        </button>
        <button className={view === 'fusion' ? 'on' : ''} onClick={() => setView('fusion')}>
          配合
        </button>
        <button className={view === 'dex' ? 'on' : ''} onClick={() => setView('dex')}>
          図鑑
        </button>
      </div>

      {view === 'train' && <TrainScreen />}
      {view === 'adventure' && <AdventureScreen />}
      {view === 'fusion' && <FusionScreen />}
      {view === 'dex' && <DexScreen />}

      <footer className="foot">
        データ源: <code>/data/monsters.json</code> ・ 保存: ローカル（localStorage）｜ 仕様:{' '}
        <code>docs/design-decisions.md</code>
      </footer>
    </div>
  )
}
