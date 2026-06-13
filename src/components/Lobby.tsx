import React, { useState } from "react";
import { AVATAR_SPECS, PRESET_MESSAGES } from "../types";
import { UserCheck, Sparkles, LogIn, ArrowRight } from "lucide-react";

interface LobbyProps {
  onRegister: (room: string, bed: string, avatar: string) => void;
  textScale: "normal" | "large" | "extra-large";
}

export default function Lobby({ onRegister, textScale }: LobbyProps) {
  const [room, setRoom] = useState<string>("");
  const [bed, setBed] = useState<string>("A");
  const [selectedAvatar, setSelectedAvatar] = useState<string>("👴");
  const [errorLabel, setErrorLabel] = useState<string>("");

  const handleKeypadPress = (num: string) => {
    if (room.length >= 4) return;
    setRoom(room + num);
    setErrorLabel("");
    speak(num);
  };

  const handleBackspace = () => {
    setRoom(room.slice(0, room.length - 1));
    speak("Delete");
  };

  const handleClear = () => {
    setRoom("");
    speak("Cleared");
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

  const handleSubmit = () => {
    if (!room) {
      setErrorLabel("Room number cannot be empty. Please tap numbers!");
      speak("Room number cannot be empty. Please tap numbers.");
      return;
    }
    setErrorLabel("");
    // Register player
    onRegister(room, bed, selectedAvatar);
    speak(`Joining Room ${room} Bed ${bed}. Welcome to Room to Room Connect!`);
  };

  const textClass = 
    textScale === "extra-large" 
      ? "text-4xl" 
      : textScale === "large" 
      ? "text-3xl" 
      : "text-2xl";

  const descClass = 
    textScale === "extra-large" 
      ? "text-xl font-bold" 
      : "text-base font-semibold";

  return (
    <div className="max-w-3xl mx-auto p-6 bg-slate-50 border-4 border-slate-900 shadow-2xl rounded-3xl text-slate-900 mt-6 select-none">
      
      {/* BRAND HEADER DESIGN */}
      <div className="text-center pb-6 border-b-4 border-slate-900">
        <h1 className={`${textClass} font-black uppercase tracking-tight flex items-center justify-center gap-3`}>
          🏡 Room 2 Room Connect
        </h1>
        <p className={`${descClass} text-slate-700 mt-2`}>
          Safe, PII-Free local games and messaging for nursing care rooms and beds.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6">
        
        {/* LEFT COLUMN: ROOM SELECTOR KEYPAD */}
        <div className="flex flex-col gap-4">
          <div>
            <label className="block text-lg font-black text-slate-800 uppercase mb-2">
              Step 1: Enter Room Number
            </label>
            <div className="relative">
              <input
                id="lobby-room-input"
                type="text"
                value={room}
                readOnly
                placeholder="---"
                className="w-full text-5xl font-black text-center border-4 border-slate-900 rounded-2xl py-4 bg-white shadow-inner focus:outline-none placeholder-slate-300"
              />
            </div>
          </div>

          {/* LARGE TOUCH-SCREEN KEYPAD FOR ARTHRITIS RELIEF */}
          <div className="grid grid-cols-3 gap-2 bg-slate-200 p-3 rounded-2xl border-4 border-slate-900">
            {["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((num) => (
              <button
                key={num}
                id={`lobby-keypad-${num}`}
                onClick={() => handleKeypadPress(num)}
                className="py-4 bg-white hover:bg-zinc-100 border-3 border-slate-900 text-3xl font-black rounded-xl cursor-pointer active:scale-95 transition-all shadow-sm"
              >
                {num}
              </button>
            ))}
            <button
              id="lobby-keypad-del"
              onClick={handleBackspace}
              className="py-4 col-span-1 bg-red-100 hover:bg-red-200 border-3 border-slate-900 text-lg font-black rounded-xl cursor-pointer"
            >
              DELETE
            </button>
            <button
              id="lobby-keypad-clear"
              onClick={handleClear}
              className="py-4 col-span-1 bg-zinc-300 hover:bg-zinc-400 border-3 border-slate-900 text-lg font-black rounded-xl cursor-pointer"
            >
              CLEAR
            </button>
          </div>
        </div>

        {/* RIGHT COLUMN: BED SELECTOR & AVATAR CHARACTER CHOOSER */}
        <div className="flex flex-col gap-5">
          {/* BED SELECTOR ROW */}
          <div>
            <label className="block text-lg font-black text-slate-800 uppercase mb-2">
              Step 2: Select Bed Side (A, B, or Single)
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              {[
                { id: "A", label: "Bed A" },
                { id: "B", label: "Bed B" },
                { id: "S", label: "Single Room" },
              ].map((b) => (
                <button
                  key={b.id}
                  id={`lobby-bed-btn-${b.id}`}
                  onClick={() => {
                    setBed(b.id);
                    speak(b.label);
                  }}
                  className={`py-3.5 border-3 rounded-xl font-black text-xl cursor-pointer transition ${
                    bed === b.id
                      ? "bg-slate-905 border-slate-950 text-white"
                      : "bg-white border-zinc-900 hover:bg-slate-100 text-slate-900"
                  }`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>

          {/* AVATAR CHOOSER SCROLL */}
          <div>
            <label className="block text-lg font-black text-slate-800 uppercase mb-2">
              Step 3: Choose Character Avatar
            </label>
            <div className="grid grid-cols-4 gap-2 border-4 border-slate-900 bg-white p-3 rounded-2xl max-h-56 overflow-y-auto">
              {AVATAR_SPECS.map((spec) => (
                <button
                  key={spec.char}
                  id={`lobby-avatar-choice-${spec.char}`}
                  onClick={() => {
                    setSelectedAvatar(spec.char);
                    speak(spec.name);
                  }}
                  className={`relative p-2 rounded-xl flex flex-col items-center justify-center cursor-pointer transition border-3 ${
                    selectedAvatar === spec.char
                      ? "bg-amber-100 border-amber-500 scale-102 ring-2 ring-amber-300"
                      : "bg-slate-50 border-transparent hover:bg-slate-150"
                  }`}
                >
                  <span className="text-4xl filter drop-shadow-md">{spec.char}</span>
                  <span className="text-[10px] font-bold text-slate-800 mt-1 uppercase text-center max-w-full truncate">
                    {spec.name.split(" ")[1] || spec.name}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {errorLabel && (
        <div className="mt-4 p-4 bg-red-100 border-4 border-red-800 rounded-xl font-black text-red-950 text-center">
          ⚠️ {errorLabel}
        </div>
      )}

      {/* BIG SUBMIT BUTTON */}
      <button
        id="lobby-join-submit"
        onClick={handleSubmit}
        className="w-full mt-6 py-5 bg-emerald-500 hover:bg-emerald-600 border-4 border-slate-950 rounded-2xl shadow-xl text-3xl font-black uppercase text-white flex items-center justify-center gap-3 active:scale-95 transition-all cursor-pointer"
      >
        <LogIn size={32} /> Join Connect Room! <ArrowRight size={32} />
      </button>
    </div>
  );
}
