import React, { useState, useEffect } from "react";
import { RotateCcw, AlertTriangle, Crown, Sparkles } from "lucide-react";

interface CheckersProps {
  playerId: string;
  opponentId: string | null;
  opponentDetails: { label: string; avatar: string } | null;
  gameState: any;
  onUpdateGame: (newState: any) => void;
  textScale: "normal" | "large" | "extra-large";
}

type Piece = "r" | "b" | "R" | "B" | "e"; // red, black, Red King, Black King, empty

interface Coordinate {
  r: number;
  c: number;
}

export default function Checkers({
  playerId,
  opponentId,
  opponentDetails,
  gameState,
  onUpdateGame,
  textScale,
}: CheckersProps) {
  const [board, setBoard] = useState<Piece[][]>([]);
  const [selected, setSelected] = useState<Coordinate | null>(null);
  const [availableMoves, setAvailableMoves] = useState<Coordinate[]>([]);
  const [turn, setTurn] = useState<string>(""); // Player ID whose turn it is
  const [colorMap, setColorMap] = useState<{ [id: string]: "red" | "black" }>({});
  const [isSolo, setIsSolo] = useState<boolean>(true);
  const [winner, setWinner] = useState<string | null>(null);

  // Initialize board local state
  const resetBoard = () => {
    const initialBoard: Piece[][] = [
      ["e", "b", "e", "b", "e", "b", "e", "b"],
      ["b", "e", "b", "e", "b", "e", "b", "e"],
      ["e", "b", "e", "b", "e", "b", "e", "b"],
      ["e", "e", "e", "e", "e", "e", "e", "e"],
      ["e", "e", "e", "e", "e", "e", "e", "e"],
      ["r", "e", "r", "e", "r", "e", "r", "e"],
      ["e", "r", "e", "r", "e", "r", "e", "r"],
      ["r", "e", "r", "e", "r", "e", "r", "e"],
    ];

    setBoard(initialBoard);
    setSelected(null);
    setAvailableMoves([]);
    setWinner(null);

    if (opponentId) {
      setIsSolo(false);
      // Determine player turn and colors
      const map = gameState?.colorMap || {
        [playerId]: "red",
        [opponentId]: "black",
      };
      setColorMap(map);
      setTurn(gameState?.turn || playerId);
    } else {
      setIsSolo(true);
      setColorMap({ [playerId]: "red", computer: "black" });
      setTurn(playerId);
    }
  };

  useEffect(() => {
    resetBoard();
  }, [opponentId]);

  // Sync state if multiplayer matches update
  useEffect(() => {
    if (opponentId && gameState) {
      if (gameState.board) setBoard(gameState.board);
      if (gameState.turn) setTurn(gameState.turn);
      if (gameState.colorMap) setColorMap(gameState.colorMap);
      if (gameState.winner) setWinner(gameState.winner);
    }
  }, [gameState, opponentId]);

  // Get color of piece
  const getPieceColor = (p: Piece): "red" | "black" | null => {
    if (p === "r" || p === "R") return "red";
    if (p === "b" || p === "B") return "black";
    return null;
  };

  // Is King
  const isKing = (p: Piece): boolean => {
    return p === "R" || p === "B";
  };

  // Get valid moves for selected cell
  const getValidMoves = (r: number, c: number, currentBoard: Piece[][]): Coordinate[] => {
    const piece = currentBoard[r][c];
    const color = getPieceColor(piece);
    if (!color) return [];

    const moves: Coordinate[] = [];
    const directions: Coordinate[] = [];

    // Red goes UP (decrement r), Black goes DOWN (increment r), Kings go BOTH directions
    if (color === "red" || isKing(piece)) {
      directions.push({ r: -1, c: -1 }, { r: -1, c: 1 });
    }
    if (color === "black" || isKing(piece)) {
      directions.push({ r: 1, c: -1 }, { r: 1, c: 1 });
    }

    directions.forEach((dir) => {
      const targetR = r + dir.r;
      const targetC = c + dir.c;

      // In bounds?
      if (targetR >= 0 && targetR < 8 && targetC >= 0 && targetC < 8) {
        const targetPiece = currentBoard[targetR][targetC];
        if (targetPiece === "e") {
          // Standard Move
          moves.push({ r: targetR, c: targetC });
        } else if (getPieceColor(targetPiece) !== color) {
          // Op Piece, check jump
          const jumpR = targetR + dir.r;
          const jumpC = targetC + dir.c;
          if (jumpR >= 0 && jumpR < 8 && jumpC >= 0 && jumpC < 8) {
            if (currentBoard[jumpR][jumpC] === "e") {
              // Valid Jump!
              moves.push({ r: jumpR, c: jumpC });
            }
          }
        }
      }
    });

    return moves;
  };

  const speak = (phrase: string) => {
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(phrase);
      utterance.rate = 0.85;
      window.speechSynthesis.speak(utterance);
    } catch {}
  };

  const handleCellClick = (r: number, c: number) => {
    if (winner) return;

    // Is it player's turn?
    const myColor = colorMap[playerId];
    const isMyTurn = turn === playerId;

    if (!isMyTurn) {
      speak("It is your opponent's turn. Please wait.");
      return;
    }

    const clickedPiece = board[r][c];
    const pColor = getPieceColor(clickedPiece);

    // If selecting own piece
    if (pColor === myColor) {
      setSelected({ r, c });
      const moves = getValidMoves(r, c, board);
      setAvailableMoves(moves);
      speak(`Selected checker at ${String.fromCharCode(65 + c)}${8 - r}. ${moves.length} moves available.`);
      return;
    }

    // Attempting a move
    const isValidMove = availableMoves.some((m) => m.r === r && m.c === c);
    if (selected && isValidMove) {
      executeMove(selected.r, selected.c, r, c);
    } else {
      setSelected(null);
      setAvailableMoves([]);
    }
  };

  const executeMove = (fromR: number, fromC: number, toR: number, toC: number) => {
    let newBoard = board.map((row) => [...row]);
    let piece = newBoard[fromR][fromC];

    // Check if it was a jump
    const isJump = Math.abs(toR - fromR) === 2;
    if (isJump) {
      const capturedR = (fromR + toR) / 2;
      const capturedC = (fromC + toC) / 2;
      newBoard[capturedR][capturedC] = "e"; // capture piece
    }

    // Move Piece
    newBoard[fromR][fromC] = "e";

    // Promote to King?
    const color = getPieceColor(piece);
    if (color === "red" && toR === 0) {
      piece = "R"; // King Red
    } else if (color === "black" && toR === 7) {
      piece = "B"; // King Black
    }

    newBoard[toR][toC] = piece;

    // Reset selection state
    setSelected(null);
    setAvailableMoves([]);
    setBoard(newBoard);

    // Check Win/Loss conditions
    const opponentColor = color === "red" ? "black" : "red";
    const hasRemainingPieces = checkRemainingPieces(opponentColor, newBoard);

    let nextWinner: string | null = null;
    if (!hasRemainingPieces) {
      nextWinner = playerId;
      setWinner(playerId);
      speak("Congratulations! You won the game!");
    }

    // Toggle Turn
    let nextTurn = opponentId || "computer";

    if (opponentId) {
      // MULTIPLAYER SYNC
      onUpdateGame({
        ...gameState,
        board: newBoard,
        turn: nextWinner ? "" : nextTurn,
        winner: nextWinner,
        statusMessage: nextWinner 
          ? `Room ${playerId.split("-")[0]} wins! Fabulous!`
          : `Turn swapped to room ${opponentId.split("-")[0]}`,
        ended: !!nextWinner,
      });
    } else {
      // SOLO LOCAL VS COMPUTER AI
      if (nextWinner) return;

      setTurn("computer");
      speak("Computer is thinking...");
      
      // Let AI play after 1.5 seconds
      setTimeout(() => {
        makeComputerMove(newBoard);
      }, 15000 / 10); // quickly play
    }
  };

  const checkRemainingPieces = (color: "red" | "black", currentBoard: Piece[][]): boolean => {
    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (getPieceColor(currentBoard[r][c]) === color) {
          return true;
        }
      }
    }
    return false;
  };

  const makeComputerMove = (currBoard: Piece[][]) => {
    // Collect all valid moves for computer
    interface AIMove {
      from: Coordinate;
      to: Coordinate;
      isJump: boolean;
    }

    const aiMoves: AIMove[] = [];

    for (let r = 0; r < 8; r++) {
      for (let c = 0; c < 8; c++) {
        if (getPieceColor(currBoard[r][c]) === "black") {
          const validCoord = getValidMoves(r, c, currBoard);
          validCoord.forEach((coord) => {
            const isJump = Math.abs(coord.r - r) === 2;
            aiMoves.push({
              from: { r, c },
              to: coord,
              isJump,
            });
          });
        }
      }
    }

    if (aiMoves.length === 0) {
      // Player wins!
      setWinner(playerId);
      speak("No moves left for computer. You win!");
      return;
    }

    // Prioritize Jumps
    const jumps = aiMoves.filter((m) => m.isJump);
    const chosenMove = jumps.length > 0 
      ? jumps[Math.floor(Math.random() * jumps.length)] 
      : aiMoves[Math.floor(Math.random() * aiMoves.length)];

    const updatedBoard = currBoard.map((row) => [...row]);
    let piece = updatedBoard[chosenMove.from.r][chosenMove.from.c];

    // capture!
    if (chosenMove.isJump) {
      const capR = (chosenMove.from.r + chosenMove.to.r) / 2;
      const capC = (chosenMove.from.c + chosenMove.to.c) / 2;
      updatedBoard[capR][capC] = "e";
    }

    updatedBoard[chosenMove.from.r][chosenMove.from.c] = "e";

    // promote
    if (piece === "b" && chosenMove.to.r === 7) {
      piece = "B";
    }
    updatedBoard[chosenMove.to.r][chosenMove.to.c] = piece;

    setBoard(updatedBoard);

    // Check if player has pieces left
    const playerHasPieces = checkRemainingPieces("red", updatedBoard);
    if (!playerHasPieces) {
      setWinner("computer");
      speak("The AI won this match. Ready to try again?");
    } else {
      setTurn(playerId);
      speak(`Computer moved your way. It is now your turn.`);
    }
  };

  const sizeClass = 
    textScale === "extra-large" 
      ? "text-4xl" 
      : textScale === "large" 
      ? "text-3xl" 
      : "text-2xl";

  const myColor = colorMap[playerId] || "red";
  const labelColor = myColor === "red" ? "RED" : "BLACK";

  return (
    <div className="flex flex-col gap-6 max-w-4xl mx-auto p-4 bg-slate-50 rounded-2xl border-4 border-slate-900 shadow-xl text-slate-900">
      
      {/* HEADER CONTROLS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between border-b-4 border-slate-900 pb-4 gap-4">
        <div>
          <h2 className={`${sizeClass} font-black tracking-tight flex items-center gap-2`}>
            🔴 Senior Checkers Room Play
          </h2>
          <p className="text-sm font-semibold opacity-85 mt-1">
            {!isSolo && opponentDetails
              ? `Playing vs Room opponent: ${opponentDetails.label}. Your checkers: ${labelColor}`
              : "Playing in solo practice against automated computer checker AI."}
          </p>
        </div>

        <button
          onClick={resetBoard}
          id="checkers-reset-btn"
          className="flex items-center gap-2 bg-zinc-200 border-4 border-zinc-900 px-4 py-2 rounded-xl font-bold hover:bg-zinc-300 transition-colors cursor-pointer"
        >
          <RotateCcw size={20} />
          Reset Game
        </button>
      </div>

      {/* GAME RUN STATS */}
      <div className="flex items-center justify-between bg-zinc-100 border-4 border-zinc-900 rounded-xl p-3 md:p-4">
        <div className="flex items-center gap-3">
          <span className="text-xl font-black">TURN STATUS:</span>
          {winner ? (
            <span className="text-xl font-extrabold text-emerald-800 bg-emerald-50 border-2 border-emerald-800 rounded-lg px-3 py-0.5 animate-pulse flex items-center gap-1.5">
              <Sparkles size={18} /> Game Finished!
            </span>
          ) : turn === playerId ? (
            <span className="text-xl font-extrabold text-red-850 bg-red-100 border-2 border-red-800 rounded-lg px-3 py-0.5 animate-bounce">
              ⭐ YOUR TURN!
            </span>
          ) : (
            <span className="text-xl font-bold text-slate-800 bg-slate-200 border-2 border-slate-650 rounded-lg px-3 py-0.5">
              Wait for Opponent move
            </span>
          )}
        </div>

        <div className="font-bold text-xs md:text-sm text-slate-650 italic">
          Tap pieces to select, tap highlighted circles to move.
        </div>
      </div>

      {/* WINNER ALERT ACCENTS */}
      {winner && (
        <div className="p-4 bg-lime-100 border-4 border-lime-800 rounded-xl flex flex-col md:flex-row items-center justify-between gap-4">
          <span className="text-xl font-black text-lime-900">
            🥇 {winner === playerId ? "Match Complete! You beat your opponent!" : "The computer claims victory! Keep playing to learn!"}
          </span>
          <button
            onClick={resetBoard}
            id="checkers-winner-restart"
            className="bg-lime-800 text-white border-2 border-lime-950 font-bold px-6 py-2 rounded-xl hover:bg-lime-900 cursor-pointer text-lg"
          >
            Play Another Game
          </button>
        </div>
      )}

      {/* BOARD MATRIX */}
      <div className="flex justify-center">
        <div className="grid grid-cols-8 bg-zinc-800 border-8 border-slate-900 p-2 rounded-2xl shadow-lg max-w-[500px] w-full aspect-square">
          {board.map((row, rIdx) =>
            row.map((piece, cIdx) => {
              const isDarkSquare = (rIdx + cIdx) % 2 === 1;
              const pColor = getPieceColor(piece);
              const isSel = selected && selected.r === rIdx && selected.c === cIdx;
              const canMoveHere = availableMoves.some((m) => m.r === rIdx && m.c === cIdx);

              return (
                <div
                  key={`${rIdx}-${cIdx}`}
                  onClick={() => isDarkSquare && handleCellClick(rIdx, cIdx)}
                  className={`relative aspect-square flex items-center justify-center select-none font-bold text-xs ${
                    isDarkSquare 
                      ? "bg-slate-750 hover:bg-slate-700 cursor-pointer" 
                      : "bg-amber-50"
                  }`}
                >
                  {/* Visual Coordinate Tags (Only in margins for board references) */}
                  {cIdx === 0 && (
                    <span className="absolute left-1 top-0.5 text-[8px] font-black opacity-35 text-white">
                      {8 - rIdx}
                    </span>
                  )}
                  {rIdx === 7 && (
                    <span className="absolute right-1 bottom-0.5 text-[8px] font-black opacity-35 text-white">
                      {String.fromCharCode(65 + cIdx)}
                    </span>
                  )}

                  {/* Checker piece illustration */}
                  {piece !== "e" && pColor && (
                    <div
                      className={`w-[85%] h-[85%] rounded-full border-4 flex items-center justify-center shadow-lg transition-transform ${
                        pColor === "red"
                          ? "bg-red-600 border-red-900 text-red-100"
                          : "bg-neutral-900 border-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.35)] text-slate-100"
                      } ${isSel ? "scale-105 border-yellow-400 ring-4 ring-yellow-300 animate-pulse" : "scale-100"}`}
                    >
                      {isKing(piece) && <Crown className="w-[50%] h-[50%] drop-shadow-md text-amber-300 fill-amber-200" />}
                    </div>
                  )}

                  {/* Possible Move marker overlay */}
                  {canMoveHere && (
                    <div className="absolute w-[35%] h-[35%] rounded-full bg-emerald-400 border-2 border-emerald-900 ring-2 ring-white animate-ping opacity-90" />
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
