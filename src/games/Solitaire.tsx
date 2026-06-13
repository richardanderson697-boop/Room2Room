import React, { useState, useEffect } from "react";
import { RotateCcw, HelpCircle, ArrowLeftRight, Sparkles, Smile } from "lucide-react";

interface SolitaireProps {
  playerId: string;
  opponentId: string | null;
  opponentDetails: { label: string; avatar: string } | null;
  gameState: any;
  onUpdateGame: (newState: any) => void;
  textScale: "normal" | "large" | "extra-large";
}

interface Card {
  id: string;
  suit: "heart" | "diamond" | "spade" | "club";
  value: number; // 1 (Ace) to 13 (King)
  suitSymbol: string;
  isRed: boolean;
  faceUp: boolean;
}

export default function Solitaire({
  playerId,
  opponentId,
  opponentDetails,
  gameState,
  onUpdateGame,
  textScale,
}: SolitaireProps) {
  // Classic simple card array representation
  const [deck, setDeck] = useState<Card[]>([]);
  const [waste, setWaste] = useState<Card[]>([]);
  const [foundations, setFoundations] = useState<{ [suit: string]: Card[] }>({
    heart: [],
    diamond: [],
    spade: [],
    club: [],
  });
  const [columns, setColumns] = useState<Card[][]>(Array(7).fill(null).map(() => []));
  const [selectedCard, setSelectedCard] = useState<{ source: string; index: number; colIdx?: number } | null>(null);
  const [score, setScore] = useState<number>(0);
  const [movesCount, setMovesCount] = useState<number>(0);
  const [isWin, setIsWin] = useState<boolean>(false);

  // Initialize game
  const initGame = () => {
    const suits: ("heart" | "diamond" | "spade" | "club")[] = ["heart", "diamond", "spade", "club"];
    const symbols = { heart: "♥", diamond: "♦", spade: "♠", club: "♣" };
    const tempDeck: Card[] = [];

    suits.forEach((suit) => {
      for (let v = 1; v <= 13; v++) {
        tempDeck.push({
          id: `${suit}-${v}`,
          suit,
          value: v,
          suitSymbol: symbols[suit],
          isRed: suit === "heart" || suit === "diamond",
          faceUp: false,
        });
      }
    });

    // Shuffle
    for (let i = tempDeck.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tempDeck[i], tempDeck[j]] = [tempDeck[j], tempDeck[i]];
    }

    // Deal Columns
    const tempCols: Card[][] = Array(7).fill(null).map(() => []);
    let deckIdx = 0;
    for (let c = 0; c < 7; c++) {
      for (let r = 0; r <= c; r++) {
        const card = tempDeck[deckIdx++];
        if (r === c) {
          card.faceUp = true; // top face up
        }
        tempCols[c].push(card);
      }
    }

    // Remaining cards to stock pile
    const remainingDeck = tempDeck.slice(deckIdx).map((card) => ({
      ...card,
      faceUp: false,
    }));

    setDeck(remainingDeck);
    setWaste([]);
    setFoundations({ heart: [], diamond: [], spade: [], club: [] });
    setColumns(tempCols);
    setSelectedCard(null);
    setScore(0);
    setMovesCount(0);
    setIsWin(false);
    speak("Solitaire is set up. Tap top pile to draw cards!");
  };

  useEffect(() => {
    initGame();
  }, []);

  const speak = (phrase: string) => {
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(phrase);
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    } catch {}
  };

  // Convert numbers to label characters
  const getCardLabel = (v: number): string => {
    if (v === 1) return "A";
    if (v === 11) return "J";
    if (v === 12) return "Q";
    if (v === 13) return "K";
    return String(v);
  };

  // Draw Stock Card to Waste Card
  const drawCard = () => {
    if (winner) return;

    if (deck.length === 0) {
      if (waste.length === 0) {
        speak("Deck is entirely empty");
        return;
      }
      // recycle waste pile
      const recycled = [...waste].reverse().map((c) => ({ ...c, faceUp: false }));
      setDeck(recycled);
      setWaste([]);
      speak("Recycled card waste pile. Shuffle complete.");
      return;
    }

    const nextCard = deck[deck.length - 1];
    nextCard.faceUp = true;

    setDeck(deck.slice(0, deck.length - 1));
    setWaste([...waste, nextCard]);
    speak(`Drew a card: ${getCardLabel(nextCard.value)} of ${nextCard.suit}s`);
    setSelectedCard(null);
    setMovesCount((m) => m + 1);
  };

  // High interest click triggers
  const selectWasteCard = () => {
    if (waste.length === 0) return;
    const topWaste = waste[waste.length - 1];
    setSelectedCard({ source: "waste", index: waste.length - 1 });
    speak(`Selected waste ${getCardLabel(topWaste.value)} of ${topWaste.suit}s`);
  };

  const selectColumnCard = (colIdx: number, cardIdx: number) => {
    const col = columns[colIdx];
    const card = col[cardIdx];
    if (!card.faceUp) return; // Cannot select face-down card

    // If already selected, select this instead
    setSelectedCard({ source: "column", index: cardIdx, colIdx });
    speak(`Selected ${getCardLabel(card.value)} of ${card.suit}s`);
  };

  // Try auto placing card to foundations (extremely senior friendly!)
  const attemptAutoPlace = (source: string, index: number, colIdx?: number) => {
    let card: Card;
    if (source === "waste") {
      card = waste[index];
    } else if (source === "column" && colIdx !== undefined) {
      card = columns[colIdx][index];
    } else {
      return;
    }

    // Check foundations
    const targetFoundation = foundations[card.suit];
    const currentTop = targetFoundation[targetFoundation.length - 1];

    const canPlace =
      (card.value === 1 && targetFoundation.length === 0) || // Ace
      (currentTop && card.value === currentTop.value + 1); // incremental

    if (canPlace) {
      // Place card
      const newFound = { ...foundations };
      newFound[card.suit] = [...newFound[card.suit], card];
      setFoundations(newFound);

      // Remove from source
      if (source === "waste") {
        setWaste(waste.slice(0, waste.length - 1));
      } else if (source === "column" && colIdx !== undefined) {
        let updatedCol = columns[colIdx].slice(0, index);
        // Reveal card underneath if appropriate
        if (updatedCol.length > 0) {
          updatedCol[updatedCol.length - 1].faceUp = true;
        }
        const updatedColumns = [...columns];
        updatedColumns[colIdx] = updatedCol;
        setColumns(updatedColumns);
      }

      setScore((s) => s + 10);
      setMovesCount((m) => m + 1);
      setSelectedCard(null);
      speak(`Saved to foundations: ${getCardLabel(card.value)} of ${card.suit}`);
      checkWinProgress(newFound);
    } else {
      speak("Cannot place there yet. Keep matching!");
    }
  };

  // Move Column to Column or Waste to Column
  const placeInColumn = (destColIdx: number) => {
    if (!selectedCard) return;
    const destCol = columns[destColIdx];
    const destCard = destCol[destCol.length - 1];

    let sourceCard: Card;
    let cardsToMove: Card[] = [];

    if (selectedCard.source === "waste") {
      sourceCard = waste[selectedCard.index];
      cardsToMove = [sourceCard];
    } else if (selectedCard.source === "column" && selectedCard.colIdx !== undefined) {
      const sourceCol = columns[selectedCard.colIdx];
      sourceCard = sourceCol[selectedCard.index];
      cardsToMove = sourceCol.slice(selectedCard.index);
    } else {
      return;
    }

    // Rules: Opposite Color and Decrement Value
    let isValid = false;
    if (destCol.length === 0) {
      // Only King (13) can start columns
      isValid = sourceCard.value === 13;
    } else {
      isValid =
        destCard.isRed !== sourceCard.isRed && 
        sourceCard.value === destCard.value - 1;
    }

    if (isValid) {
      // Execute Column Transfer
      const updatedColumns = [...columns];

      // Remove from old
      if (selectedCard.source === "waste") {
        setWaste(waste.slice(0, waste.length - 1));
      } else if (selectedCard.source === "column" && selectedCard.colIdx !== undefined) {
        let oldCol = updatedColumns[selectedCard.colIdx].slice(0, selectedCard.index);
        if (oldCol.length > 0) {
          oldCol[oldCol.length - 1].faceUp = true; // Auto-Reveal
        }
        updatedColumns[selectedCard.colIdx] = oldCol;
      }

      // Add to new
      updatedColumns[destColIdx] = [...destCol, ...cardsToMove];
      setColumns(updatedColumns);
      setScore((s) => s + 5);
      setMovesCount((m) => m + 1);
      setSelectedCard(null);
      speak("Moved cards successfully.");
    } else {
      speak("Match incompatible! Opposite colors only in countdown hierarchy (e.g., Red Jack on Black Queen).");
    }
  };

  const checkWinProgress = (founds: any) => {
    const isW =
      founds.heart.length === 13 &&
      founds.diamond.length === 13 &&
      founds.spade.length === 13 &&
      founds.club.length === 13;

    if (isW) {
      setIsWin(true);
      speak("Outstanding! High score earned! You solved the entire Solitaire board.");
    }
  };

  const sizeClass = textScale === "extra-large" ? "text-4xl" : textScale === "large" ? "text-3xl" : "text-2xl";
  const cardTextSize = textScale === "extra-large" ? "text-3xl" : textScale === "large" ? "text-2xl" : "text-lg";

  const winner = isWin;

  return (
    <div className="flex flex-col gap-6 max-w-5xl mx-auto p-4 bg-slate-50 rounded-2xl border-4 border-slate-900 shadow-xl text-slate-900">
      
      {/* SOLITAIRE MAIN BAR */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b-4 border-slate-900 pb-4 gap-4">
        <div>
          <h2 className={`${sizeClass} font-black tracking-tight flex items-center gap-2`}>
            🃏 Card Solitaire (Solo)
          </h2>
          <p className="text-sm font-semibold opacity-85 mt-1">
            Tap piles on top to cycle deck, select cards to auto-sort or place manually.
          </p>
        </div>

        <button
          onClick={initGame}
          id="solitaire-reset-btn"
          className="flex items-center gap-2 bg-zinc-200 border-4 border-zinc-900 px-4 py-2 rounded-xl font-bold hover:bg-zinc-300 transition-colors cursor-pointer"
        >
          <RotateCcw size={20} />
          Shuffle & Redeal
        </button>
      </div>

      {/* STATS PANEL */}
      <div className="flex justify-between bg-zinc-100 border-4 border-zinc-900 p-3 rounded-xl">
        <div className="flex gap-4 font-black text-lg">
          <span>🎯 SCORE: <span className="text-emerald-800">{score}</span></span>
          <span>⚡ MOVES: {movesCount}</span>
        </div>
        <div className="flex items-center gap-2">
          {selectedCard ? (
            <span className="bg-yellow-200 text-yellow-950 border-2 border-yellow-800 font-extrabold px-3 py-0.5 rounded-lg text-sm animate-pulse">
              Selected in Hand: Tap destination or double-click to Auto-Place!
            </span>
          ) : (
            <span className="text-xs text-slate-500 font-medium">Select card & tap destination pile.</span>
          )}
        </div>
      </div>

      {/* SOLVER AUTO HELPER FOR SENIORS */}
      {selectedCard && (
        <button
          id="solitaire-auto-place-btn"
          onClick={() => {
            if (selectedCard) {
              attemptAutoPlace(selectedCard.source, selectedCard.index, selectedCard.colIdx);
            }
          }}
          className="bg-emerald-250 hover:bg-emerald-350 border-4 border-emerald-900 text-emerald-950 font-black py-2.5 px-4 rounded-xl text-center text-lg animate-bounce select-none cursor-pointer"
        >
          💡 Auto-Send Card Selected to Top Safe Foundation Pile
        </button>
      )}

      {/* WIN ALIGNMENT COMPONENT */}
      {isWin && (
        <div className="bg-emerald-100 border-4 border-emerald-800 rounded-xl p-4 flex flex-col items-center justify-center text-center gap-2">
          <Smile className="w-12 h-12 text-emerald-700 animate-bounce" />
          <span className="text-2xl font-black text-emerald-900">👑 VICTORY COMPLETE!</span>
          <p className="font-bold text-emerald-800">You perfectly solved the Solitaire deck in {movesCount} moves!</p>
        </div>
      )}

      {/* LAYOUT: TOP STOCK / FOUNDATIONS */}
      <div className="grid grid-cols-7 gap-1 md:gap-3 items-start select-none">
        
        {/* STOCK PILE */}
        <button
          id="solitaire-draw-deck"
          onClick={drawCard}
          className={`aspect-[2/3] w-full rounded-xl border-4 text-center cursor-pointer flex flex-col items-center justify-center transition-all bg-sky-900 border-sky-950 hover:bg-sky-800 hover:scale-102`}
        >
          <div className="text-white font-extrabold text-sm md:text-xl">STOCK</div>
          <div className="text-[10px] md:text-xs text-sky-200 font-black tracking-widest mt-1">
            {deck.length} REMAINING
          </div>
        </button>

        {/* WASTE DISCARD */}
        <div className="relative">
          {waste.length > 0 ? (
            <div
              id="solitaire-waste-top"
              onClick={selectWasteCard}
              className={`aspect-[2/3] w-full rounded-xl border-4 flex flex-col items-center justify-center bg-white cursor-pointer transition ${
                selectedCard && selectedCard.source === "waste"
                  ? "border-yellow-400 ring-4 ring-yellow-300"
                  : "border-slate-900"
              }`}
            >
              <span
                className={`text-2xl md:text-4xl font-black ${
                  waste[waste.length - 1].isRed ? "text-red-600" : "text-black"
                }`}
              >
                {getCardLabel(waste[waste.length - 1].value)}
                {waste[waste.length - 1].suitSymbol}
              </span>
            </div>
          ) : (
            <div className="aspect-[2/3] w-full rounded-xl border-4 border-dashed border-slate-300 bg-slate-50 flex items-center justify-center font-bold text-slate-300 text-[10px] md:text-xs">
              WASTE
            </div>
          )}
        </div>

        {/* SPACING */}
        <div className="aspect-[2/3] w-full hidden md:block"></div>

        {/* FOUR FOUNDATION PILES */}
        {(["heart", "diamond", "spade", "club"] as const).map((suit) => {
          const pile = foundations[suit];
          const hasCard = pile.length > 0;
          const topC = pile[pile.length - 1];
          const symbols = { heart: "♥", diamond: "♦", spade: "♠", club: "♣" };
          const isRedSuit = suit === "heart" || suit === "diamond";

          return (
            <button
              key={suit}
              id={`solitaire-foundation-${suit}`}
              onClick={() => {
                if (selectedCard) {
                  attemptAutoPlace(selectedCard.source, selectedCard.index, selectedCard.colIdx);
                }
              }}
              className={`aspect-[2/3] w-full rounded-xl border-4 flex flex-col items-center justify-center transition cursor-pointer ${
                hasCard ? "bg-white border-slate-900" : "bg-zinc-150 border-dashed border-zinc-400"
              }`}
            >
              {hasCard ? (
                <span className={`text-2xl md:text-4xl font-black ${isRedSuit ? "text-red-605" : "text-black"}`}>
                  {getCardLabel(topC.value)}
                  {topC.suitSymbol}
                </span>
              ) : (
                <span className={`text-3xl font-black ${isRedSuit ? "text-red-300" : "text-zinc-300"}`}>
                  {symbols[suit]}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* SEVEN PLAYING COLUMNS */}
      <div className="grid grid-cols-7 gap-1 md:gap-3 py-4 min-h-[300px] select-none">
        {columns.map((col, colIdx) => {
          const isEmpty = col.length === 0;

          return (
            <div
              key={colIdx}
              id={`solitaire-column-${colIdx}`}
              className="flex flex-col gap-1 relative min-h-[250px]"
            >
              {/* Tap Empty Column placeholder */}
              {isEmpty && (
                <button
                  onClick={() => placeInColumn(colIdx)}
                  className="aspect-[2/3] w-full rounded-xl border-4 border-dashed border-slate-350 bg-slate-50 flex items-center justify-center font-bold text-slate-350 text-[10px] md:text-xs cursor-pointer hover:border-slate-500"
                >
                  EMPTY K
                </button>
              )}

              {col.map((card, cardIdx) => {
                const isSelected =
                  selectedCard &&
                  selectedCard.source === "column" &&
                  selectedCard.colIdx === colIdx &&
                  selectedCard.index === cardIdx;

                const isRed = card.isRed;

                return (
                  <button
                    key={card.id}
                    id={`solitaire-card-${colIdx}-${cardIdx}`}
                    onClick={() => {
                      if (card.faceUp) {
                        selectColumnCard(colIdx, cardIdx);
                      }
                    }}
                    className={`rounded-lg border-2 shadow flex flex-col p-1.5 md:p-3 transition-transform ${
                      card.faceUp
                        ? isSelected
                          ? "bg-yellow-100 border-yellow-500 scale-102 ring-2 ring-yellow-400"
                          : "bg-white border-zinc-900 group hover:border-black cursor-pointer"
                        : "bg-radial from-sky-850 to-sky-950 border-sky-950"
                    }`}
                    style={{
                      marginTop: cardIdx === 0 ? "0px" : "-55px",
                      zIndex: cardIdx,
                    }}
                    disabled={!card.faceUp && !selectedCard}
                  >
                    {card.faceUp ? (
                      <div className="flex flex-col items-center justify-center col-span-12 text-center w-full">
                        <span className={`font-black uppercase block leading-none ${isRed ? "text-red-600" : "text-black"} ${cardTextSize}`}>
                          {getCardLabel(card.value)}
                        </span>
                        <span className={`block font-black leading-none ${isRed ? "text-red-650" : "text-black"} ${cardTextSize}`}>
                          {card.suitSymbol}
                        </span>
                      </div>
                    ) : (
                      <div className="w-full aspect-[2/3] flex items-center justify-center font-black text-transparent select-none">
                        ?
                      </div>
                    )}
                  </button>
                );
              })}

              {/* Quick destination trigger to drop onto this column */}
              {selectedCard && !isEmpty && (
                <button
                  onClick={() => placeInColumn(colIdx)}
                  className="mt-1 w-full bg-slate-200 hover:bg-slate-300 border-2 border-dashed border-slate-500 rounded-lg py-1.5 text-[10px] font-bold text-slate-700 cursor-pointer"
                >
                  Drop Card Here
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
