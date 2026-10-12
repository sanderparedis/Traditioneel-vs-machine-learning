import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  Sparkles,
  TrendingDown,
  TrendingUp,
  FastForward,
} from 'lucide-react';

interface Obstacle {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  label: string;
}

interface DustSpeck {
  id: number;
  x: number;
  y: number;
  cleaned: boolean;
}

const ROOM_WIDTH = 360;
const ROOM_HEIGHT = 270;
const ROBOT_RADIUS = 13;

const OBSTACLES: Obstacle[] = [
  { x: 50, y: 50, w: 75, h: 45, color: '#94a3b8', label: 'Bank' },
  { x: 220, y: 70, w: 70, h: 55, color: '#64748b', label: 'Tafel' },
  { x: 130, y: 170, w: 55, h: 55, color: '#a1a1aa', label: 'Kast' },
  { x: 260, y: 190, w: 35, h: 35, color: '#10b981', label: 'Plant' },
];

function generateDust(): DustSpeck[] {
  const specks: DustSpeck[] = [];
  let id = 0;
  for (let x = 25; x < ROOM_WIDTH - 25; x += 32) {
    for (let y = 25; y < ROOM_HEIGHT - 25; y += 30) {
      // Don't place inside obstacles
      const inObs = OBSTACLES.some(
        (o) => x >= o.x - 5 && x <= o.x + o.w + 5 && y >= o.y - 5 && y <= o.y + o.h + 5
      );
      if (!inObs) {
        specks.push({ id: id++, x, y, cleaned: false });
      }
    }
  }
  return specks;
}

