import React, { useState, useEffect, useRef } from "react";
import Lobby from "./components/Lobby";
import Messaging from "./components/Messaging";
import VoiceAssistant from "./components/VoiceAssistant";

// Games
import Bingo from "./games/Bingo";
import Checkers from "./games/Checkers";
import Solitaire from "./games/Solitaire";
import Uno from "./games/Uno";
import Yahtzee from "./games/Yahtzee";

// Types
import { Player, OnlineUser, ChatMessage, GameInvite, GameSession, AccessibilitySettings } from "./types";
import { LogOut, ArrowLeft, ZoomIn, ZoomOut, Maximize, RefreshCw, AlertTriangle, HelpCircle } from "lucide-react";

export default function App() {
  // Registration Profile
  const [player, setPlayer] = useState<Player | null>(null);

  // Active Layout view Panel
  const [activeScreen, setActiveScreen] = useState<
    "lobby" | "messaging" | "bingo" | "checkers" | "solitaire" | "uno" | "yahtzee"
  >("lobby");

  // Server Poll State
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [invites, setInvites] = useState<GameInvite[]>([]);
  const [activeGameSession, setActiveGameSession] = useState<GameSession | null>(null);

  // Connection Indicator
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Accessibility Scaling Controls
  const [accessibility, setAccessibility] = useState<AccessibilitySettings>({
    textScale: "normal",
    voiceActive: false,
    speakMessages: true,
    colorTheme: "high-contrast-light",
  });

  const lastMsgCountRef = useRef<number>(0);

  // API Call helper
  const apiCall = async (endpoint: string, bodyJson: any) => {
    try {
      setIsSyncing(true);
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(bodyJson),
      });

      const data = await res.json();
      if (data.error) {
        if (data.registerRequired) {
          // Session expired on server side
          setPlayer(null);
          setActiveScreen("lobby");
          speak("Your session has timed out. Please register again.");
        }
        return { error: data.error };
      }
      return data;
    } catch (err) {
      console.error(`API Error on ${endpoint}:`, err);
      return { error: "Network sync error" };
    } finally {
      setIsSyncing(false);
    }
  };

  // Register Player
  const handleRegisterPlayer = async (room: string, bed: string, avatar: string) => {
    setErrorMessage("");
    const res = await apiCall("/api/register", { room, bed, avatar });

    if (res.error) {
      setErrorMessage(res.error);
      return;
    }

    if (res.player) {
      setPlayer(res.player);
      setActiveScreen("messaging");
    }
  };

  // Read incoming messages out loud if enabled on changes
  const speak = (phrase: string) => {
    if (!("speechSynthesis" in window) || !accessibility.speakMessages) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(phrase);
      utterance.rate = 0.82;
      window.speechSynthesis.speak(utterance);
    } catch {}
  };

  // Poll Heartbeat
  useEffect(() => {
    if (!player) return;

    let consecutiveFailures = 0;

    const doHeartbeat = async () => {
      const res = await apiCall("/api/heartbeat", { playerId: player.id });

      if (res.error) {
        consecutiveFailures++;
        if (consecutiveFailures >= 3) {
          setErrorMessage(res.error);
        }
        return;
      }

      consecutiveFailures = 0;
      setErrorMessage("");

      // Update users
      if (res.players) {
        setOnlineUsers(res.players);
      }

      // Update Messages and prompt incoming reads
      if (res.messages) {
        setMessages(res.messages);

        // Check if new messages arrived
        const currentCount = res.messages.length;
        if (currentCount > lastMsgCountRef.current && lastMsgCountRef.current > 0) {
          const newest = res.messages[currentCount - 1];
          // If message is from someone else, read it
          if (newest.senderId !== player.id) {
            speak(`New message from ${newest.senderLabel.split(" ")[0]}. "${newest.text}"`);
          }
        }
        lastMsgCountRef.current = currentCount;
      }

      // Update invites
      if (res.invites) {
        setInvites(res.invites);
      }

      // Reconcile Multiplayer Game Sessions
      if (res.activeGames && res.activeGames.length > 0) {
        const myGame = res.activeGames[0] as GameSession;
        setActiveGameSession(myGame);

        // AUTO-TRANSITION TO ACTIVE MULTIPLAYER MATCH
        if (activeScreen === "messaging" || activeScreen === "lobby") {
          setActiveScreen(myGame.gameType as any);
          speak(`A multiplayer ${myGame.gameType} match has started with Room ${myGame.players.find(p => p !== player.id)?.split("-")[0]}!`);
        }
      } else {
        // If we were in a multiplayer screen, but game session disappeared, kick to lobby
        if (
          activeGameSession &&
          (activeScreen === "bingo" ||
            activeScreen === "checkers" ||
            activeScreen === "uno" ||
            activeScreen === "yahtzee") &&
          res.activeGames &&
          res.activeGames.length === 0
        ) {
          setActiveGameSession(null);
          setActiveScreen("messaging");
          speak("The multiplayer game session has ended. Returning to lobby.");
        }
      }
    };

    // Immediate poll
    doHeartbeat();

    // Constant 2.5s polling loop
    const interval = setInterval(doHeartbeat, 2500);

    return () => clearInterval(interval);
  }, [player, activeScreen, activeGameSession, accessibility.speakMessages]);

  // Command handlers
  const handleSendMessage = async (receiverId: string, text: string) => {
    if (!player) return;
    await apiCall("/api/message", {
      senderId: player.id,
      receiverId,
      text,
    });
  };

  const handleSendInvite = async (
    receiverId: string,
    gameType: "bingo" | "checkers" | "solitaire" | "uno" | "yahtzee"
  ) => {
    if (!player) return;
    await apiCall("/api/invite", {
      senderId: player.id,
      receiverId,
      gameType,
    });
  };

  const handleRespondInvite = async (inviteId: string, status: "accepted" | "declined") => {
    const res = await apiCall("/api/invite/respond", { inviteId, status });
    if (res.gameId && status === "accepted") {
      // Transition immediately
      setActiveScreen("messaging"); // heart beat will pull and transfer us
    }
  };

  const handleUpdateMPGameState = async (newState: any) => {
    if (!player || !activeGameSession) return;
    await apiCall("/api/game/action", {
      gameId: activeGameSession.id,
      playerId: player.id,
      state: newState,
    });
  };

  const handleLeaveActiveGame = async () => {
    if (activeGameSession && player) {
      await apiCall("/api/game/leave", {
        gameId: activeGameSession.id,
        playerId: player.id,
      });
      setActiveGameSession(null);
    }
    setActiveScreen("messaging");
    speak("Returned to Lobby");
  };

  const handleSelectGameSolo = (gameType: "bingo" | "checkers" | "solitaire" | "uno" | "yahtzee") => {
    setActiveGameSession(null); // Clear mp session for solo
    setActiveScreen(gameType);
  };

  const readLastIncomingMessageOutLoud = () => {
    if (!player) return;
    const incomingOnly = messages.filter((m) => m.senderId !== player.id);
    if (incomingOnly.length > 0) {
      const topMsg = incomingOnly[incomingOnly.length - 1];
      speak(`Last message from ${topMsg.senderLabel.split(" ")[0]}. "${topMsg.text}"`);
    } else {
      speak("No incoming messages in board yet.");
    }
  };

  // Magnifier Toggles
  const handleIncreaseTextScale = () => {
    setAccessibility((prev) => {
      const next: "normal" | "large" | "extra-large" =
        prev.textScale === "normal"
          ? "large"
          : prev.textScale === "large"
          ? "extra-large"
          : "extra-large";
      speak(`Text size altered to ${next}`);
      return { ...prev, textScale: next };
    });
  };

  const handleDecreaseTextScale = () => {
    setAccessibility((prev) => {
      const next: "normal" | "large" | "extra-large" =
        prev.textScale === "extra-large"
          ? "large"
          : prev.textScale === "large"
          ? "normal"
          : "normal";
      speak(`Text size altered to ${next}`);
      return { ...prev, textScale: next };
    });
  };

  const handleLogout = () => {
    setPlayer(null);
    setActiveGameSession(null);
    setActiveScreen("lobby");
    speak("Log out complete. Safe travels!");
  };

  // Convert settings scale to Tailwind utility mapping
  const scaleClassMap = {
    normal: "font-sans text-base",
    large: "text-lg md:text-xl font-medium",
    "extra-large": "text-2xl md:text-3xl font-bold tracking-tight",
  };

  const headerTitleScale =
    accessibility.textScale === "extra-large"
      ? "text-4xl shadow-inner leading-none"
      : accessibility.textScale === "large"
      ? "text-3xl"
      : "text-2xl";

  const isGameView =
    activeScreen === "bingo" ||
    activeScreen === "checkers" ||
    activeScreen === "solitaire" ||
    activeScreen === "uno" ||
    activeScreen === "yahtzee";

  return (
    <div
      className={`min-h-screen flex flex-col p-2 md:p-6 transition-colors duration-300 ${scaleClassMap[accessibility.textScale]} ${
        accessibility.colorTheme === "high-contrast-light"
          ? "bg-stone-100 text-stone-900"
          : "bg-zinc-950 text-zinc-50"
      }`}
    >
      {/* 1. FACILITY SYSTEM HEADER */}
      <header className="w-full max-w-6xl mx-auto border-4 border-slate-900 bg-white text-slate-900 rounded-3xl p-4 md:p-6 shadow-md mb-6 flex flex-col md:flex-row items-center justify-between gap-4 select-none">
        
        <div className="flex items-center gap-3">
          <div className="bg-slate-900 text-white p-3 rounded-2xl border-2 border-slate-950">
            <Maximize className="w-6 h-6 rotate-45" />
          </div>
          <div>
            <h1 id="app-title-header" className={`${headerTitleScale} font-black uppercase tracking-tight`}>
              Room 2 Room Connect
            </h1>
            <span className="text-xs font-black uppercase tracking-widest text-slate-500 block leading-none mt-1">
              Active Senior Multi-Lobby
            </span>
          </div>
        </div>

        {/* ACCESSIBILITY TUNERS FOR RETINAL/VISUAL SENSITIVITY */}
        <div className="flex flex-wrap items-center gap-2">
          
          <button
            id="global-scale-decrease"
            onClick={handleDecreaseTextScale}
            className="flex items-center gap-1 bg-stone-200 hover:bg-stone-300 border-4 border-slate-900 font-extrabold px-3 py-2.5 rounded-xl cursor-pointer"
            title="Slightly Smaller Text Sizing"
          >
            <ZoomOut size={20} />
            <span className="text-xs">Smaller Font</span>
          </button>

          <button
            id="global-scale-increase"
            onClick={handleIncreaseTextScale}
            className="flex items-center gap-1 bg-amber-200 hover:bg-amber-350 border-4 border-slate-900 font-extrabold px-3 py-2.5 rounded-xl cursor-pointer animate-pulse"
            title="Slightly Larger Text Sizing"
          >
            <ZoomIn size={20} />
            <span className="text-xs font-black">MAGNIFY TEXT 🔍</span>
          </button>

          {player && (
            <button
              id="global-member-logout"
              onClick={handleLogout}
              className="flex items-center gap-1 bg-red-100 hover:bg-red-205 text-red-950 border-4 border-slate-900 font-extrabold px-4 py-2.5 rounded-xl cursor-pointer"
            >
              <LogOut size={18} />
              <span className="text-xs">Log Out</span>
            </button>
          )}

        </div>
      </header>

      {/* 2. DYNAMIC VOICE ASSISTANT BAR WRAPPER FOR SENIORS */}
      {player && (
        <div className="w-full max-w-6xl mx-auto mb-6">
          <VoiceAssistant
            onNavTrigger={(act) => {
              if (act === "lobby") {
                handleLeaveActiveGame();
              } else {
                handleSelectGameSolo(act);
              }
            }}
            onReadLastMessage={readLastIncomingMessageOutLoud}
            voiceActive={accessibility.voiceActive}
            onToggleVoice={(act) => setAccessibility((prev) => ({ ...prev, voiceActive: act }))}
            speakMessages={accessibility.speakMessages}
            onToggleSpeakMessages={(act) => setAccessibility((prev) => ({ ...prev, speakMessages: act }))}
            textScale={accessibility.textScale}
          />
        </div>
      )}

      {/* 3. SYNC AND NETWORK ERROR CONSOLE */}
      {errorMessage && (
        <div className="w-full max-w-6xl mx-auto mb-6 p-4 bg-orange-100 border-4 border-orange-850 text-orange-950 font-black rounded-2xl flex items-center gap-3">
          <AlertTriangle className="text-orange-900 flex-shrink-0 animate-bounce" />
          <span>Local Sync Error: {errorMessage}</span>
          <button
            onClick={() => window.location.reload()}
            className="ml-auto bg-orange-800 text-white border-2 border-orange-950 font-bold px-3 py-1 rounded-lg text-xs"
          >
            Reload Tab
          </button>
        </div>
      )}

      {/* 4. GAME VIEW COMPANION - BACK TRANSITION CONTROL HEADER */}
      {isGameView && (
        <div className="w-full max-w-5xl mx-auto mb-6">
          <button
            id="game-exit-to-lobby-btn"
            onClick={handleLeaveActiveGame}
            className="w-full bg-slate-900 text-white hover:bg-slate-850 border-4 border-slate-950 py-4.5 rounded-2xl font-black text-2xl uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer shadow-lg active:scale-[0.98] transition-transform"
          >
            <ArrowLeft size={28} /> 🔙 EXIT GAME & RETURN TO ROOM LOBBY
          </button>
        </div>
      )}

      {/* 5. MAIN CORE LAYOUT CONDITIONAL CONTENT SCREEN */}
      <main className="flex-grow w-full max-w-6xl mx-auto">
        {player === null ? (
          <Lobby onRegister={handleRegisterPlayer} textScale={accessibility.textScale} />
        ) : (
          <>
            {activeScreen === "messaging" && (
              <Messaging
                myId={player.id}
                myLabel={`Room ${player.room} (Bed ${player.bed})`}
                myAvatar={player.avatar}
                onlineUsers={onlineUsers}
                messages={messages}
                invites={invites}
                onSendMessage={handleSendMessage}
                onSendInvite={handleSendInvite}
                onRespondInvite={handleRespondInvite}
                onSelectGameSolo={handleSelectGameSolo}
                onJoinGameMultiplayer={() => {}}
                textScale={accessibility.textScale}
              />
            )}

            {activeScreen === "bingo" && (
              <Bingo
                playerId={player.id}
                opponentId={activeGameSession?.players.find((p) => p !== player.id) || null}
                opponentDetails={
                  activeGameSession
                    ? activeGameSession.playerDetails[
                        activeGameSession.players.find((p) => p !== player.id) || ""
                      ] || null
                    : null
                }
                gameState={activeGameSession?.state || null}
                onUpdateGame={handleUpdateMPGameState}
                textScale={accessibility.textScale}
              />
            )}

            {activeScreen === "checkers" && (
              <Checkers
                playerId={player.id}
                opponentId={activeGameSession?.players.find((p) => p !== player.id) || null}
                opponentDetails={
                  activeGameSession
                    ? activeGameSession.playerDetails[
                        activeGameSession.players.find((p) => p !== player.id) || ""
                      ] || null
                    : null
                }
                gameState={activeGameSession?.state || null}
                onUpdateGame={handleUpdateMPGameState}
                textScale={accessibility.textScale}
              />
            )}

            {activeScreen === "solitaire" && (
              <Solitaire
                playerId={player.id}
                opponentId={activeGameSession?.players.find((p) => p !== player.id) || null}
                opponentDetails={
                  activeGameSession
                    ? activeGameSession.playerDetails[
                        activeGameSession.players.find((p) => p !== player.id) || ""
                      ] || null
                    : null
                }
                gameState={activeGameSession?.state || null}
                onUpdateGame={handleUpdateMPGameState}
                textScale={accessibility.textScale}
              />
            )}

            {activeScreen === "uno" && (
              <Uno
                playerId={player.id}
                opponentId={activeGameSession?.players.find((p) => p !== player.id) || null}
                opponentDetails={
                  activeGameSession
                    ? activeGameSession.playerDetails[
                        activeGameSession.players.find((p) => p !== player.id) || ""
                      ] || null
                    : null
                }
                gameState={activeGameSession?.state || null}
                onUpdateGame={handleUpdateMPGameState}
                textScale={accessibility.textScale}
              />
            )}

            {activeScreen === "yahtzee" && (
              <Yahtzee
                playerId={player.id}
                opponentId={activeGameSession?.players.find((p) => p !== player.id) || null}
                opponentDetails={
                  activeGameSession
                    ? activeGameSession.playerDetails[
                        activeGameSession.players.find((p) => p !== player.id) || ""
                      ] || null
                    : null
                }
                gameState={activeGameSession?.state || null}
                onUpdateGame={handleUpdateMPGameState}
                textScale={accessibility.textScale}
              />
            )}
          </>
        )}
      </main>

      {/* 6. BOTTOM MARGINS BRUTALIST ATTRIBUTES (No telemetry, plain, humble footer) */}
      <footer className="mt-12 py-6 border-t-2 border-stone-200 text-center text-xs font-mono text-stone-500 max-w-6xl mx-auto uppercase">
        Room 2 Room Connect • Senior Care Facility Communication Hub • Offline Local Persistence
      </footer>
    </div>
  );
}
