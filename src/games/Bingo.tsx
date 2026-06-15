import React, { useState, useEffect, useRef } from "react";
import { Play, RotateCcw, Volume2, Maximize2, Minimize2, Sparkles, AlertCircle } from "lucide-react";
import { speakPhrase } from "../speech";

interface BingoProps {
  playerId: string;
  opponentId: string | null;
  opponentDetails: { label: string; avatar: string } | null;
  gameState: any;
  onUpdateGame: (newState: any) => void;
  textScale: "normal" | "large" | "extra-large";
  activeGameSession?: any;
}

export default function Bingo({
  playerId,
  opponentId,
  opponentDetails,
  gameState,
  onUpdateGame,
  textScale,
  activeGameSession,
}: BingoProps) {
  const [board, setBoard] = useState<number[][]>([]);
  const [marked, setMarked] = useState<boolean[][]>(
    Array(5).fill(null).map(() => Array(5).fill(false))
  );
  const [calledNumbers, setCalledNumbers] = useState<number[]>([]);
  const [currentCall, setCurrentCall] = useState<string>("");
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isBingoClaimed, setIsBingoClaimed] = useState<boolean>(false);
  const [isCardMagnified, setIsCardMagnified] = useState<boolean>(false);

  const ttsRef = useRef<boolean>(true);

  // Generate standard B-I-N-G-O numbers: B: 1-15, I: 16-30, N: 31-45, G: 46-60, O: 61-75
  const generateCol = (min: number, max: number): number[] => {
    const list: number[] = [];
    while (list.length < 5) {
      const num = Math.floor(Math.random() * (max - min + 1)) + min;
      if (!list.includes(num)) {
        list.push(num);
      }
    }
    return list;
  };

  // Refs for tracking winner announcements and game resets
  const lastWinnerRef = useRef<string | null>(null);
  const wasEndedRef = useRef<boolean>(false);

  // Sync state if multiplayer
  useEffect(() => {
    if (opponentId && gameState) {
      if (gameState.calledNumbers) {
        // Find if game just reset from ended to active
        if (wasEndedRef.current && !gameState.winner) {
          speak("The game has been restarted! A new card has been prepared for you. Good luck!");
          generateNewCardLocal();
        }
        wasEndedRef.current = !!gameState.winner;

        setCalledNumbers(gameState.calledNumbers);
        if (gameState.calledNumbers.length > 0) {
          const lastNum = gameState.calledNumbers[gameState.calledNumbers.length - 1];
          const letter = getBingoLetter(lastNum);
          setCurrentCall(`${letter}-${lastNum}`);
        } else {
          setCurrentCall("");
        }
      }

      if (gameState.winner) {
        setIsBingoClaimed(true);
        setIsPlaying(false);
        if (lastWinnerRef.current !== gameState.winner) {
          lastWinnerRef.current = gameState.winner;
          if (gameState.winner !== playerId) {
            speak(`Room ${gameState.winnerName || "Your partner"} has declared BINGO! Fabulous game!`);
          }
        }
      } else {
        setIsBingoClaimed(false);
        lastWinnerRef.current = null;
      }
    }
  }, [gameState, opponentId]);

  const generateNewCardLocal = () => {
    const columns = [
      generateCol(1, 15),
      generateCol(16, 30),
      generateCol(31, 45),
      generateCol(46, 60),
      generateCol(61, 75),
    ];
    
    // Construct 5x5 board
    const card: number[][] = [];
    for (let r = 0; r < 5; r++) {
      const row: number[] = [];
      for (let c = 0; c < 5; c++) {
        if (r === 2 && c === 2) {
          row.push(0); // Free space
        } else {
          row.push(columns[c][r]);
        }
      }
      card.push(row);
    }

    const initialMarked = Array(5).fill(null).map(() => Array(5).fill(false));
    initialMarked[2][2] = true; // Free space is always marked!

    setBoard(card);
    setMarked(initialMarked);
    setCalledNumbers([]);
    setCurrentCall("");
    setIsBingoClaimed(false);
    setIsPlaying(false);
  };

  const generateNewCard = () => {
    generateNewCardLocal();

    if (opponentId) {
      onUpdateGame({
        calledNumbers: [],
        started: true,
        callerActive: true,
        winner: null,
        winnerName: null,
        statusMessage: "New Bingo match started!",
        ended: false,
      });
    }
  };

  useEffect(() => {
    generateNewCardLocal();
  }, []);

  const getBingoLetter = (num: number): string => {
    if (num <= 15) return "B";
    if (num <= 30) return "I";
    if (num <= 45) return "N";
    if (num <= 60) return "G";
    return "O";
  };

  // Announce sound
  const speak = (phrase: string) => {
    speakPhrase(phrase, ttsRef.current);
  };

  // Caller Loop for Solo
  useEffect(() => {
    let interval: any = null;
    if (isPlaying && !opponentId && calledNumbers.length < 75 && !isBingoClaimed) {
      interval = setInterval(() => {
        // Find unused numbers
        const pool: number[] = [];
        for (let i = 1; i <= 75; i++) {
          if (!calledNumbers.includes(i)) {
            pool.push(i);
          }
        }

        if (pool.length === 0) {
          setIsPlaying(false);
          return;
        }

        const picked = pool[Math.floor(Math.random() * pool.length)];
        const letter = getBingoLetter(picked);
        const newCalled = [...calledNumbers, picked];
        
        setCalledNumbers(newCalled);
        setCurrentCall(`${letter}-${picked}`);
        speak(`${letter}... ${picked}!`);
      }, 5500); // Friendly pace for seniors
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isPlaying, calledNumbers, opponentId, isBingoClaimed]);

  const toggleSquare = (r: number, c: number) => {
    if (r === 2 && c === 2) return; // Free Space always marked
    if (isBingoClaimed || (gameState && gameState.winner)) {
      speak("The game is already finished!");
      return;
    }
    const val = board[r][c];

    // Check if the number has actually been called.
    const isCalled = calledNumbers.includes(val);
    if (!isCalled && opponentId) {
      // In multiplayer, must be called to be dabbed
      speak("Number has not been called yet!");
      return;
    }

    const updated = marked.map((rowArr, ri) =>
      rowArr.map((cell, ci) => (ri === r && ci === c ? !cell : cell))
    );
    setMarked(updated);
    speak(isCalled ? `Marked ${val}` : `Selected ${val}`);
  };

  const handleNextCallLocal = () => {
    if (opponentId || isBingoClaimed || (gameState && gameState.winner)) return; // Managed by Multiplayer server actions or client host
    const pool: number[] = [];
    for (let i = 1; i <= 75; i++) {
      if (!calledNumbers.includes(i)) {
        pool.push(i);
      }
    }

    if (pool.length === 0) return;

    const picked = pool[Math.floor(Math.random() * pool.length)];
    const letter = getBingoLetter(picked);
    const newCalled = [...calledNumbers, picked];
    
    setCalledNumbers(newCalled);
    setCurrentCall(`${letter}-${picked}`);
    speak(`${letter}... ${picked}!`);
  };

  // Multi-player Call Number (Both can sync it or HOST calls)
  const handleMultiplayerCall = () => {
    if (!(opponentId || activeGameSession) || isBingoClaimed || (gameState && gameState.winner)) return;
    const pool: number[] = [];
    for (let i = 1; i <= 75; i++) {
      if (!calledNumbers.includes(i)) {
        pool.push(i);
      }
    }

    if (pool.length === 0) return;
    const picked = pool[Math.floor(Math.random() * pool.length)];
    const newCalled = [...calledNumbers, picked];

    // Optimistically update locally so player can mark it immediately
    setCalledNumbers(newCalled);
    const letter = getBingoLetter(picked);
    setCurrentCall(`${letter}-${picked}`);

    const nextState = {
      ...gameState,
      calledNumbers: newCalled,
      lastCaller: playerId,
    };
    onUpdateGame(nextState);
    speak(`${letter}... ${picked}!`);
  };

  // Highlight check
  const checkWinCondition = (): boolean => {
    if (board.length === 0) return false;
    const isSquareWon = (r: number, c: number): boolean => {
      if (r === 2 && c === 2) return true; // Free Space always counts as won
      const val = board[r][c];
      return marked[r][c] || calledNumbers.includes(val);
    };

    // Rows
    for (let r = 0; r < 5; r++) {
      let rowComplete = true;
      for (let c = 0; c < 5; c++) {
        if (!isSquareWon(r, c)) {
          rowComplete = false;
          break;
        }
      }
      if (rowComplete) return true;
    }
    // Columns
    for (let c = 0; c < 5; c++) {
      let colComplete = true;
      for (let r = 0; r < 5; r++) {
        if (!isSquareWon(r, c)) {
          colComplete = false;
          break;
        }
      }
      if (colComplete) return true;
    }
    // Diagonals
    let diag1 = true;
    let diag2 = true;
    for (let i = 0; i < 5; i++) {
      if (!isSquareWon(i, i)) diag1 = false;
      if (!isSquareWon(i, 4 - i)) diag2 = false;
    }
    return diag1 || diag2;
  };

  // Auto-pause caller when a Bingo win is detected
  useEffect(() => {
    if (isPlaying && board.length > 0 && !isBingoClaimed && !(gameState && gameState.winner)) {
      const hasWon = checkWinCondition();
      if (hasWon) {
        setIsPlaying(false);
        speak("Bingo! A complete line is ready. Tap the CLAIM BINGO button to claim your victory!");
      }
    }
  }, [isPlaying, board, marked, calledNumbers, isBingoClaimed, gameState]);

  const claimBingo = () => {
    if (isBingoClaimed || (gameState && gameState.winner)) return;
    const hasWon = checkWinCondition();
    if (hasWon) {
      setIsBingoClaimed(true);
      setIsPlaying(false);
      speak("BINGO! You won! Outstanding job.");
      if (opponentId) {
        onUpdateGame({
          ...gameState,
          winner: playerId,
          winnerName: `Room ${playerId.split("-")[0]}`,
          statusMessage: `Room ${playerId.split("-")[0]} gets BINGO!`,
          ended: true,
        });
      }
    } else {
      speak("Not a full Bingo yet. Check your numbers carefully! Keep looking.");
    }
  };

  const sizeClass = 
    textScale === "extra-large" 
      ? "text-4xl" 
      : textScale === "large" 
      ? "text-3xl" 
      : "text-2xl";

  const btnTextSize = 
    textScale === "extra-large" 
      ? "text-2xl" 
      : textScale === "large" 
      ? "text-xl" 
      : "text-lg";

  return (
    <div className="flex flex-col gap-6 md:gap-8 max-w-5xl mx-auto p-4 bg-slate-50 rounded-2xl border-4 border-slate-900 shadow-xl text-slate-900">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b-4 border-slate-900 pb-4 gap-4">
        <div>
          <h2 className={`${sizeClass} font-black tracking-tight flex items-center gap-2`}>
            🍀 Senior Bingo Lobbies
          </h2>
          <div className="text-sm font-semibold opacity-85 mt-1">
            {activeGameSession?.players && activeGameSession.players.length > 1 ? (
              <div className="flex flex-wrap gap-1.5 items-center mt-1">
                <span className="text-xs uppercase font-extrabold tracking-wider bg-slate-200 text-slate-800 px-2 py-0.5 rounded">Bingo Group:</span>
                {activeGameSession.players.map((pid: string) => {
                  const pDet = activeGameSession.playerDetails[pid] || { label: `Room ${pid.split("-")[0]}`, avatar: "👤" };
                  return (
                    <span key={pid} className="inline-flex items-center gap-1 bg-white px-2 py-1 rounded-lg shadow-sm border border-slate-300 text-xs">
                      <span>{pDet.avatar}</span>
                      <span className="font-bold text-slate-900">{pDet.label} {pid === playerId ? "(You)" : ""}</span>
                    </span>
                  );
                })}
              </div>
            ) : opponentId ? (
              `Playing against: Room ${opponentId.split("-")[0]} Bed ${opponentId.split("-")[1]}`
            ) : (
              "Solo Mode with automated friendly numbers caller."
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            id="bingo-magnify-btn"
            onClick={() => setIsCardMagnified(!isCardMagnified)}
            className="flex items-center gap-2 bg-zinc-200 border-4 border-zinc-900 px-4 py-2 rounded-xl font-bold hover:bg-zinc-300 transition-colors cursor-pointer"
          >
            {isCardMagnified ? <Minimize2 size={24} /> : <Maximize2 size={24} />}
            <span className={btnTextSize}>
              {isCardMagnified ? "Shrink Size" : "Magnify Card"}
            </span>
          </button>

          <button
            id="bingo-sounds-btn"
            onClick={() => {
              ttsRef.current = !ttsRef.current;
              speak(ttsRef.current ? "Volume is ON" : "");
              // force re-render
              setCurrentCall((c) => c);
            }}
            className={`flex items-center gap-2 border-4 px-4 py-2 rounded-xl font-bold hover:opacity-90 transition-colors cursor-pointer ${
              ttsRef.current 
                ? "bg-emerald-200 border-emerald-950 text-emerald-950" 
                : "bg-red-200 border-red-950 text-red-950"
            }`}
          >
            <Volume2 size={24} />
            <span className={btnTextSize}>
              {ttsRef.current ? "Voice: Speaking" : "Voice: Muted"}
            </span>
          </button>
        </div>
      </div>

      {/* GRAND VICTORY CELEBRATION CARD */}
      {(isBingoClaimed || (gameState && gameState.winner)) && (
        <div className="bg-amber-100 border-8 border-amber-500 rounded-3xl p-6 text-center shadow-xl animate-bounce">
          <span className="text-6xl md:text-8xl block select-none mb-4" role="img" aria-label="trophies and confetti">🏆🎉🍀</span>
          <h3 className="text-3xl md:text-5xl font-black text-amber-950 uppercase tracking-tight">
            Bingo Game Completed!
          </h3>
          <p className="text-xl md:text-2xl font-bold text-amber-900 mt-2">
            {gameState && gameState.winner
              ? gameState.winner === playerId
                ? "⭐ Congratulations! You claimed BINGO and won! Outstanding play! ⭐"
                : `⭐ Room ${gameState.winnerName || "Your partner"} declared BINGO! Fabulous game! ⭐`
              : "⭐ Fantastic! You won the Bingo match! ⭐"}
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <button
              onClick={generateNewCard}
              className="bg-amber-500 text-amber-950 hover:bg-amber-400 border-4 border-amber-950 font-black uppercase px-6 py-3 rounded-xl transition cursor-pointer text-lg shadow-md"
            >
              🔄 Play Again / Reset Card
            </button>
          </div>
        </div>
      )}

      {/* GAME RUN PANEL */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* LEFT COLUMN: ACTIVE BINGO CALLER */}
        <div className="lg:col-span-4 flex flex-col gap-4 bg-yellow-100 border-4 border-yellow-800 rounded-xl p-4 md:p-6 text-center">
          <span className="text-sm font-bold tracking-widest text-yellow-905 uppercase">
            📢 Active Game Caller
          </span>
          
          <div className="my-2 bg-yellow-50 border-4 border-yellow-800 rounded-xl py-6 px-2 shadow-inner">
            {currentCall ? (
              <div className="flex flex-col items-center justify-center">
                <span className="text-8xl font-black text-yellow-950 tracking-tight select-none">
                  {currentCall}
                </span>
                <span className="text-lg font-bold text-yellow-800 mt-2">
                  Have you marked this?
                </span>
              </div>
            ) : (
              <span className="text-xl font-bold text-yellow-700 italic block py-4">
                No number called yet
              </span>
            )}
          </div>

          <div className="flex flex-col gap-2">
            {!opponentId ? (
              // SOLO CONTROLS
              <>
                <button
                  id="bingo-call-next"
                  onClick={handleNextCallLocal}
                  disabled={isBingoClaimed}
                  className="w-full bg-slate-900 text-white border-4 border-slate-950 py-3 rounded-xl font-black text-xl hover:bg-slate-850 active:bg-slate-800 transition shadow cursor-pointer disabled:opacity-50"
                >
                  📞 Call Next Number
                </button>
                <button
                  id="bingo-play-pause"
                  onClick={() => setIsPlaying(!isPlaying)}
                  disabled={isBingoClaimed}
                  className={`w-full flex items-center justify-center gap-2 border-4 py-3 rounded-xl font-black text-xl transition shadow cursor-pointer ${
                    isPlaying 
                      ? "bg-red-300 border-red-950 text-red-950" 
                      : "bg-emerald-300 border-emerald-950 text-emerald-950"
                  } disabled:opacity-50`}
                >
                  <Play size={20} />
                  {isPlaying ? "Pause Caller" : "Start Auto-Caller"}
                </button>
              </>
            ) : (
              // MULTIPlayer Caller trigger (anyone can tap to draw next number)
              <button
                id="bingo-caller-mult"
                onClick={handleMultiplayerCall}
                disabled={isBingoClaimed || (gameState && !!gameState.winner)}
                className="w-full bg-slate-900 text-white border-4 border-slate-950 py-3 rounded-xl font-black text-xl hover:bg-slate-850 active:bg-slate-905 transition shadow cursor-pointer disabled:opacity-40"
              >
                🔔 Draw Shared Number
              </button>
            )}

            <button
              id="bingo-reset-card"
              onClick={generateNewCard}
              className="w-full flex items-center justify-center gap-2 bg-zinc-100 border-4 border-zinc-900 py-2 rounded-xl font-bold hover:bg-zinc-200 cursor-pointer"
            >
              <RotateCcw size={16} />
              Reset Bingo Card
            </button>
          </div>

          {/* HISTORIC LOG OF LAST CALLS */}
          <div className="mt-4 text-left border-t-2 border-yellow-800 pt-3">
            <span className="text-xs font-black uppercase text-yellow-905 block mb-2">
              Recent Calls:
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
              {calledNumbers.slice(-6).reverse().map((num, idx) => (
                <span
                  key={idx}
                  className="bg-yellow-250 border border-yellow-800 text-yellow-950 rounded-lg px-2 py-0.5 font-bold text-xs"
                >
                  {getBingoLetter(num)}-{num}
                </span>
              ))}
              {calledNumbers.length === 0 && (
                <span className="text-xs italic text-yellow-800">None yet</span>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: THE BINGO GRID */}
        <div className="lg:col-span-8 flex flex-col gap-4">
          {/* Header B-I-N-G-O labels */}
          <div className="grid grid-cols-5 gap-2 text-center text-slate-500">
            {["B", "I", "N", "G", "O"].map((letter) => (
              <span
                key={letter}
                className="text-2xl md:text-4xl font-extrabold text-slate-800 tracking-tight"
              >
                {letter}
              </span>
            ))}
          </div>

          {/* Core Card Grid */}
          <div
            className={`grid grid-cols-5 gap-2 md:gap-3 bg-white border-4 border-slate-900 p-3 rounded-2xl shadow-md ${
              isCardMagnified ? "p-4 md:p-6" : ""
            }`}
          >
            {board.map((row, rIdx) =>
              row.map((val, cIdx) => {
                const isFree = rIdx === 2 && cIdx === 2;
                const isDabbed = marked[rIdx][cIdx];
                const wasCalled = calledNumbers.includes(val);

                return (
                  <button
                    key={`${rIdx}-${cIdx}`}
                    id={`bingo-cell-${rIdx}-${cIdx}`}
                    onClick={() => toggleSquare(rIdx, cIdx)}
                    disabled={isBingoClaimed || (gameState && !!gameState.winner)}
                    className={`relative aspect-square flex flex-col items-center justify-center rounded-xl p-1 md:p-2 border-4 transition-all scale-100 active:scale-95 cursor-pointer font-black ${
                      isFree
                        ? "bg-rose-100 border-rose-800 text-rose-850"
                        : isDabbed
                        ? "bg-emerald-300 border-emerald-900 text-emerald-950 shadow-inner"
                        : wasCalled
                        ? "bg-amber-100 border-dashed border-amber-500 text-slate-900 hover:bg-amber-200"
                        : "bg-slate-100 border-slate-350 text-slate-900 hover:bg-slate-200"
                    } ${
                      isCardMagnified
                        ? "text-3xl md:text-5xl border-6"
                        : "text-xl md:text-3xl"
                    } disabled:cursor-not-allowed`}
                  >
                    {isFree ? (
                      <span className="flex flex-col items-center">
                        <Sparkles className="w-5 h-5 md:w-8 md:h-8 mb-0.5 text-rose-600 animate-pulse" />
                        <span className="text-[10px] md:text-xs font-black uppercase tracking-wider">
                          FREE
                        </span>
                      </span>
                    ) : (
                      val
                    )}

                    {/* Notification Dot: If number is called but not yet marked */}
                    {!isFree && wasCalled && !isDabbed && !(isBingoClaimed || (gameState && !!gameState.winner)) && (
                      <div className="absolute top-1 right-1 w-2.5 h-2.5 md:w-4 md:h-4 bg-yellow-500 border-2 border-slate-900 rounded-full animate-bounce" />
                    )}
                  </button>
                );
              })
            )}
          </div>

          {/* ACTIVE STATUS ALERTS */}
          {gameState && gameState.winner && (
            <div className="p-4 bg-emerald-100 border-4 border-emerald-800 rounded-xl flex items-center gap-3">
              <Sparkles className="text-emerald-700 w-8 h-8 flex-shrink-0" />
              <span className="text-lg font-black text-emerald-900">
                ⭐ {gameState.winner === playerId ? "You got BINGO! Victory matches complete!" : `${gameState.winnerName} got BINGO! Fabulous play!`}
              </span>
            </div>
          )}

          {/* BINGO TRIGGER BUTTON */}
          <div className="mt-2">
            <button
              id="bingo-claim-trigger"
              onClick={claimBingo}
              disabled={isBingoClaimed || (gameState && !!gameState.winner)}
              className={`w-full relative py-6 rounded-2xl border-4 text-center font-black uppercase shadow-lg select-none flex items-center justify-center gap-4 cursor-pointer scale-100 hover:scale-[1.02] active:scale-95 transition-all text-3xl md:text-5xl ${
                checkWinCondition() && !isBingoClaimed && !(gameState && !!gameState.winner)
                  ? "bg-rose-500 border-rose-950 text-white animate-pulse"
                  : "bg-zinc-250 border-zinc-900 text-zinc-500 hover:bg-zinc-300 disabled:opacity-50"
              }`}
            >
              {isBingoClaimed || (gameState && !!gameState.winner) ? "🏆 BINGO CLAIMED! 🏆" : "🎉 CLAIM BINGO! 🍀"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
