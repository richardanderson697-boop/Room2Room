import React, { useState } from "react";
import { OnlineUser, ChatMessage, GameInvite, PRESET_MESSAGES } from "../types";
import { Send, Volume2, Sparkles, AlertCircle, Gamepad2, ChevronRight, X, Play, MessageSquare, Mic } from "lucide-react";

interface MessagingProps {
  myId: string;
  myLabel: string;
  myAvatar: string;
  onlineUsers: OnlineUser[];
  messages: ChatMessage[];
  invites: GameInvite[];
  onSendMessage: (receiverId: string, text: string) => void;
  onSendInvite: (receiverId: string, gameType: "bingo" | "checkers" | "solitaire" | "uno" | "yahtzee") => void;
  onRespondInvite: (inviteId: string, status: "accepted" | "declined") => void;
  onSelectGameSolo: (gameType: "bingo" | "checkers" | "solitaire" | "uno" | "yahtzee") => void;
  onJoinGameMultiplayer: (gameId: string) => void;
  textScale: "normal" | "large" | "extra-large";
}

export default function Messaging({
  myId,
  myLabel,
  myAvatar,
  onlineUsers,
  messages,
  invites,
  onSendMessage,
  onSendInvite,
  onRespondInvite,
  onSelectGameSolo,
  onJoinGameMultiplayer,
  textScale,
}: MessagingProps) {
  const [selectedRecipientId, setSelectedRecipientId] = useState<string>("all");
  const [customText, setCustomText] = useState<string>("");
  const [activeGameSelectorUser, setActiveGameSelectorUser] = useState<string | null>(null);
  const [isDictating, setIsDictating] = useState<boolean>(false);

  const handleSendCustom = () => {
    if (!customText.trim()) return;
    onSendMessage(selectedRecipientId, customText);
    setCustomText("");
    speak("Message transmitted.");
  };

  const handleSendPreset = (preset: string) => {
    onSendMessage(selectedRecipientId, preset);
    speak(`Sent: ${preset}`);
  };

  // Start Quick Speak Dictation
  const handleStartDictation = () => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      speak("Voice typing is not supported on this browser.");
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => {
        setIsDictating(true);
        speak("Dictating... Speak your message now.");
      };

      recognition.onresult = (event: any) => {
        const result = event.results[0][0].transcript;
        setCustomText((prev) => (prev ? prev + " " + result : result));
        speak(`Heard: ${result}`);
      };

      recognition.onerror = () => {
        speak("I could not hear clearly. Please try again.");
        setIsDictating(false);
      };

      recognition.onend = () => {
        setIsDictating(false);
      };

      recognition.start();
    } catch (err) {
      setIsDictating(false);
    }
  };

  const speak = (phrase: string) => {
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(phrase);
      utterance.rate = 0.82; // seniors like slow clear voice
      window.speechSynthesis.speak(utterance);
    } catch {}
  };

  const sizeClass = 
    textScale === "extra-large" 
      ? "text-3xl" 
      : textScale === "large" 
      ? "text-2xl" 
      : "text-xl";

  const btnTextSize = 
    textScale === "extra-large" 
      ? "text-xl font-bold" 
      : textScale === "large" 
      ? "text-lg font-bold" 
      : "text-sm font-semibold";

  const activeInvitesIn = invites.filter((inv) => inv.receiverId === myId && inv.status === "pending");

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 max-w-6xl mx-auto p-4 select-none">
      
      {/* 1. LEFT SIDEBAR PANEL: SYSTEM USER STATS & ONLINE DIRECTORY (COL 4) */}
      <div className="lg:col-span-4 flex flex-col gap-5">
        
        {/* PLAYER CONSOLE CHIP */}
        <div className="bg-slate-900 text-white rounded-2xl border-4 border-slate-950 p-4 shadow-md flex items-center gap-3">
          <span className="text-5xl filter drop-shadow bg-slate-800 p-2 rounded-xl border border-slate-700">
            {myAvatar}
          </span>
          <div>
            <span className="text-[10px] uppercase font-black tracking-widest text-emerald-400">
              Active Member Resident
            </span>
            <h3 className="text-xl font-black">{myLabel}</h3>
            <span className="text-xs bg-slate-800 text-zinc-305 font-bold px-2 py-0.5 rounded border border-slate-700 mt-1 inline-block">
              ID: {myId}
            </span>
          </div>
        </div>

        {/* ACTIVE ONLINE DIRECTORY */}
        <div className="bg-white rounded-2xl border-4 border-slate-900 p-4 shadow flex flex-col gap-3">
          <h2 className="text-lg font-black uppercase text-slate-800 border-b-2 border-slate-100 pb-1.5 flex items-center justify-between">
            <span>👥 Connected Rooms</span>
            <span className="bg-slate-900 text-white text-xs font-black px-2 py-0.5 rounded-full">
              {onlineUsers.length}
            </span>
          </h2>

          <div className="flex flex-col gap-2 max-h-72 overflow-y-auto pr-1">
            {/* PUBLIC CHAT TAB BUTTON */}
            <button
              id="directory-tab-all"
              onClick={() => setSelectedRecipientId("all")}
              className={`w-full flex items-center gap-3 p-3 rounded-xl border-3 text-left transition cursor-pointer ${
                selectedRecipientId === "all"
                  ? "bg-slate-905 border-slate-950 text-white"
                  : "bg-slate-100 border-slate-200 hover:bg-slate-150 text-slate-900"
              }`}
            >
              <span className="text-2xl">📢</span>
              <div>
                <span className="font-extrabold block text-sm md:text-base leading-none">
                  Universal Lodge Chat
                </span>
                <span className="text-xs opacity-75 mt-0.5 block">Broadcast to all rooms</span>
              </div>
            </button>

            {/* LIST ACTIVE USERS */}
            {onlineUsers.map((user) => (
              <div
                key={user.id}
                className={`w-full flex items-center justify-between p-3 rounded-xl border-3 text-left transition ${
                  selectedRecipientId === user.id
                    ? "bg-amber-100 border-amber-500 text-slate-950"
                    : "bg-slate-50 border-slate-150 hover:bg-slate-100 text-slate-900"
                }`}
              >
                <div 
                  onClick={() => setSelectedRecipientId(user.id)} 
                  className="flex items-center gap-3 cursor-pointer flex-grow"
                >
                  <span className="text-3.5xl p-1 bg-white rounded-lg border-2 border-slate-350">{user.avatar}</span>
                  <div>
                    <span className="font-extrabold block text-sm md:text-base leading-none">
                      {user.label}
                    </span>
                    <span className="text-xs text-slate-500 font-medium block mt-0.5">Click to talk</span>
                  </div>
                </div>

                {/* GAME TRIGGER FROM CHAT */}
                <button
                  id={`directory-invite-btn-${user.id}`}
                  onClick={() => setActiveGameSelectorUser(user.id)}
                  className="bg-slate-900 text-white border-2 border-slate-950 p-2 rounded-xl hover:bg-slate-850 cursor-pointer"
                  title="Challenge to Game"
                >
                  <Gamepad2 size={20} />
                </button>
              </div>
            ))}

            {onlineUsers.length === 0 && (
              <p className="text-xs italic text-slate-500 text-center py-4">
                No other facility beds are online right now. Practice solo games below!
              </p>
            )}
          </div>
        </div>

        {/* SOLO PRACTICE GAMES */}
        <div className="bg-sky-50 rounded-2xl border-4 border-sky-900 p-4 shadow">
          <h2 className="text-lg font-black uppercase text-sky-950 border-b-2 border-sky-800 pb-1.5 flex items-center gap-2">
            🚀 Solo Practice Suite
          </h2>
          <p className="text-xs font-semibold text-sky-800 mt-1 mb-3">
            Relax and play cards or roll dice completely independently!
          </p>

          <div className="grid grid-cols-2 gap-2">
            {(["bingo", "checkers", "solitaire", "uno", "yahtzee"] as const).map((game) => (
              <button
                key={game}
                id={`solo-game-launch-${game}`}
                onClick={() => {
                  onSelectGameSolo(game);
                  speak(`Launching Solo ${game}`);
                }}
                className="bg-white hover:bg-sky-100 border-3 border-sky-900 font-bold p-3 rounded-xl uppercase text-xs md:text-sm tracking-tight text-sky-950 flex flex-col items-center gap-1 cursor-pointer transition shadow-sm"
              >
                <span className="text-xl">
                  {game === "bingo" ? "🍀" : game === "checkers" ? "🔴" : game === "solitaire" ? "🃏" : game === "uno" ? "🌈" : "🎲"}
                </span>
                {game}
              </button>
            ))}
          </div>
        </div>

      </div>

      {/* 2. CHAT FEED & MESSAGE CHIPS AREA (COL 8) */}
      <div className="lg:col-span-8 flex flex-col gap-5">
        
        {/* GAME INVITATION RECEIVED ALERT */}
        {activeInvitesIn.length > 0 && (
          <div className="bg-rose-100 border-4 border-rose-800 rounded-3xl p-4 shadow-lg">
            <h2 className="text-lg font-black text-rose-950 uppercase mb-3 flex items-center gap-2">
              🔔 Incoming Game Invitation!
            </h2>
            <div className="flex flex-col gap-3">
              {activeInvitesIn.map((inv) => (
                <div
                  key={inv.id}
                  className="bg-white border-3 border-rose-900 p-4 rounded-2xl flex flex-col md:flex-row items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-4xl p-1 bg-rose-50 rounded-lg">{inv.senderAvatar}</span>
                    <div>
                      <span className="font-extrabold text-slate-805 block">
                        {inv.senderLabel} invites you to play:
                      </span>
                      <span className="text-lg font-black uppercase text-rose-850">
                        {inv.gameType} Matches!
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 w-full md:w-auto">
                    <button
                      id={`invite-accept-${inv.id}`}
                      onClick={() => {
                        onRespondInvite(inv.id, "accepted");
                        speak(`Accepted game match for ${inv.gameType}`);
                      }}
                      className="flex-1 md:flex-initial bg-emerald-500 text-white border-2 border-emerald-950 px-5 py-2 rounded-xl font-bold hover:bg-emerald-600 cursor-pointer"
                    >
                      Accept
                    </button>
                    <button
                      id={`invite-decline-${inv.id}`}
                      onClick={() => {
                        onRespondInvite(inv.id, "declined");
                        speak("Declined invitation.");
                      }}
                      className="flex-1 md:flex-initial bg-red-100 text-red-950 border-2 border-red-950 px-4 py-2 rounded-xl font-bold hover:bg-red-200 cursor-pointer"
                    >
                      No, thanks
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DETAILED CHAT SCRIBBER COMPOSER */}
        <div className="bg-white rounded-3xl border-4 border-slate-900 p-4 md:p-6 shadow flex flex-col gap-4 flex-grow min-h-[380px]">
          
          {/* HEADER CHAT TARGET */}
          <div className="flex items-center justify-between border-b-4 border-slate-900 pb-3">
            <h2 className={`${sizeClass} font-black uppercase flex items-center gap-2`}>
              💬 {selectedRecipientId === "all" ? "Lodge Universal Board" : "Direct Friendly Room Chat"}
            </h2>
            <span className="text-xs font-bold text-slate-500">
              Sending to: {selectedRecipientId === "all" ? "A-Lodge" : `${selectedRecipientId}`}
            </span>
          </div>

          {/* CHAT MESSAGES STREAM */}
          <div className="flex-grow max-h-80 overflow-y-auto flex flex-col gap-2.5 p-1 border-4 border-dashed border-slate-100 bg-slate-50 rounded-2xl p-3 shadow-inner">
            {messages.length === 0 && (
              <p className="text-sm italic text-slate-400 text-center py-10">
                No facility correspondence yet. Press presets below to transmit greetings!
              </p>
            )}
            
            {messages.map((m) => {
              const isMine = m.senderId === myId;
              
              return (
                <div
                  key={m.id}
                  className={`flex flex-col ${isMine ? "items-end" : "items-start"} max-w-[85%] ${
                    isMine ? "ml-auto" : "mr-auto"
                  }`}
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm">{m.senderAvatar}</span>
                    <span className="text-xs font-black text-slate-550">
                      {isMine ? "You" : m.senderLabel}
                    </span>
                  </div>

                  <div className="flex items-start gap-2 group">
                    <div
                      className={`px-4.5 py-3 rounded-2xl border-3 text-lg font-extrabold ${
                        isMine
                          ? "bg-slate-900 border-slate-950 text-white rounded-tr-none"
                          : "bg-white border-slate-900 text-slate-900 rounded-tl-none shadow-sm"
                      }`}
                    >
                      {m.text}
                    </div>

                    {/* SPEECH SYNTHESIS SPEAKER */}
                    <button
                      id={`msg-synthesize-${m.id}`}
                      onClick={() => speak(`${m.senderLabel.split(" ")[0]} says ${m.text}`)}
                      className="p-2 border-2 border-slate-905 bg-zinc-100 text-slate-950 hover:bg-zinc-200 rounded-full cursor-pointer mt-1"
                      title="Read Message Out Loud"
                    >
                      <Volume2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* QUICK SENIOR PRESET CHIPS GRID */}
          <div>
            <span className="text-xs font-black uppercase text-slate-500 block mb-2">
              👋 Fast Senior Tap-to-Talk Greetings:
            </span>
            <div className="flex flex-wrap gap-2.5">
              {PRESET_MESSAGES.map((preset) => (
                <button
                  key={preset}
                  id={`preset-msg-${preset}`}
                  onClick={() => handleSendPreset(preset)}
                  className={`border-3 border-slate-900 hover:border-amber-500 px-4 py-2 bg-slate-100 text-slate-950 text-md font-extrabold rounded-xl cursor-pointer hover:bg-amber-50 active:scale-95 transition-all`}
                >
                  {preset}
                </button>
              ))}
            </div>
          </div>

          {/* TEXT BOX CUSTOM MESSAGE INPUT WRAPPER */}
          <div className="flex gap-2.5 border-t-2 border-slate-100 pt-3">
            <input
              id="message-custom-input"
              type="text"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Write custom message or tap dictation icon..."
              className="flex-grow border-4 border-slate-900 rounded-2xl p-4 text-lg font-extrabold bg-white"
              onKeyDown={(e) => e.key === "Enter" && handleSendCustom()}
            />

            {/* SPEAK DICTATION TYPER */}
            <button
              id="message-dictate-btn"
              onClick={handleStartDictation}
              className={`p-4 border-4 border-slate-900 rounded-2xl flex items-center justify-center cursor-pointer transition ${
                isDictating 
                  ? "bg-red-500 border-red-950 text-white animate-pulse" 
                  : "bg-yellow-250 hover:bg-yellow-100 text-slate-950"
              }`}
              title="Voice Type / Dictate Message"
            >
              <Mic size={24} />
            </button>

            <button
              id="message-send-btn"
              onClick={handleSendCustom}
              className="bg-emerald-500 hover:bg-emerald-600 border-4 border-slate-900 text-white rounded-2xl px-6 py-4 flex items-center justify-center gap-2 cursor-pointer transition"
            >
              <Send size={20} />
              <span className="font-extrabold text-lg">Transmit</span>
            </button>
          </div>

        </div>

      </div>

      {/* 3. POPUP MODAL: GAME CHALLENGE invitation SELECTION */}
      {activeGameSelectorUser && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border-8 border-slate-900 p-6 md:p-8 rounded-3xl max-w-lg w-full flex flex-col gap-5 shadow-2xl animate-in fade-in-50">
            <div className="flex items-center justify-between border-b-2 border-slate-200 pb-3">
              <h3 className="text-2xl font-black uppercase text-slate-900">
                🎮 Invite to a Game
              </h3>
              <button
                id="modal-game-select-close"
                onClick={() => setActiveGameSelectorUser(null)}
                className="p-1 border-2 border-slate-900 rounded-full hover:bg-slate-100 cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <p className="font-extrabold text-slate-700 text-sm md:text-base leading-snug">
              Select which game you want to invite Room resident to play:
            </p>

            <div className="flex flex-col gap-2.5">
              {[
                { id: "bingo", label: "Bingo (Multple Board Match)", color: "border-emerald-600 bg-emerald-50 text-emerald-950", icon: "🍀" },
                { id: "checkers", label: "Checkers Match", color: "border-red-600 bg-red-50 text-red-950", icon: "🔴" },
                { id: "uno", label: "Uno Color Card Match", color: "border-yellow-600 bg-yellow-50 text-yellow-950", icon: "🌈" },
                { id: "yahtzee", label: "Yahtzee Hand Dice Match", color: "border-sky-600 bg-sky-50 text-sky-950", icon: "🎲" },
              ].map((g) => (
                <button
                  key={g.id}
                  id={`modal-invite-game-${g.id}`}
                  onClick={() => {
                    if (activeGameSelectorUser) {
                      onSendInvite(activeGameSelectorUser, g.id as any);
                      setActiveGameSelectorUser(null);
                      speak(`Game invitation transmitted.`);
                    }
                  }}
                  className={`w-full flex items-center gap-3 p-4 border-3 rounded-2xl cursor-pointer text-left transition hover:scale-101 ${g.color}`}
                >
                  <span className="text-3xl">{g.icon}</span>
                  <span className="text-lg font-black uppercase tracking-tight">
                    {g.label}
                  </span>
                </button>
              ))}
            </div>

            <button
              id="modal-game-cancel"
              onClick={() => setActiveGameSelectorUser(null)}
              className="bg-zinc-150 border-3 border-zinc-900 py-3 rounded-2xl text-lg font-black uppercase hover:bg-zinc-200 cursor-pointer text-slate-900"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
