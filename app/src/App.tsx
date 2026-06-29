import { useState } from 'react'
import AdventureScreen from './components/AdventureScreen'
import CollectionScreen from './components/CollectionScreen'
import DexScreen from './components/DexScreen'
import FusionScreen from './components/FusionScreen'
import './App.css'

type View = 'adventure' | 'collection' | 'fusion' | 'dex'

export default function App() {
  const [view, setView] = useState<View>('adventure')

  return (
    <div className="app">
      <header className="app-head">
        <h1>コドモナ・サーガ</h1>
        <p className="sub">プロトタイプ ｜ 冒険・コドモナ育成・配合・図鑑</p>
      </header>

      <div className="view-tabs">
        <button className={view === 'adventure' ? 'on' : ''} onClick={() => setView('adventure')}>
          ぼうけん
        </button>
        <button className={view === 'collection' ? 'on' : ''} onClick={() => setView('collection')}>
          コドモナ
        </button>
        <button className={view === 'fusion' ? 'on' : ''} onClick={() => setView('fusion')}>
          配合
        </button>
        <button className={view === 'dex' ? 'on' : ''} onClick={() => setView('dex')}>
          図鑑
        </button>
      </div>

      {view === 'adventure' && <AdventureScreen />}
      {view === 'collection' && <CollectionScreen />}
      {view === 'fusion' && <FusionScreen />}
      {view === 'dex' && <DexScreen />}

      <footer className="foot">
        データ源: <code>/data/monsters.json</code> ・ 保存: ローカル（localStorage）｜ 仕様:{' '}
        <code>docs/design-decisions.md</code>
      </footer>
    </div>
  )
}
