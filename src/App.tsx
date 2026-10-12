/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { LightbotSim } from './components/LightbotSim';
import { VacuumLearnerSim } from './components/VacuumLearnerSim';
import { RotateCcw } from 'lucide-react';

export default function App() {
  // Global simulation reset key to force reload both simulations if requested
  const [simKey, setSimKey] = useState<number>(0);

  const handleResetBoth = () => {
    setSimKey((k) => k + 1);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col font-sans antialiased selection:bg-slate-200">
      {/* Minimal Top Bar adhering to the 3-zone contract */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between gap-8">
          {/* Zone 1: Brand title */}
          <div className="text-base font-extrabold tracking-tight text-slate-900 whitespace-nowrap shrink-0 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-600 inline-block"></span>
            <span>Programmeren vs. Machine Learning</span>
          </div>

          {/* Zone 2: Concise contrast tag */}
          <div className="hidden sm:flex items-center gap-2 text-xs font-semibold text-slate-500 whitespace-nowrap shrink-0">
            <span className="text-blue-700">Starre Regels (Lightbot)</span>
            <span aria-hidden="true">vs.</span>
            <span className="text-emerald-700">Zelflerend (Robotstofzuiger)</span>
          </div>

          {/* Zone 3: 1 Primary Action */}
          <div className="flex items-center gap-3 shrink-0">
            <button
              onClick={handleResetBoth}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer shadow-xs active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Herstart Beide</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Split Screen Sandbox */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col justify-center">
        {/* Minimal Subtitle */}
        <div className="mb-5 flex flex-col sm:flex-row sm:items-baseline justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">
              Programmeren vs Machine Learning
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Links volgt een robot blindelings voorgeprogrammeerde stappen. Rechts leert een robotstofzuiger door te botsen en zichzelf continu te verbeteren.
            </p>
          </div>
        </div>

        {/* The Live Split Screen */}
        <div key={simKey} className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
          {/* Left: Lightbot Simulation */}
          <div className="h-full">
            <LightbotSim />
          </div>

          {/* Right: Vacuum Learner Simulation with Learning Curve */}
          <div className="h-full">
            <VacuumLearnerSim />
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-slate-200 bg-white py-4 text-[11px] text-slate-500 text-center">
        <span>Visuele demonstratie van traditionele programmastappen tegenover adaptief reinforcement learning.</span>
      </footer>
    </div>
  );
}
