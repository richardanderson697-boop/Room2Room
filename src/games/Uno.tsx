import React, { useState, useEffect } from "react";
import { RotateCcw, AlertCircle, HelpCircle, ArrowRightLeft, Palette, Sparkles } from "lucide-react";
import { speakPhrase } from "../speech";

interface UnoCard {
  color: "red" | "blue" | "green" | "yellow" | "wild";
  value: string; // "0".."9", "Skip", "Reverse", "Draw 2", "Wild"
}

interface UnoProps {
  playerId: string;
  opponentId: string | null;
  opponentDetails: { label: string; avatar: string } | null;
  gameState: any;
  onUpdateGame: (newState: any) => void;
  textScale: "normal" | "large" | "extra-large";
}

export default function Uno({
  playerId,
  opponentId,
  opponentDetails,
  gameState,
  onUpdateGame,
  textScale,
}: UnoProps) {
  const [playerHand, setPlayerHand] = useState<UnoCard[]>([]);
  const [opponentHandSize, setOpponentHandSize] = useState<number>(5);
  const [discardPile, setDiscardPile] = useState<UnoCard[]>([]);
  const [deck, setDeck] = useState<UnoCard[]>([]);
  const [turn, setTurn] = useState<string>("");
  const [currentSelectedWildColor, setCurrentSelectedWildColor] = useState<"red" | "blue" | "green" | "yellow" | null>(null);
  const [winner, setWinner] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");

  const cardColorsList: ("red" | "blue" | "green" | "yellow")[] = ["red", "blue", "green", "yellow"];
  const values = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9", "Skip", "Reverse", "Draw 2"];

  // Initialize a fresh Uno deck
  const makeDeck = (): UnoCard[] => {
    const list: UnoCard[] = [];
    cardColorsList.forEach((c) => {
      values.forEach((v) => {
        list.push({ color: c, value: v });
        if (v !== "0") {
          list.push({ color: c, value: v }); // duplicate matching standard
        }
      });
    });
    // Add Wild
    for (let i = 0; i < 4; i++) {
      list.push({ color: "wild", value: "Wild" });
    }
    // Shuffle
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  };

  const setupGameLocal = () => {
    const freshDeck = makeDeck();
    const myHand = freshDeck.splice(0, 5);
    const oppHand = freshDeck.splice(0, 5);
    const firstDiscard = freshDeck.splice(0, 1)[0];

    // If first discard is wild, set standard red
    if (firstDiscard.color === "wild") {
      firstDiscard.color = "red";
    }

    setPlayerHand(myHand);
    setOpponentHandSize(oppHand.length);
    setDiscardPile([firstDiscard]);
    setDeck(freshDeck);
    setTurn(playerId);
    setCurrentSelectedWildColor(null);
    setWinner(null);
    setStatusMessage("Uno match initiated! Play cards that match color or number.");
    speak("Uno started! Play a matching color or number.");

    if (opponentId) {
      // Broadcast state to server
      const updatedState = {
        deckCount: freshDeck.length,
        discardPile: [firstDiscard],
        playerHands: {
          [playerId]: myHand,
          [opponentId]: oppHand,
        },
        turn: playerId,
        ended: false,
        winner: null,
        activeWildColor: null,
        statusMessage: "Multiplayer Uno has started!",
      };
      onUpdateGame(updatedState);
    }
  };

  useEffect(() => {
    setupGameLocal();
  }, [opponentId]);

  // Sync state if multiplayer
  useEffect(() => {
    if (opponentId && gameState) {
      if (gameState.discardPile) setDiscardPile(gameState.discardPile);
      if (gameState.winner) setWinner(gameState.winner);
      if (gameState.turn) setTurn(gameState.turn);
      if (gameState.activeWildColor) setCurrentSelectedWildColor(gameState.activeWildColor);

      if (gameState.playerHands) {
        if (gameState.playerHands[playerId]) {
          setPlayerHand(gameState.playerHands[playerId]);
        }
        if (gameState.playerHands[opponentId]) {
          setOpponentHandSize(gameState.playerHands[opponentId].length);
        }
      }
      if (gameState.statusMessage) setStatusMessage(gameState.statusMessage);
    }
  }, [gameState, opponentId]);

  const speak = (phrase: string) => {
    speakPhrase(phrase, true);
  };

  const handleCardPlay = (cardIdx: number) => {
    if (winner) return;
    if (turn !== playerId) {
      speak("Patience! It is your opponent's turn.");
      return;
    }

    const cardToPlay = playerHand[cardIdx];
    const topDiscard = discardPile[discardPile.length - 1];

    // Play guidelines
    const isColorMatch = cardToPlay.color === topDiscard.color || (topDiscard.color === "wild" && cardToPlay.color === currentSelectedWildColor);
    const isValueMatch = cardToPlay.value === topDiscard.value;
    const isWild = cardToPlay.color === "wild";

    if (isColorMatch || isValueMatch || isWild) {
      const updatedHand = playerHand.filter((_, idx) => idx !== cardIdx);
      const newDiscard = [...discardPile, cardToPlay];

      let nextTurn = opponentId || "computer";
      let wildMenuNeeded = false;
      let tempWildColor: any = null;

      // Handle Special Card Effects
      if (cardToPlay.value === "Skip" || cardToPlay.value === "Reverse") {
        nextTurn = playerId; // Earn extra turn
        setStatusMessage(`You played ${cardToPlay.value}! Take another turn!`);
        speak(`You played a ${cardToPlay.value}! Move again!`);
      } else if (cardToPlay.value === "Draw 2") {
        setStatusMessage("Played Draw 2! Opponent draws 2 cards.");
        speak("Played Draw 2! Opponent receives two cards.");
        // Give 2 cards to opponent
        if (!opponentId) {
          setOpponentHandSize((prev) => prev + 2);
        }
        // turn stays yours due to penalty or standard jump
        nextTurn = playerId;
      } else if (cardToPlay.color === "wild") {
        wildMenuNeeded = true;
        // set default red if quick solo auto
        if (!opponentId) {
          tempWildColor = "red";
          setCurrentSelectedWildColor("red");
        }
      }

      // Check immediate Win
      let nextWinner: string | null = null;
      if (updatedHand.length === 0) {
        nextWinner = playerId;
        setWinner(playerId);
        speak("UNO! You have won the game! Outstanding!");
      }

      setPlayerHand(updatedHand);
      setDiscardPile(newDiscard);

      if (opponentId) {
        // MULTIPLAYER SYNC
        const finalHands = {
          ...gameState.playerHands,
          [playerId]: updatedHand,
        };

        if (cardToPlay.value === "Draw 2") {
          const oppHandCopy = [...(gameState.playerHands[opponentId] || [])];
          // Simple draw simulation
          oppHandCopy.push({ color: "blue", value: "3" });
          oppHandCopy.push({ color: "red", value: "7" });
          finalHands[opponentId] = oppHandCopy;
        }

        onUpdateGame({
          ...gameState,
          discardPile: newDiscard,
          playerHands: finalHands,
          turn: nextWinner ? "" : nextTurn,
          winner: nextWinner,
          activeWildColor: tempWildColor,
          statusMessage: nextWinner 
            ? `Room ${playerId.split("-")[0]} wins! UNO!` 
            : `Room ${playerId.split("-")[0]} played a card. Now: ${nextTurn.split("-")[0]} turn.`,
          ended: !!nextWinner,
        });

        if (wildMenuNeeded) {
          // Open quick voice/screen color prompt
          speak("Choose a new color by pressing Red, Blue, Green or Yellow!");
        }
      } else {
        // SOLO PLAY
        if (nextWinner) return;

        setTurn(nextTurn);
        if (nextTurn === "computer") {
          setTimeout(() => {
            makeComputerPlay(newDiscard, updatedHand, opponentHandSize);
          }, 1500);
        }
      }
    } else {
      speak("Card does not match! Play same color, same number, or wild.");
    }
  };

  const handleDrawCardAction = () => {
    if (winner) return;
    if (turn !== playerId) {
      speak("Wait for enemy turn.");
      return;
    }

    let topDiscard = discardPile[discardPile.length - 1];
    let newCard: UnoCard;

    if (deck.length > 0) {
      newCard = deck[0];
      setDeck(deck.slice(1));
    } else {
      const fresh = makeDeck();
      newCard = fresh[0];
      setDeck(fresh.slice(1));
    }

    const updatedHand = [...playerHand, newCard];
    setPlayerHand(updatedHand);
    speak(`You drew a ${newCard.color} ${newCard.value}`);

    // If multiplayer
    if (opponentId) {
      onUpdateGame({
        ...gameState,
        playerHands: {
          ...gameState.playerHands,
          [playerId]: updatedHand,
        },
        statusMessage: `Room ${playerId.split("-")[0]} drew a card.`,
      });
    } else {
      // Swipe turn to AI
      setTurn("computer");
      setTimeout(() => {
        makeComputerPlay(discardPile, updatedHand, opponentHandSize);
      }, 1500);
    }
  };

  const makeComputerPlay = (currentDiscard: UnoCard[], curPlayerHand: UnoCard[], curOppSize: number) => {
    if (winner) return;

    const topCell = currentDiscard[currentDiscard.length - 1];
    const wildColor = currentSelectedWildColor;

    // Simulate AI Hand
    // AI searches for playable card.
    let aiHand: UnoCard[] = Array(oppSizeToGenerate(curOppSize)).fill(null).map((_, i) => ({
      color: i % 4 === 0 ? "red" : i % 4 === 1 ? "blue" : i % 4 === 2 ? "green" : "yellow",
      value: String(i % 10),
    }));

    // AI searches for matches
    let playableIdx = aiHand.findIndex((c) => {
      const colorMatch = c.color === topCell.color || (topCell.color === "wild" && c.color === wildColor);
      const valMatch = c.value === topCell.value;
      return colorMatch || valMatch;
    });

    if (playableIdx !== -1) {
      const played = aiHand[playableIdx];
      const updatedDiscard = [...currentDiscard, played];
      const newSize = Math.max(0, curOppSize - 1);
      
      setOpponentHandSize(newSize);
      setDiscardPile(updatedDiscard);

      if (newSize === 0) {
        setWinner("computer");
        speak("Computer wins the matches! UNO!");
        return;
      }

      speak(`Computer plays a ${played.color} ${played.value}!`);
      setTurn(playerId);
    } else {
      // AI draws card
      const newSize = curOppSize + 1;
      setOpponentHandSize(newSize);
      speak("Computer has no matching card. Computer draws 1 card.");
      setTurn(playerId);
    }
  };

  const oppSizeToGenerate = (sz: number) => sz > 0 ? sz : 1;

  const selectWildColor = (color: "red" | "blue" | "green" | "yellow") => {
    setCurrentSelectedWildColor(color);
    setStatusMessage(`Wild Color chosen: ${color.toUpperCase()}`);
    speak(`Wild color shifted to ${color}`);

    if (opponentId) {
      onUpdateGame({
        ...gameState,
        activeWildColor: color,
        turn: opponentId,
        statusMessage: `Room ${playerId.split("-")[0]} chose Wild Color: ${color}`,
      });
    } else {
      setTurn("computer");
      setTimeout(() => {
        makeComputerPlay(discardPile, playerHand, opponentHandSize);
      }, 1500);
    }
  };

  const sizeClass = textScale === "extra-large" ? "text-4xl" : textScale === "large" ? "text-3xl" : "text-2xl";
  const labelTextSize = textScale === "extra-large" ? "text-2xl" : textScale === "large" ? "text-xl" : "text-base";

  const topDiscard = discardPile[discardPile.length - 1];

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto p-4 bg-slate-50 rounded-2xl border-4 border-slate-900 shadow-xl text-slate-900">
      
      {/* CARD UNO HEADERS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b-4 border-slate-900 pb-4 gap-4">
        <div>
          <h2 className={`${sizeClass} font-black tracking-tight flex items-center gap-2`}>
            🌈 Senior Uno Color Play
          </h2>
          <p className="text-sm font-semibold opacity-85 mt-1">
            {opponentId 
              ? `Playing vs Room opponent ${opponentDetails?.label}` 
              : "Solo Practice vs Automated computer AI player."}
          </p>
        </div>

        <button
          onClick={setupGameLocal}
          id="uno-restart-btn"
          className="flex items-center gap-2 bg-zinc-200 border-4 border-zinc-900 px-4 py-2 rounded-xl font-bold hover:bg-zinc-300 transition-colors cursor-pointer"
        >
          <RotateCcw size={20} />
          Restart Uno
        </button>
      </div>

      {/* GAME LOBBY AND MESSAGE ALERT */}
      <div className="bg-yellow-50 border-4 border-yellow-800 p-4 rounded-xl flex items-center gap-3">
        <AlertCircle className="text-yellow-800 w-8 h-8 flex-shrink-0" />
        <span className="text-lg font-bold text-yellow-950">
          {statusMessage}
        </span>
      </div>

      {/* COMPANION SCORE & TUNING */}
      <div className="grid grid-cols-2 gap-4 bg-zinc-100 border-4 border-zinc-900 p-3 rounded-xl text-center">
        <div>
          <span className="text-xs font-bold uppercase block text-slate-500">OPPONENT CARDS</span>
          <span className="text-2xl font-black text-rose-800">{opponentHandSize} Cards Hand</span>
        </div>
        <div>
          <span className="text-xs font-bold uppercase block text-slate-500">YOUR HAND</span>
          <span className="text-2xl font-black text-emerald-800">{playerHand.length} Cards</span>
        </div>
      </div>

      {/* REVELATION WIN CHIP */}
      {winner && (
        <div className="p-4 bg-emerald-100 border-4 border-emerald-800 rounded-xl text-center">
          <span className="text-xl font-black text-emerald-950 block">
            ⭐ {winner === playerId ? "Match Complete! You win with perfect play!" : "AI gets the match! Practice makes perfect!"}
          </span>
        </div>
      )}

      {/* MIDDLE CORRIDOR: DRAW & DISCARD PILE */}
      <div className="flex flex-col md:flex-row items-center justify-center gap-6 my-4">
        
        {/* DISCARD PILE (TOP CELL PLAYED) */}
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-500">DISCARD CELL</span>
          {topDiscard ? (
            <div
              className={`w-32 h-44 rounded-2xl border-4 border-slate-900 shadow-lg flex flex-col items-center justify-center text-center p-3 relative ${
                topDiscard.color === "red"
                  ? "bg-red-500 text-white"
                  : topDiscard.color === "blue"
                  ? "bg-blue-500 text-white"
                  : topDiscard.color === "green"
                  ? "bg-green-500 text-white"
                  : topDiscard.color === "yellow"
                  ? "bg-yellow-400 text-black border-yellow-500"
                  : "bg-purple-600 text-white"
              }`}
            >
              <span className="text-3xl font-black uppercase leading-tight select-none">
                {topDiscard.value}
              </span>
              
              {/* If wild color chosen, show visual badge */}
              {topDiscard.color === "wild" && currentSelectedWildColor && (
                <div className="mt-2 text-xs font-extrabold uppercase bg-slate-905 text-white px-2 py-0.5 rounded-lg">
                  {currentSelectedWildColor}
                </div>
              )}
            </div>
          ) : (
            <div className="w-32 h-44 rounded-2xl border-4 border-dashed border-slate-300 flex items-center justify-center font-bold text-slate-350">
              EMPTY
            </div>
          )}
        </div>

        {/* DRAW DECK PILE BUTTON */}
        <button
          id="uno-draw-btn"
          onClick={handleDrawCardAction}
          disabled={turn !== playerId || !!winner}
          className="w-32 h-44 rounded-2xl border-4 border-slate-900 shadow-md flex flex-col items-center justify-center text-center p-3 cursor-pointer select-none group bg-sky-900 border-sky-950 text-white scale-100 hover:scale-102 active:scale-95 transition-all disabled:opacity-40"
        >
          <span className="text-xl font-black">UNO</span>
          <span className="text-xs font-bold text-sky-200 mt-2 block group-hover:underline">TAP TO DRAW</span>
        </button>
      </div>

      {/* WILD COLOR PICKER DROPDOWN */}
      {topDiscard && topDiscard.color === "wild" && turn === playerId && (
        <div className="p-4 bg-teal-50 border-4 border-teal-900 rounded-xl text-center">
          <span className="text-lg font-black text-teal-950 block mb-2">🎈 Select Wild Card Match-Color:</span>
          <div className="flex justify-center gap-2">
            {(["red", "blue", "green", "yellow"] as const).map((color) => (
              <button
                key={color}
                onClick={() => selectWildColor(color)}
                className={`px-4 py-2 text-sm font-black uppercase rounded-lg border-2 border-slate-900 cursor-pointer text-white ${
                  color === "red"
                    ? "bg-red-500"
                    : color === "blue"
                    ? "bg-blue-500"
                    : color === "green"
                    ? "bg-green-500"
                    : "bg-yellow-500 text-slate-900"
                }`}
              >
                {color}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* BOTTOM SECTION: PLAYER HAND CARDS CAROUSEL */}
      <div className="border-t-4 border-slate-900 pt-4">
        <span className="text-sm font-black uppercase block tracking-wider text-slate-500 mb-2">
          👋 Your Active Cards Hand (Tap card to play):
        </span>
        
        <div className="flex flex-wrap gap-2.5 justify-center">
          {playerHand.map((card, idx) => {
            const isPlayable =
              turn === playerId &&
              (card.color === topDiscard?.color ||
                card.value === topDiscard?.value ||
                card.color === "wild" ||
                (topDiscard?.color === "wild" && card.color === currentSelectedWildColor));

            return (
              <button
                key={idx}
                id={`uno-card-hand-${idx}`}
                onClick={() => handleCardPlay(idx)}
                className={`w-28 h-36 rounded-xl border-3 border-slate-900 shadow flex flex-col items-center justify-center p-2 relative cursor-pointer text-center scale-100 active:scale-90 transition-all ${
                  card.color === "red"
                    ? "bg-red-500 text-white"
                    : card.color === "blue"
                    ? "bg-blue-500 text-white"
                    : card.color === "green"
                    ? "bg-green-500 text-white"
                    : card.color === "yellow"
                    ? "bg-yellow-400 text-black"
                    : "bg-purple-650 text-white"
                } ${isPlayable ? "ring-4 ring-yellow-400" : "opacity-60"}`}
              >
                <span className="text-xl font-extrabold uppercase leading-none">
                  {card.value}
                </span>

                {isPlayable && (
                  <div className="absolute top-1 right-1 w-2.5 h-2.5 bg-emerald-400 rounded-full border border-slate-900" />
                )}
              </button>
            );
          })}

          {playerHand.length === 0 && (
            <span className="text-sm italic text-slate-500">Hand is empty. Draw a card!</span>
          )}
        </div>
      </div>
    </div>
  );
}
