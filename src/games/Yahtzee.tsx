import React, { useState, useEffect } from "react";
import { RotateCcw, AlertCircle, HelpCircle, Dices, Sparkles } from "lucide-react";
import { speakPhrase } from "../speech";

interface YahtzeeProps {
  playerId: string;
  opponentId: string | null;
  opponentDetails: { label: string; avatar: string } | null;
  gameState: any;
  onUpdateGame: (newState: any) => void;
  textScale: "normal" | "large" | "extra-large";
  activeGameSession?: any;
}

type ScoreCard = { [category: string]: number | null };

const CATEGORIES = [
  { id: "ones", name: "Ones (1s)", desc: "Sum of all 1s" },
  { id: "twos", name: "Twos (2s)", desc: "Sum of all 2s" },
  { id: "threes", name: "Threes (3s)", desc: "Sum of all 3s" },
  { id: "fours", name: "Fours (4s)", desc: "Sum of all 4s" },
  { id: "fives", name: "Fives (5s)", desc: "Sum of all 5s" },
  { id: "sixes", name: "Sixes (6s)", desc: "Sum of all 6s" },
  { id: "threeOfAKind", name: "Three of a Kind", desc: "Sum of all dice if 3 match" },
  { id: "fourOfAKind", name: "Four of a Kind", desc: "Sum of all dice if 4 match" },
  { id: "fullHouse", name: "Full House (25 pts)", desc: "3 of one, 2 of another" },
  { id: "smallStraight", name: "Small Straight (30 pts)", desc: "4 numbers in a row" },
  { id: "largeStraight", name: "Large Straight (40) pts", desc: "5 numbers in a row" },
  { id: "yahtzee", name: "YAHTZEE (50 pts)", desc: "All 5 dice match!" },
  { id: "chance", name: "Chance", desc: "Sum of all 5 dice" },
];