export const VacuumLearnerSim: React.FC = () => {
  // Training progress: Episode 1 (completely naive) to Episode 50 (expert coverage)
  const [episode, setEpisode] = useState<number>(1);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [collisionsCount, setCollisionsCount] = useState<number>(0);
  const [dust, setDust] = useState<DustSpeck[]>(generateDust);
  const [collisionFlash, setCollisionFlash] = useState<boolean>(false);
  const [speedMultiplier, setSpeedMultiplier] = useState<number>(1);

  // Robot dynamic state
  const [robot, setRobot] = useState({
    x: 40,
    y: 220,
    angle: 0.2, // radians
    speed: 2.2,
  });

  // History of learning for the interactive curve
  const [learningHistory, setLearningHistory] = useState<
    { episode: number; collisions: number; cleanedPct: number }[]
  >([
    { episode: 1, collisions: 16, cleanedPct: 18 },
  ]);

  const animFrameRef = useRef<number | null>(null);
  const tickCounterRef = useRef<number>(0);
  const currentCollisionsRef = useRef<number>(0);

  // Check collision with walls and obstacles
  const checkCollisionAt = (nx: number, ny: number) => {
    // Walls
    if (
      nx - ROBOT_RADIUS <= 6 ||
      nx + ROBOT_RADIUS >= ROOM_WIDTH - 6 ||
      ny - ROBOT_RADIUS <= 6 ||
      ny + ROBOT_RADIUS >= ROOM_HEIGHT - 6
    ) {
      return true;
    }

    // Obstacles
    for (const obs of OBSTACLES) {
      if (
        nx + ROBOT_RADIUS >= obs.x &&
        nx - ROBOT_RADIUS <= obs.x + obs.w &&
        ny + ROBOT_RADIUS >= obs.y &&
        ny - ROBOT_RADIUS <= obs.y + obs.h
      ) {
        return true;
      }
    }
    return false;
  };

  // Start fresh episode
  const startNewEpisode = (newEpisodeNum: number) => {
    setEpisode(newEpisodeNum);
    setDust(generateDust());
    setRobot({ x: 35, y: 225, angle: Math.random() * Math.PI * 2, speed: 2.2 });
    currentCollisionsRef.current = 0;
    setCollisionsCount(0);
    setCollisionFlash(false);
  };

  // Simulation physics loop
  useEffect(() => {
    if (!isPlaying) {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      return;
    }

    const step = () => {
      tickCounterRef.current += 1;

      setRobot((prev) => {
        let { x, y, angle } = prev;
        const currentSpeed = (2.2 + Math.min(1.2, episode * 0.02)) * speedMultiplier;

        // Policy intelligence factor based on episode:
        // Episode 1 = 0% intelligence (random walk into walls, bumping constantly)
        // Episode 50 = 100% intelligence (smooth obstacle avoidance, systematic sweep)
        const intelligence = Math.min(1, Math.max(0, (episode - 1) / 35));

        // Proximity sensor lookahead
        const lookaheadDist = 12 + intelligence * 26;
        const sensorX = x + Math.cos(angle) * lookaheadDist;
        const sensorY = y + Math.sin(angle) * lookaheadDist;

        // If sensor detects obstacle and robot has learned intelligence
        if (checkCollisionAt(sensorX, sensorY) && Math.random() < intelligence * 0.96) {
          // Trained behavior: smoothly rotate away from obstacle before hitting it!
          angle += 0.45 * (Math.random() > 0.5 ? 1 : -1);
        }

        // Potential next position
        const nextX = x + Math.cos(angle) * currentSpeed;
        const nextY = y + Math.sin(angle) * currentSpeed;

        if (checkCollisionAt(nextX, nextY)) {
          // BUMP! Actual collision occurred
          currentCollisionsRef.current += 1;
          setCollisionsCount(currentCollisionsRef.current);
          setCollisionFlash(true);
          setTimeout(() => setCollisionFlash(false), 120);

          // Rebound angle
          if (intelligence > 0.6) {
            angle += Math.PI * 0.65; // smarter bounce
          } else {
            angle += (Math.random() * 1.5 + 1.2) * (Math.random() > 0.5 ? 1 : -1);
          }

          return { x, y, angle, speed: currentSpeed };
        } else {
          // Move forward cleanly
          // In high episodes, add subtle systematic sweeping waves
          if (intelligence > 0.4 && Math.random() < 0.04) {
            angle += (Math.random() - 0.5) * 0.2;
          }

          return { x: nextX, y: nextY, angle, speed: currentSpeed };
        }
      });

      // Clean nearby dust
      setDust((prevDust) => {
        return prevDust.map((d) => {
          if (!d.cleaned) {
            const dist = Math.hypot(d.x - robot.x, d.y - robot.y);
            if (dist < ROBOT_RADIUS + 8) {
              return { ...d, cleaned: true };
            }
          }
          return d;
        });
      });

      // Episode completion or transition check
      const cleanedTotal = dust.filter((d) => d.cleaned).length;
      const totalDust = dust.length;
      const cleanedPct = totalDust > 0 ? Math.round((cleanedTotal / totalDust) * 100) : 0;

      // Auto-advance episode after ~400 ticks or when clean
      if (tickCounterRef.current >= 420 || cleanedPct >= 96) {
        tickCounterRef.current = 0;
        const nextEp = episode + 1;
        setLearningHistory((prev) => [
          ...prev.slice(-25),
          {
            episode,
            collisions: currentCollisionsRef.current,
            cleanedPct,
          },
        ]);
        startNewEpisode(nextEp);
      }

      animFrameRef.current = requestAnimationFrame(step);
    };

    animFrameRef.current = requestAnimationFrame(step);

    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, episode, dust, robot.x, robot.y, speedMultiplier]);

  const cleanedCount = dust.filter((d) => d.cleaned).length;
  const cleanedPercent = dust.length > 0 ? Math.round((cleanedCount / dust.length) * 100) : 0;

  // Expected collisions baseline based on episode
  const skillLabel =
    episode <= 3 ? 'Onervaren (Botst Veel)' : episode <= 15 ? 'Leert Obstakels' : 'Slimme Stofzuiger';

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs flex flex-col justify-between h-full">
      {/* Top Header Strip */}
      <div>
        <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-emerald-600 inline-block shadow-xs"></span>
            <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
              2. Zelflerend Systeem
            </h2>
          </div>
          <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200">
            Datagedreven / Trial & Error (Robotstofzuiger)
          </span>
        </div>

        {/* Roomba Simulation Viewport */}
        <div
          className={`relative aspect-[4/3] w-full max-w-[440px] mx-auto bg-slate-100/90 border-2 rounded-xl overflow-hidden shadow-inner transition-colors ${
            collisionFlash ? 'border-red-500 bg-red-50/20' : 'border-slate-300'
          }`}
        >
          <svg viewBox={`0 0 ${ROOM_WIDTH} ${ROOM_HEIGHT}`} className="w-full h-full select-none">
            {/* Floor tile pattern */}
            <defs>
              <pattern id="floorTiles" width="30" height="30" patternUnits="userSpaceOnUse">
                <rect width="30" height="30" fill="#f8fafc" stroke="#e2e8f0" strokeWidth="0.5" />
              </pattern>
            </defs>
            <rect width={ROOM_WIDTH} height={ROOM_HEIGHT} fill="url(#floorTiles)" />

            {/* Room Outer Border (Walls) */}
            <rect
              x="3"
              y="3"
              width={ROOM_WIDTH - 6}
              height={ROOM_HEIGHT - 6}
              fill="none"
              stroke="#475569"
              strokeWidth="6"
              rx="4"
            />

            {/* Furniture Obstacles */}
            {OBSTACLES.map((obs, idx) => (
              <g key={`obs_${idx}`}>
                {/* Shadow */}
                <rect
                  x={obs.x + 3}
                  y={obs.y + 3}
                  width={obs.w}
                  height={obs.h}
                  rx="6"
                  fill="#000000"
                  fillOpacity="0.12"
                />
                {/* Object */}
                <rect
                  x={obs.x}
                  y={obs.y}
                  width={obs.w}
                  height={obs.h}
                  rx="6"
                  fill={obs.color}
                  stroke="#334155"
                  strokeWidth="1.5"
                />
                <text
                  x={obs.x + obs.w / 2}
                  y={obs.y + obs.h / 2 + 3}
                  fill="#ffffff"
                  fontSize="9"
                  fontWeight="bold"
                  textAnchor="middle"
                >
                  {obs.label}
                </text>
              </g>
            ))}

            {/* Dust Particles */}
            {dust.map((d) => {
              if (d.cleaned) return null;
              return (
                <circle
                  key={`dust_${d.id}`}
                  cx={d.x}
                  cy={d.y}
                  r="2.5"
                  fill="#94a3b8"
                  className="transition-opacity duration-200"
                />
              );
            })}

            {/* Robot Vacuum */}
            <g transform={`translate(${robot.x}, ${robot.y})`}>
              {/* Drop shadow */}
              <circle cx="2" cy="2" r={ROBOT_RADIUS} fill="#000000" fillOpacity="0.2" />

              {/* Collision Impact Pulse */}
              {collisionFlash && (
                <circle
                  cx="0"
                  cy="0"
                  r={ROBOT_RADIUS + 8}
                  fill="none"
                  stroke="#dc2626"
                  strokeWidth="3"
                  className="animate-ping"
                />
              )}

              {/* Robot Body */}
              <circle
                cx="0"
                cy="0"
                r={ROBOT_RADIUS}
                fill="#0f172a"
                stroke="#334155"
                strokeWidth="2"
              />

              {/* Bumper Arc */}
              <path
                d={`M -${ROBOT_RADIUS - 1} 0 A ${ROBOT_RADIUS - 1} ${
                  ROBOT_RADIUS - 1
                } 0 0 1 ${ROBOT_RADIUS - 1} 0`}
                transform={`rotate(${(robot.angle * 180) / Math.PI + 90})`}
                fill="none"
                stroke={collisionFlash ? '#ef4444' : '#10b981'}
                strokeWidth="3"
              />

              {/* Center Status LED */}
              <circle
                cx="0"
                cy="0"
                r="4.5"
                fill={collisionFlash ? '#dc2626' : '#10b981'}
              />

              {/* Direction Indicator Notch */}
              <line
                x1="0"
                y1="0"
                x2={Math.cos(robot.angle) * 11}
                y2={Math.sin(robot.angle) * 11}
                stroke="#ffffff"
                strokeWidth="2.5"
                strokeLinecap="round"
              />
            </g>
          </svg>

          {/* Top Info Tag */}
          <div className="absolute top-2 left-2 flex items-center gap-2 text-[11px] font-semibold bg-white/95 px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
            <span className="text-slate-900 font-bold">Poging #{episode}</span>
            <span className="text-slate-400">·</span>
            <span className="text-emerald-700">{skillLabel}</span>
          </div>

          {/* Collision Flash Badge */}
          {collisionFlash && (
            <div className="absolute bottom-2 left-2 text-[11px] font-black bg-red-600 text-white px-2 py-0.5 rounded shadow-sm animate-bounce">
              BOEM! (Foutbepaling)
            </div>
          )}

          {/* Real-time KPI Tag */}
          <div className="absolute top-2 right-2 flex items-center gap-2 text-[11px] bg-white/95 px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs font-mono font-bold">
            <span className="text-red-600">Botsingen: {collisionsCount}</span>
            <span className="text-slate-300">|</span>
            <span className="text-emerald-600">Schoon: {cleanedPercent}%</span>
          </div>
        </div>

        {/* Live Mini Learning Curve: Collisions & Dirt */}
        <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
          <div className="flex items-center justify-between text-xs mb-1.5">
            <span className="font-bold text-slate-800">Leercurve over de tijd:</span>
            <div className="flex items-center gap-3 text-[11px]">
              <span className="flex items-center gap-1 text-red-600 font-semibold">
                <TrendingDown className="w-3 h-3" /> Botsingen ↓
              </span>
              <span className="flex items-center gap-1 text-emerald-600 font-semibold">
                <TrendingUp className="w-3 h-3" /> Schoonmaak ↑
              </span>
            </div>
          </div>

          {/* SVG Mini Curve */}
          <div className="h-16 w-full">
            <svg viewBox="0 0 320 64" className="w-full h-full">
              {/* Background grid */}
              <line x1="0" y1="32" x2="320" y2="32" stroke="#e2e8f0" strokeDasharray="3 3" />

              {/* Collisions Curve (Red, declining from ~16 to 0) */}
              <polyline
                fill="none"
                stroke="#dc2626"
                strokeWidth="2.5"
                strokeLinecap="round"
                points={learningHistory
                  .map((h, i) => {
                    const x = (i / Math.max(1, learningHistory.length - 1)) * 320;
                    // Collisions max 20 mapped to height 60
                    const y = Math.min(60, Math.max(4, 60 - (20 - h.collisions) * 3));
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />

              {/* Cleaning Curve (Green, rising from ~15% to 100%) */}
              <polyline
                fill="none"
                stroke="#059669"
                strokeWidth="2.5"
                strokeLinecap="round"
                points={learningHistory
                  .map((h, i) => {
                    const x = (i / Math.max(1, learningHistory.length - 1)) * 320;
                    const y = Math.min(60, Math.max(4, 60 - (h.cleanedPct / 100) * 52));
                    return `${x},${y}`;
                  })
                  .join(' ')}
              />
            </svg>
          </div>

          {/* Episode scrubber slider */}
          <div className="mt-2 flex items-center gap-2">
            <span className="text-[10px] text-slate-500 font-medium">Trainingsniveau:</span>
            <input
              type="range"
              min="1"
              max="50"
              value={episode}
              onChange={(e) => startNewEpisode(Number(e.target.value))}
              className="flex-1 accent-emerald-600 cursor-pointer h-1.5 bg-slate-200 rounded-lg"
            />
            <span className="text-[11px] font-mono font-bold text-emerald-800">#{episode}</span>
          </div>
        </div>
      </div>

      {/* Bottom Controls */}
      <div className="mt-4 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg text-white transition-colors cursor-pointer shadow-xs active:scale-95 ${
              isPlaying ? 'bg-amber-600 hover:bg-amber-700' : 'bg-emerald-600 hover:bg-emerald-700'
            }`}
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isPlaying ? 'Pauze' : 'Laat Leren'}</span>
          </button>

          <button
            onClick={() => {
              setLearningHistory([{ episode: 1, collisions: 16, cleanedPct: 18 }]);
              startNewEpisode(1);
            }}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors cursor-pointer"
            title="Wis trainingsgeheugen en start bij Poging 1"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Wis Geheugen</span>
          </button>
        </div>

        {/* Speed toggle */}
        <div className="flex items-center gap-1 text-xs">
          <span className="text-slate-500 text-[11px]">Snelheid:</span>
          {[1, 2, 4].map((s) => (
            <button
              key={s}
              onClick={() => setSpeedMultiplier(s)}
              className={`px-2 py-0.5 text-xs font-mono font-semibold rounded border transition-colors cursor-pointer ${
                speedMultiplier === s
                  ? 'bg-slate-900 text-white border-slate-900'
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
              }`}
            >
              {s}x
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};
