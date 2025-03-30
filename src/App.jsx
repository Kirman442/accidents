import { useState } from 'react'
// import reactLogo from './assets/react.svg'
// import viteLogo from '/vite.svg'


// import SupaBaseViewData from './components/dev/components/SupaBaseTest.dev.jsx'
import SupaBaseUI from './components/prod/components/SupaBaseUI.prod'
// import './App.css'

if (import.meta.env.DEV) {
  console.warn('Используется prod-версия компонента в dev-режиме!');
}

function App() {
  return <SupaBaseUI />;
}
export default App