export default function Yahtzee({
  playerId,
  opponentId,
  opponentDetails,
  gameState,
  onUpdateGame,
  textScale,
  activeGameSession,
}: YahtzeeProps) {
  const [dice, setDice] = useState<number[]>([1, 1, 1, 1, 1]);
  const [held, setHeld] = useState<boolean[]>([false, false, false, false, false]);
  const [rollCount, setRollCount] = useState<number>(0);
  const [scoreCard, setScoreCard] = useState<ScoreCard>({});
  const [opponentScoreCard, setOpponentScoreCard] = useState<ScoreCard>({});
  const [turn, setTurn] = useState<string>("");
  const [winner, setWinner] = useState<string | null>(null);

  // Find which player's turn is next in Yahtzee
  const getNextPlayerTurn = (): string => {
    if (activeGameSession && activeGameSession.players.length > 1) {
      const idx = activeGameSession.players.indexOf(playerId);
      if (idx !== -1) {
        const nextIdx = (idx + 1) % activeGameSession.players.length;
        return activeGameSession.players[nextIdx];
      }
    }
    return opponentId || "computer";
  };

  const initGameLocal = () => {
    setDice([1, 1, 1, 1, 1]);
    setHeld([false, false, false, false, false]);
    setRollCount(0);
    const blankCard: ScoreCard = {};
    CATEGORIES.forEach((cat) => {
      blankCard[cat.id] = null;
    });

    setScoreCard(blankCard);
    setOpponentScoreCard(blankCard);
    setWinner(null);
    setTurn(playerId);
    speak("Yahtzee initialized! Roll your five dice to start!");

    if (opponentId) {
      onUpdateGame({
        dice: [1, 1, 1, 1, 1],
        held: [false, false, false, false, false],
        rollCount: 0,
        scores: {
          [playerId]: blankCard,
          [opponentId]: blankCard,
        },
        turn: playerId,
        ended: false,
        winner: null,
      });
    }
  };

  useEffect(() => {
    initGameLocal();
  }, [opponentId]);

  // Sync state if multiplayer
  useEffect(() => {
    if ((opponentId || activeGameSession) && gameState) {
      if (gameState.dice) setDice(gameState.dice);
      if (gameState.held) setHeld(gameState.held);
      if (gameState.rollCount !== undefined) setRollCount(gameState.rollCount);
      if (gameState.turn) setTurn(gameState.turn);
      if (gameState.winner) setWinner(gameState.winner);
 
      if (gameState.scores) {
        if (gameState.scores[playerId]) {
          setScoreCard(gameState.scores[playerId]);
        }
        
        // Populate opponent dynamically of first active non-self player
        if (activeGameSession && activeGameSession.players.length > 1) {
          const otherId = activeGameSession.players.find((pid: string) => pid !== playerId);
          if (otherId && gameState.scores[otherId]) {
            setOpponentScoreCard(gameState.scores[otherId]);
          }
        } else if (opponentId && gameState.scores[opponentId]) {
          setOpponentScoreCard(gameState.scores[opponentId]);
        }
      }
    }
  }, [gameState, opponentId, activeGameSession]);

  const speak = (phrase: string) => {
    speakPhrase(phrase, true);
  };

  const rollDice = () => {
    if (winner) return;
    if (opponentId && turn !== playerId) {
      speak("Patience! It is your opponent's turn to roll.");
      return;
    }
    if (activeGameSession && activeGameSession.players.length > 1 && turn !== playerId) {
      speak("Patience! It is another player's turn to roll.");
      return;
    }
    if (rollCount >= 3) {
      speak("No rolls left this turn. You must lock in a score categories tab below.");
      return;
    }

    const newDice = dice.map((d, index) => {
      if (held[index]) return d;
      return Math.floor(Math.random() * 6) + 1;
    });

    const newRollCount = rollCount + 1;

    setDice(newDice);
    setRollCount(newRollCount);
    speak(`Rolling... got ${newDice.join(", ")}`);

    // If multiplayer
    if (opponentId || (activeGameSession && activeGameSession.players.length > 1)) {
      onUpdateGame({
        ...gameState,
        dice: newDice,
        rollCount: newRollCount,
      });
    }
  };

  const toggleHold = (index: number) => {
    if (rollCount === 0) {
      speak("Roll first before holding.");
      return;
    }
    const updated = held.map((h, i) => (i === index ? !h : h));
    setHeld(updated);
    speak(updated[index] ? `Held die ${index + 1}` : `Released die ${index + 1}`);

    // If multiplayer
    if (opponentId || (activeGameSession && activeGameSession.players.length > 1)) {
      onUpdateGame({
        ...gameState,
        held: updated,
      });
    }
  };

  // Score Calculator Helpers
  const calculatePoints = (catId: string, currentDice: number[]): number => {
    const counts: { [num: number]: number } = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0 };
    let sum = 0;
    currentDice.forEach((d) => {
      counts[d] = (counts[d] || 0) + 1;
      sum += d;
    });

    switch (catId) {
      case "ones":
        return (counts[1] || 0) * 1;
      case "twos":
        return (counts[2] || 0) * 2;
      case "threes":
        return (counts[3] || 0) * 3;
      case "fours":
        return (counts[4] || 0) * 4;
      case "fives":
        return (counts[5] || 0) * 5;
      case "sixes":
        return (counts[6] || 0) * 6;
      case "threeOfAKind": {
        const has3 = Object.values(counts).some((c) => c >= 3);
        return has3 ? sum : 0;
      }
      case "fourOfAKind": {
        const has4 = Object.values(counts).some((c) => c >= 4);
        return has4 ? sum : 0;
      }
      case "fullHouse": {
        const valuesArr = Object.values(counts);
        const has3 = valuesArr.includes(3);
        const has2 = valuesArr.includes(2);
        const isYahtzee = valuesArr.includes(5);
        return (has3 && has2) || isYahtzee ? 25 : 0;
      }
      case "smallStraight": {
        const unique = Array.from(new Set(currentDice)).sort().join("");
        if (
          unique.includes("1234") ||
          unique.includes("2345") ||
          unique.includes("3456")
        ) {
          return 30;
        }
        return 0;
      }
      case "largeStraight": {
        const unique = Array.from(new Set(currentDice)).sort().join("");
        if (unique === "12345" || unique === "23456") return 40;
        return 0;
      }
      case "yahtzee": {
        const has5 = Object.values(counts).some((c) => c === 5);
        return has5 ? 50 : 0;
      }
      case "chance":
        return sum;
      default:
        return 0;
    }
  };

  const claimCategory = (catId: string) => {
    if (winner) return;
    if ((opponentId || (activeGameSession && activeGameSession.players.length > 1)) && turn !== playerId) {
      speak("Wait for enemy turn.");
      return;
    }
    if (rollCount === 0) {
      speak("You must roll at least once before scoring!");
      return;
    }
    if (scoreCard[catId] !== null) {
      speak("This category is already scored. Please select an empty row.");
      return;
    }

    const pointsEarned = calculatePoints(catId, dice);
    const updatedCard = {
      ...scoreCard,
      [catId]: pointsEarned,
    };

    setScoreCard(updatedCard);
    speak(`Scored ${pointsEarned} points under Category.`);

    // Reset Turn parameters
    setDice([1, 1, 1, 1, 1]);
    setHeld([false, false, false, false, false]);
    setRollCount(0);

    // Turn handover/Completion check
    const isLocalFinished = Object.values(updatedCard).every((v) => v !== null);

    if (opponentId || (activeGameSession && activeGameSession.players.length > 1)) {
      const allScores = {
        ...gameState.scores,
        [playerId]: updatedCard,
      };

      const nextTurn = getNextPlayerTurn();

      // Check if everyone has completed all 13 scorecard slots
      const activePlayersList = activeGameSession ? activeGameSession.players : [playerId, opponentId].filter(Boolean);
      const isEveryoneFinished = activePlayersList.every((pid: string) => {
        const card = allScores[pid] || {};
        const vals = Object.values(card);
        return vals.length >= 13 && vals.every((v) => v !== null && v !== undefined);
      });

      let nextWinner: string | null = null;
      if (isEveryoneFinished) {
        // Find player with maximum score
        let maxScore = -1;
        let bestPlayer = null;
        activePlayersList.forEach((pid: string) => {
          const sum = sumScores(allScores[pid] || {});
          if (sum > maxScore) {
            maxScore = sum;
            bestPlayer = pid;
          }
        });
        nextWinner = bestPlayer;
        setWinner(nextWinner);
        speak(nextWinner === playerId ? "Match completed! You won Yahtzee!" : "Match finished! Another player scored higher.");
      }

      onUpdateGame({
        ...gameState,
        dice: [1, 1, 1, 1, 1],
        held: [false, false, false, false, false],
        rollCount: 0,
        scores: allScores,
        turn: nextTurn, // hand over turn
        winner: nextWinner,
        ended: !!nextWinner,
        statusMessage: nextWinner 
          ? `Lobby completed! Winner is Room ${nextWinner.split("-")[0]}`
          : `Room ${playerId.split("-")[0]} scored. Now: Room ${nextTurn.split("-")[0]}'s turn.`,
      });
    } else {
      if (isLocalFinished) {
        setWinner(playerId);
        speak(`Game Completed! Your total score is ${sumScores(updatedCard)}! Amazing!`);
      }
    }
  };

  const sumScores = (sc: ScoreCard): number => {
    let total = 0;
    Object.values(sc).forEach((v) => {
      if (v !== null) total += v;
    });
    return total;
  };

  const sizeClass = textScale === "extra-large" ? "text-4xl" : textScale === "large" ? "text-3xl" : "text-2xl";
  const labelTextSize = textScale === "extra-large" ? "text-3xl" : textScale === "large" ? "text-2xl" : "text-lg";

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto p-4 bg-slate-50 rounded-2xl border-4 border-slate-900 shadow-xl text-slate-900">
      
      {/* DICE YAHTZEE GAME TITLE */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b-4 border-slate-900 pb-4 gap-4">
        <div>
          <h2 className={`${sizeClass} font-black tracking-tight flex items-center gap-2`}>
            🎲 Senior Yahtzee Dice Match
          </h2>
          <p className="text-sm font-semibold opacity-85 mt-1">
            {activeGameSession?.players && activeGameSession.players.length > 1 ? (
              <span className="flex flex-wrap gap-1.5 items-center mt-1">
                <span className="text-xs uppercase font-extrabold tracking-wider bg-slate-200 text-slate-800 px-2 py-0.5 rounded">Yahtzee Group:</span>
                {activeGameSession.players.map((pid: string) => {
                  const pDet = activeGameSession.playerDetails[pid] || { label: `Room ${pid.split("-")[0]}`, avatar: "👤" };
                  return (
                    <span key={pid} className="inline-flex items-center gap-1 bg-white px-2 py-1 rounded-lg shadow-sm border border-slate-300 text-xs">
                      <span>{pDet.avatar}</span>
                      <span className="font-bold text-slate-900">{pDet.label} {pid === playerId ? "(You)" : ""}</span>
                    </span>
                  );
                })}
              </span>
            ) : opponentId ? (
              `Playing vs Room opponent ${opponentDetails?.label}` 
            ) : (
              "Solo Practice. Roll to complete scorecard categories."
            )}
          </p>
        </div>

        <button
          onClick={initGameLocal}
          id="yahtzee-restart-btn"
          className="flex items-center gap-2 bg-zinc-200 border-4 border-zinc-900 px-4 py-2 rounded-xl font-bold hover:bg-zinc-300 transition-colors cursor-pointer"
        >
          <RotateCcw size={20} />
          Restart Game
        </button>
      </div>

      {/* DIE ROLL COUNTERS AND HOVER PANEL */}
      <div className="grid grid-cols-1 bg-zinc-100 border-4 border-zinc-900 p-4 rounded-xl gap-4">
        
        {/* Unified Score Leaderboard */}
        <div className="border-b border-zinc-300 pb-3">
          <span className="text-xs font-black uppercase text-slate-500 block mb-2">🏆 Room Score Leaderboard:</span>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
            <div className="bg-white p-2 rounded-lg border-2 border-slate-350 text-center">
              <span className="text-[10px] font-black block text-emerald-850">👋 Me (Total)</span>
              <span className="text-xl font-black text-emerald-850">{sumScores(scoreCard)} pts</span>
            </div>
            {activeGameSession?.players && activeGameSession.players.length > 1 ? (
              activeGameSession.players.filter((pid: string) => pid !== playerId).map((pid: string) => {
                const pDet = activeGameSession.playerDetails[pid] || { label: `Room ${pid}`, avatar: "👤" };
                const pScores = gameState?.scores?.[pid] || {};
                const isHisTurn = turn === pid;
                return (
                  <div key={pid} className={`p-2 rounded-lg border-2 text-center transition-all ${isHisTurn ? "border-amber-500 bg-amber-50" : "border-slate-350 bg-white"}`}>
                    <span className="text-[10px] font-bold block text-slate-700 leading-none truncate flex items-center justify-center gap-1">
                      <span>{pDet.avatar}</span>
                      <span>{pDet.label.split(" ")[1] || pDet.label}</span>
                      {isHisTurn && <span className="text-[8px] bg-amber-500 text-white font-black px-1 rounded animate-pulse">TURN</span>}
                    </span>
                    <span className="text-xl font-black text-rose-850">{sumScores(pScores)} pts</span>
                  </div>
                );
              })
            ) : opponentId ? (
              <div className="bg-white p-2 rounded-lg border-2 border-slate-350 text-center">
                <span className="text-[10px] font-black block text-rose-850">🤖 Opponent</span>
                <span className="text-xl font-black text-rose-800">{sumScores(opponentScoreCard)} pts</span>
              </div>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex gap-4 font-black">
            <span className="text-lg uppercase">Rolls: <span className="text-rose-800">{rollCount}/3</span></span>
            <span className="text-lg uppercase">Turn owner: <span className="text-blue-800">{turn === playerId ? "YOURS" : "WAITING"}</span></span>
          </div>

          <div className="flex justify-end gap-2">
            {(opponentId || (activeGameSession && activeGameSession.players.length > 1)) && turn !== playerId ? (
              <span className="bg-slate-300 border-2 border-slate-400 font-extrabold px-3 py-1.5 rounded-lg text-sm animate-pulse">
                ⏳ Waiting for client turn play...
              </span>
            ) : (
              <button
                id="yahtzee-roll-btn"
                onClick={rollDice}
                disabled={rollCount >= 3 || !!winner}
                className="bg-emerald-500 text-white border-3 border-emerald-950 font-black px-6 py-2.5 rounded-xl text-base cursor-pointer hover:bg-emerald-600 active:scale-95 disabled:opacity-50 transition"
              >
                🎲 ROLL DICE!
              </button>
            )}
          </div>
        </div>
      </div>

      {/* WINNER CONDUIT CHIPS */}
      {winner && (
        <div className="p-4 bg-emerald-100 border-4 border-emerald-800 rounded-xl text-center">
          <span className="text-xl font-black text-emerald-950 block">
            ⭐ {winner === playerId ? "Match Complete! You win with superior combinations!" : "Match Complete! Play again to beat that score!"}
          </span>
        </div>
      )}

      {/* FIVE FIVE DICE PANEL */}
      <div className="border-4 border-slate-900 bg-white p-4 rounded-xl">
        <span className="text-xs font-black uppercase text-slate-500 block text-center mb-3">
          🎲 TAP DIE BOX TO HOLD BEFORE NEXT ROLLS:
        </span>
        
        <div className="flex flex-wrap gap-3 justify-center select-none">
          {dice.map((val, idx) => {
            const isHeld = held[idx];
            return (
              <button
                key={idx}
                id={`yahtzee-die-${idx}`}
                onClick={() => toggleHold(idx)}
                className={`w-20 h-20 rounded-2xl border-4 text-4xl font-extrabold shadow-md flex items-center justify-center transition-all cursor-pointer ${
                  isHeld 
                    ? "bg-rose-500 border-rose-950 text-white scale-102 ring-4 ring-rose-250 animate-pulse" 
                    : "bg-amber-50 border-slate-900 text-slate-900 hover:bg-amber-100"
                }`}
              >
                {val}
              </button>
            );
          })}
        </div>
      </div>

      {/* SCORECARD GRID CATEGORIES PANEL */}
      <div>
        <span className="text-sm font-black uppercase tracking-wider block mb-3 text-slate-500">
          📋 CHOOSE AN EMPTY CATEGORY CELL TO SCORE:
        </span>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {CATEGORIES.map((cat) => {
            const myScore = scoreCard[cat.id];
            const isScored = myScore !== null;
            const previewScore = rollCount > 0 && !isScored ? calculatePoints(cat.id, dice) : null;

            return (
              <button
                key={cat.id}
                id={`yahtzee-category-${cat.id}`}
                onClick={() => !isScored && claimCategory(cat.id)}
                disabled={isScored || (opponentId && turn !== playerId) || !!winner}
                className={`w-full flex items-center justify-between p-3.5 border-3 rounded-xl transition-all cursor-pointer text-left ${
                  isScored
                    ? "bg-slate-205 border-slate-400 text-slate-500"
                    : previewScore !== null
                    ? "bg-yellow-50 border-yellow-500 hover:bg-yellow-100 animate-pulse"
                    : "bg-white border-zinc-900 hover:bg-slate-100"
                }`}
              >
                <div>
                  <span className="text-md font-extrabold block text-slate-900">
                    {cat.name}
                  </span>
                  <span className="text-xs font-semibold text-slate-500">
                    {cat.desc}
                  </span>
                </div>

                <div className="text-right">
                  {isScored ? (
                    <span className="text-xl font-black text-slate-805 bg-slate-300 px-3 py-1 rounded-lg">
                      {myScore} pts
                    </span>
                  ) : previewScore !== null ? (
                    <span className="text-xl font-extrabold text-amber-700 bg-amber-50 px-3 py-1 rounded-lg border border-dashed border-amber-600">
                      Score: {previewScore}
                    </span>
                  ) : (
                    <span className="text-sm font-bold text-slate-400 italic">
                      Empty
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
