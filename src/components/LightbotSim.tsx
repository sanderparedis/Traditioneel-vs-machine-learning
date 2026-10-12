import React, { useState, useEffect, useRef } from 'react';
import {
  ArrowUp,
  RotateCcw,
  RotateCw,
  ArrowBigUpDash,
  Lightbulb,
  Play,
  Pause,
  AlertOctagon,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';

export type CommandType = 'FORWARD' | 'TURN_LEFT' | 'TURN_RIGHT' | 'JUMP' | 'LIGHT';

interface Tile {
  x: number;
  y: number;
  height: number;
  isGoal: boolean;
}

// 5x5 Grid with elevated steps leading to the goal tile at (3, 2)
const DEFAULT_TILES: Tile[] = [
  // Row 0
  { x: 0, y: 0, height: 0, isGoal: false },
  { x: 1, y: 0, height: 0, isGoal: false },
  { x: 2, y: 0, height: 0, isGoal: false },
  { x: 3, y: 0, height: 0, isGoal: false },
  { x: 4, y: 0, height: 0, isGoal: false },

  // Row 1
  { x: 0, y: 1, height: 0, isGoal: false },
  { x: 1, y: 1, height: 0, isGoal: false },
  { x: 2, y: 1, height: 1, isGoal: false }, // Elevated step
  { x: 3, y: 1, height: 1, isGoal: false },
  { x: 4, y: 1, height: 0, isGoal: false },

  // Row 2
  { x: 0, y: 2, height: 0, isGoal: false },
  { x: 1, y: 2, height: 0, isGoal: false },
  { x: 2, y: 2, height: 1, isGoal: false }, // Platform
  { x: 3, y: 2, height: 1, isGoal: true },  // GOAL TILE!
  { x: 4, y: 2, height: 0, isGoal: false },

  // Row 3
  { x: 0, y: 3, height: 0, isGoal: false },
  { x: 1, y: 3, height: 0, isGoal: false },
  { x: 2, y: 3, height: 0, isGoal: false },
  { x: 3, y: 3, height: 0, isGoal: false },
  { x: 4, y: 3, height: 0, isGoal: false },

  // Row 4
  { x: 0, y: 4, height: 0, isGoal: false },
  { x: 1, y: 4, height: 0, isGoal: false },
  { x: 2, y: 4, height: 0, isGoal: false },
  { x: 3, y: 4, height: 0, isGoal: false },
  { x: 4, y: 4, height: 0, isGoal: false },
];

// De JUISTE, werkende volgorde voor Lightbot:
// 1. Vooruit -> naar (1,0)
// 2. Vooruit -> naar (2,0)
// 3. Draai Rechts -> kijkt naar het zuiden
// 4. Spring -> springt op verhoging naar (2,1)
// 5. Vooruit -> loopt naar (2,2)
// 6. Draai Links -> kijkt naar het oosten
// 7. Vooruit -> loopt naar (3,2) [het doelvakje!]
// 8. Lampje -> activeert het doel en licht op!
const PERFECT_PROGRAM: CommandType[] = [
  'FORWARD',
  'FORWARD',
  'TURN_RIGHT',
  'JUMP',
  'FORWARD',
  'TURN_LEFT',
  'FORWARD',
  'LIGHT',
];

// Directions: 0 = North (-y), 1 = East (+x), 2 = South (+y), 3 = West (-x)
const DIRS = [
  { dx: 0, dy: -1 }, // North
  { dx: 1, dy: 0 },  // East
  { dx: 0, dy: 1 },  // South
  { dx: -1, dy: 0 }, // West
];

export const LightbotSim: React.FC = () => {
  const [robotPos, setRobotPos] = useState<{ x: number; y: number; dir: number }>({
    x: 0,
    y: 0,
    dir: 1, // East
  });

  const [program, setProgram] = useState<CommandType[]>(PERFECT_PROGRAM);
  const [activeStep, setActiveStep] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isLit, setIsLit] = useState<boolean>(false);
  const [hasCollision, setHasCollision] = useState<boolean>(false);
  const [unexpectedObstacle, setUnexpectedObstacle] = useState<boolean>(false);

  const timerRef = useRef<number | null>(null);

  // Reset to initial state
  const handleReset = () => {
    setIsPlaying(false);
    setActiveStep(-1);
    setRobotPos({ x: 0, y: 0, dir: 1 });
    setIsLit(false);
    setHasCollision(false);
  };

  const getTile = (x: number, y: number) => {
    return DEFAULT_TILES.find((t) => t.x === x && t.y === y);
  };

  // Execute a single command
  const executeCommand = (cmd: CommandType, currentPos: { x: number; y: number; dir: number }) => {
    let { x, y, dir } = currentPos;
    let collisionOccurred = false;

    if (cmd === 'TURN_LEFT') {
      dir = (dir + 3) % 4;
    } else if (cmd === 'TURN_RIGHT') {
      dir = (dir + 1) % 4;
    } else if (cmd === 'FORWARD') {
      const targetX = x + DIRS[dir].dx;
      const targetY = y + DIRS[dir].dy;
      const currentTile = getTile(x, y);
      const targetTile = getTile(targetX, targetY);

      // Check if unexpected obstacle is placed on (2, 0)
      if (unexpectedObstacle && targetX === 2 && targetY === 0) {
        collisionOccurred = true;
      } else if (!targetTile || targetX < 0 || targetX > 4 || targetY < 0 || targetY > 4) {
        collisionOccurred = true;
      } else if (targetTile.height !== (currentTile?.height ?? 0)) {
        // Can't walk across height differences without jumping!
        collisionOccurred = true;
      } else {
        x = targetX;
        y = targetY;
      }
    } else if (cmd === 'JUMP') {
      const targetX = x + DIRS[dir].dx;
      const targetY = y + DIRS[dir].dy;
      const currentTile = getTile(x, y);
      const targetTile = getTile(targetX, targetY);

      if (unexpectedObstacle && targetX === 2 && targetY === 0) {
        collisionOccurred = true;
      } else if (!targetTile || targetX < 0 || targetX > 4 || targetY < 0 || targetY > 4) {
        collisionOccurred = true;
      } else if (Math.abs(targetTile.height - (currentTile?.height ?? 0)) !== 1) {
        // Jump only works for height diff of exact 1
        collisionOccurred = true;
      } else {
        x = targetX;
        y = targetY;
      }
    } else if (cmd === 'LIGHT') {
      const tile = getTile(x, y);
      if (tile?.isGoal) {
        setIsLit(true);
      }
    }

    if (collisionOccurred) {
      setHasCollision(true);
      setIsPlaying(false);
      return currentPos;
    }

    return { x, y, dir };
  };

  // Step runner
  useEffect(() => {
    if (isPlaying) {
      timerRef.current = window.setTimeout(() => {
        const nextStep = activeStep + 1;
        if (nextStep < program.length) {
          setActiveStep(nextStep);
          setRobotPos((prev) => executeCommand(program[nextStep], prev));
        } else {
          setIsPlaying(false);
        }
      }, 550);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isPlaying, activeStep, program, unexpectedObstacle]);

  const togglePlay = () => {
    if (hasCollision || activeStep >= program.length - 1 || isLit) {
      handleReset();
      setTimeout(() => setIsPlaying(true), 80);
    } else {
      setIsPlaying(!isPlaying);
    }
  };

  // Convert (x, y, h) to Isometric 2D screen coordinates
  const toIso = (x: number, y: number, h: number = 0) => {
    const tileW = 54;
    const tileH = 27;
    const originX = 180;
    const originY = 65;

    const isoX = originX + (x - y) * (tileW / 2);
    const isoY = originY + (x + y) * (tileH / 2) - h * 16;

    return { isoX, isoY };
  };

  const currentTile = getTile(robotPos.x, robotPos.y);
  const robotIso = toIso(robotPos.x, robotPos.y, currentTile?.height ?? 0);

  // Command icon helper
  const renderCmdIcon = (cmd: CommandType) => {
    switch (cmd) {
      case 'FORWARD':
        return <ArrowUp className="w-3.5 h-3.5" />;
      case 'TURN_LEFT':
        return <RotateCcw className="w-3.5 h-3.5" />;
      case 'TURN_RIGHT':
        return <RotateCw className="w-3.5 h-3.5" />;
      case 'JUMP':
        return <ArrowBigUpDash className="w-3.5 h-3.5" />;
      case 'LIGHT':
        return <Lightbulb className="w-3.5 h-3.5" />;
    }
  };

  const getCmdLabel = (cmd: CommandType) => {
    switch (cmd) {
      case 'FORWARD':
        return 'Vooruit';
      case 'TURN_LEFT':
        return 'Draai L';
      case 'TURN_RIGHT':
        return 'Draai R';
      case 'JUMP':
        return 'Spring';
      case 'LIGHT':
        return 'Lampje';
    }
  };

  // Sort tiles for correct isometric back-to-front rendering
  const sortedTiles = [...DEFAULT_TILES].sort((a, b) => a.x + a.y - (b.x + b.y));

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between h-full">
      {/* Top Header Strip */}
      <div>
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-blue-600 inline-block shadow-xs"></span>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
              1. Traditioneel Programmeren
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200">
            Juiste volgorde klaar (Lightbot)
          </span>
        </div>

        {/* Isometric 3D Grid Canvas */}
        <div className="relative aspect-[4/3] w-full max-w-[440px] mx-auto bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-inner flex items-center justify-center">
          <svg viewBox="0 0 360 270" className="w-full h-full select-none">
            {/* Draw Isometric Tiles in back-to-front order */}
            {sortedTiles.map((tile) => {
              const { isoX, isoY } = toIso(tile.x, tile.y, tile.height);
              const tileW = 54;
              const tileH = 27;
              const isGoalLit = tile.isGoal && isLit;

              // Top face path
              const topPath = `
                M ${isoX} ${isoY}
                L ${isoX + tileW / 2} ${isoY + tileH / 2}
                L ${isoX} ${isoY + tileH}
                L ${isoX - tileW / 2} ${isoY + tileH / 2}
                Z
              `;

              // Left side thickness
              const sideH = 14 + tile.height * 10;
              const leftPath = `
                M ${isoX - tileW / 2} ${isoY + tileH / 2}
                L ${isoX} ${isoY + tileH}
                L ${isoX} ${isoY + tileH + sideH}
                L ${isoX - tileW / 2} ${isoY + tileH / 2 + sideH}
                Z
              `;

              // Right side thickness
              const rightPath = `
                M ${isoX} ${isoY + tileH}
                L ${isoX + tileW / 2} ${isoY + tileH / 2}
                L ${isoX + tileW / 2} ${isoY + tileH / 2 + sideH}
                L ${isoX} ${isoY + tileH + sideH}
                Z
              `;

              // Colors based on goal / height
              let topColor = '#e2e8f0';
              let leftColor = '#94a3b8';
              let rightColor = '#cbd5e1';

              if (tile.isGoal) {
                if (isGoalLit) {
                  topColor = '#facc15'; // Glowing bright yellow
                  leftColor = '#ca8a04';
                  rightColor = '#eab308';
                } else {
                  topColor = '#38bdf8'; // Sky blue goal tile
                  leftColor = '#0284c7';
                  rightColor = '#0ea5e9';
                }
              } else if (tile.height > 0) {
                topColor = '#f1f5f9';
                leftColor = '#64748b';
                rightColor = '#94a3b8';
              }

              return (
                <g key={`tile_${tile.x}_${tile.y}`}>
                  <path d={leftPath} fill={leftColor} />
                  <path d={rightPath} fill={rightColor} />
                  <path
                    d={topPath}
                    fill={topColor}
                    stroke="#ffffff"
                    strokeWidth="1.2"
                    strokeLinejoin="round"
                  />
                  {/* Goal bulb icon on goal tile */}
                  {tile.isGoal && (
                    <g transform={`translate(${isoX}, ${isoY + tileH / 2})`}>
                      <circle
                        cx="0"
                        cy="0"
                        r="6"
                        fill={isGoalLit ? '#fef08a' : '#0369a1'}
                        stroke={isGoalLit ? '#ca8a04' : '#ffffff'}
                        strokeWidth="1.5"
                      />
                      {isGoalLit && (
                        <circle cx="0" cy="0" r="10" fill="none" stroke="#facc15" strokeWidth="2" strokeDasharray="3 3" />
                      )}
                    </g>
                  )}
                </g>
              );
            })}

            {/* Unexpected Obstacle if toggled */}
            {unexpectedObstacle && (() => {
              const { isoX, isoY } = toIso(2, 0, 0);
              return (
                <g>
                  {/* Obstacle box directly on (2, 0) */}
                  <rect
                    x={isoX - 12}
                    y={isoY - 14}
                    width="24"
                    height="28"
                    rx="3"
                    fill="#dc2626"
                    stroke="#991b1b"
                    strokeWidth="2"
                  />
                  <text
                    x={isoX}
                    y={isoY + 4}
                    fill="#ffffff"
                    fontSize="11"
                    fontWeight="black"
                    textAnchor="middle"
                  >
                    !
                  </text>
                </g>
              );
            })()}

            {/* Robot Avatar */}
            {(() => {
              const rx = robotIso.isoX;
              const ry = robotIso.isoY + 2;

              return (
                <g
                  className="transition-all duration-300 ease-out"
                  transform={`translate(${rx}, ${ry})`}
                >
                  {/* Drop shadow */}
                  <ellipse cx="0" cy="8" rx="12" ry="6" fill="#000000" fillOpacity="0.25" />

                  {/* Robot Body */}
                  <circle cx="0" cy="-6" r="13" fill="#2563eb" stroke="#1d4ed8" strokeWidth="2" />

                  {/* Antenna */}
                  <line x1="0" y1="-19" x2="0" y2="-25" stroke="#1d4ed8" strokeWidth="2" />
                  <circle
                    cx="0"
                    cy="-26"
                    r="4"
                    fill={hasCollision ? '#dc2626' : isLit ? '#facc15' : '#60a5fa'}
                    stroke={isLit ? '#ca8a04' : 'none'}
                    strokeWidth="1"
                  />

                  {/* Visor / Eye */}
                  <rect
                    x="-7"
                    y="-10"
                    width="14"
                    height="7"
                    rx="3.5"
                    fill="#0f172a"
                  />
                  <circle
                    cx={robotPos.dir === 1 ? 2.5 : robotPos.dir === 3 ? -2.5 : 0}
                    cy="-6.5"
                    r="2"
                    fill={hasCollision ? '#ef4444' : isLit ? '#facc15' : '#38bdf8'}
                  />

                  {/* Collision alert icon */}
                  {hasCollision && (
                    <g transform="translate(0, -38)">
                      <circle cx="0" cy="0" r="10" fill="#dc2626" />
                      <text
                        x="0"
                        y="3.5"
                        fill="#ffffff"
                        fontSize="11"
                        fontWeight="black"
                        textAnchor="middle"
                      >
                        ✕
                      </text>
                    </g>
                  )}
                </g>
              );
            })()}
          </svg>

          {/* Status banner */}
          <div className="absolute top-2 left-2 flex items-center gap-1.5 text-[11px] font-semibold bg-white/95 px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
            {hasCollision ? (
              <span className="text-red-600 flex items-center gap-1 font-bold">
                <AlertOctagon className="w-3.5 h-3.5" /> Geblokkeerd (Onverwacht obstakel!)
              </span>
            ) : isLit ? (
              <span className="text-emerald-700 flex items-center gap-1 font-bold">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Doel Bereikt: Lampje Brand!
              </span>
            ) : (
              <span className="text-slate-700">
                Stap: {activeStep >= 0 ? `${activeStep + 1} / ${program.length}` : 'Klaar voor start'}
              </span>
            )}
          </div>
        </div>

        {/* Hardcoded Program Command Queue (Juiste Volgorde) */}
        <div className="mt-4">
          <div className="flex items-center justify-between text-xs text-slate-600 mb-2 font-medium">
            <span className="font-bold text-slate-800">
              Voorgeprogrammeerde Volgorde ({program.length} stappen):
            </span>
            <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
              ✓ Juiste code klaar
            </span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-thin">
            {program.map((cmd, idx) => {
              const isActive = activeStep === idx;
              const isPast = activeStep > idx;
              return (
                <div
                  key={`cmd_${idx}`}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold whitespace-nowrap transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white border-blue-700 shadow-sm scale-105 ring-2 ring-blue-300'
                      : isPast
                      ? 'bg-blue-50 text-blue-900 border-blue-200'
                      : 'bg-slate-50 text-slate-700 border-slate-200'
                  }`}
                >
                  <span className={`text-[10px] font-mono ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                    {idx + 1}.
                  </span>
                  {renderCmdIcon(cmd)}
                  <span>{getCmdLabel(cmd)}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={togglePlay}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-lg text-white transition-colors cursor-pointer shadow-xs active:scale-95 ${
              isPlaying ? 'bg-amber-600 hover:bg-amber-700' : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'Pauze' : 'Voer Code Uit (Start)'}</span>
          </button>

          <button
            onClick={handleReset}
            className="inline-flex items-center gap-1 px-3 py-2 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            title="Zet robot terug op startpunt"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Herstart</span>
          </button>
        </div>

        {/* Change Environment Toggle */}
        <button
          onClick={() => {
            setUnexpectedObstacle(!unexpectedObstacle);
            handleReset();
          }}
          className={`inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border transition-colors cursor-pointer ${
            unexpectedObstacle
              ? 'bg-red-50 text-red-700 border-red-300'
              : 'bg-slate-50 text-slate-700 border-slate-300 hover:bg-slate-100'
          }`}
          title="Voeg een onverwachte muur toe om de breekbaarheid van hardcoded code te tonen"
        >
          <AlertOctagon className="w-3.5 h-3.5 text-red-600" />
          <span>{unexpectedObstacle ? 'Verwijder Obstakel' : 'Plaats Onverwacht Obstakel'}</span>
        </button>
      </div>
    </div>
  );
};
