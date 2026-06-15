import React, { useState, useEffect, useRef } from "react";
import Lobby from "./components/Lobby";
import Messaging from "./components/Messaging";
import VoiceAssistant from "./components/VoiceAssistant";
import AnnouncementComposer from "./components/AnnouncementComposer";
import { getPersistedItem, setPersistedItem } from "./db";
import { speakPhrase } from "./speech";

// Games
import Bingo from "./games/Bingo";
import Checkers from "./games/Checkers";
import Solitaire from "./games/Solitaire";
import Uno from "./games/Uno";
import Yahtzee from "./games/Yahtzee";

// Types
import { Player, OnlineUser, ChatMessage, GameInvite, GameSession, AccessibilitySettings, Announcement } from "./types";
import { LogOut, ArrowLeft, ZoomIn, ZoomOut, Maximize, RefreshCw, AlertTriangle, HelpCircle, Megaphone, ShieldAlert } from "lucide-react";

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
  const [joinableGames, setJoinableGames] = useState<any[]>([]);
  const [invitedJoinProgressGame, setInvitedJoinProgressGame] = useState<any | null>(null);
  const [hasPromptedJoinProgress, setHasPromptedJoinProgress] = useState<boolean>(false);

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

  // Announcements & Staff States
  const [activeAnnouncement, setActiveAnnouncement] = useState<Announcement | null>(null);
  const [dismissedAnnouncements, setDismissedAnnouncements] = useState<string[]>([]);
  const [staffLogs, setStaffLogs] = useState<Announcement[]>([]);
  const [isStaffDevice, setIsStaffDevice] = useState<boolean>(false);
  const [showAnnouncementComposer, setShowAnnouncementComposer] = useState<boolean>(false);
  const [facilityPinSet, setFacilityPinSet] = useState<boolean>(false);

  // Load staff device memory from database on mount
  useEffect(() => {
    getPersistedItem("isStaffDevice")
      .then((val) => {
        if (val === true) {
          setIsStaffDevice(true);
        }
      })
      .catch(() => {});
  }, []);

  const lastMsgCountRef = useRef<number>(0);

  // Stable tracking for polling loop values to prevent infinite re-trigger loop
  const activeScreenRef = useRef(activeScreen);
  const activeGameSessionRef = useRef(activeGameSession);
  const speakMessagesRef = useRef(accessibility.speakMessages);

  useEffect(() => {
    activeScreenRef.current = activeScreen;
  }, [activeScreen]);

  useEffect(() => {
    activeGameSessionRef.current = activeGameSession;
  }, [activeGameSession]);

  useEffect(() => {
    speakMessagesRef.current = accessibility.speakMessages;
  }, [accessibility.speakMessages]);

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
  const handleRegisterPlayer = async (room: string, bed: string, avatar: string, pin?: string, staffName?: string) => {
    setErrorMessage("");
    const res = await apiCall("/api/register", { room, bed, avatar, pin, staffName });

    if (res.error) {
      setErrorMessage(res.error);
      setIsStaffDevice(false);
      await setPersistedItem("isStaffDevice", false);
      return;
    }

    if (res.player) {
      setPlayer(res.player);
      setHasPromptedJoinProgress(false);
      setInvitedJoinProgressGame(null);
      setActiveScreen("messaging");

      if (res.player.isStaff) {
        setIsStaffDevice(true);
        await setPersistedItem("isStaffDevice", true);
        speak(`Welcome, ${res.player.staffName || "Staff"}. Staff Mode has been successfully unlocked on your device.`);
      } else {
        setIsStaffDevice(false);
        await setPersistedItem("isStaffDevice", false);
        if (pin) {
          speak("Incorrect facility PIN. Registering as a standard room resident instead.");
        }
      }
    }
  };

  // Read incoming messages out loud if enabled on changes
  const speak = (phrase: string) => {
    speakPhrase(phrase, speakMessagesRef.current);
  };

  const dismissedAnnRef = useRef<string[]>([]);
  const activeAnnRef = useRef<Announcement | null>(null);

  const handleDismissAnnouncement = (annId: string) => {
    setDismissedAnnouncements((prev) => {
      const updated = [...prev, annId];
      dismissedAnnRef.current = updated;
      return updated;
    });
    setActiveAnnouncement(null);
    activeAnnRef.current = null;
    speak("Announcement cleared.");
  };

  const handleReportAnnouncement = async (annId: string) => {
    if (!player) return;
    await apiCall("/api/announcement/report", {
      announcementId: annId,
      reportedBy: player.isStaff ? (player.staffName || "Staff") : `Room ${player.room} (Bed ${player.bed})`,
    });
    handleDismissAnnouncement(annId);
    speak("Thank you, this broadcast was flagged and reported.");
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

      // Reconcile Announcements
      if (res.announcements) {
        const undismissed = res.announcements.filter((ann: any) => !dismissedAnnRef.current.includes(ann.id));
        if (undismissed.length > 0) {
          const newestAnn = undismissed[undismissed.length - 1];
          if (!activeAnnRef.current || activeAnnRef.current.id !== newestAnn.id) {
            setActiveAnnouncement(newestAnn);
            activeAnnRef.current = newestAnn;
            speak(`Facility broadcast announcement from ${newestAnn.senderLabel}. "${newestAnn.text}"`);
          }
        } else {
          setActiveAnnouncement(null);
          activeAnnRef.current = null;
        }
      } else {
        setActiveAnnouncement(null);
        activeAnnRef.current = null;
      }

      if (res.staffLogs) {
        setStaffLogs(res.staffLogs);
      }

      if (typeof res.facilityPinSet === "boolean") {
        setFacilityPinSet(res.facilityPinSet);
      }

      // Reconcile Joinable Games
      if (res.joinableGames) {
        setJoinableGames(res.joinableGames);

        // Ask someone registering or logging in if they want to join a Bingo/Uno/Yahtzee game already in progress Y/N
        if (!hasPromptedJoinProgress && res.joinableGames.length > 0) {
          const matchToJoin = res.joinableGames.find(
            (g: any) => g.gameType === "bingo" || g.gameType === "uno" || g.gameType === "yahtzee"
          );
          if (matchToJoin) {
            setInvitedJoinProgressGame(matchToJoin);
            setHasPromptedJoinProgress(true); // only prompt once
          }
        }
      }

      // Reconcile Multiplayer Game Sessions
      if (res.activeGames && res.activeGames.length > 0) {
        const myGame = res.activeGames[0] as GameSession;
        setActiveGameSession(myGame);

        // AUTO-TRANSITION TO ACTIVE MULTIPLAYER MATCH
        const currentScreen = activeScreenRef.current;
        if (currentScreen === "messaging" || currentScreen === "lobby") {
          setActiveScreen(myGame.gameType as any);
          speak(`A multiplayer ${myGame.gameType} match has started with Room ${myGame.players.find(p => p !== player.id)?.split("-")[0]}!`);
        }
      } else {
        // If we were in a multiplayer screen, but game session disappeared, kick to lobby
        const currentScreen = activeScreenRef.current;
        const currentGameSession = activeGameSessionRef.current;
        if (
          currentGameSession &&
          (currentScreen === "bingo" ||
            currentScreen === "checkers" ||
            currentScreen === "uno" ||
            currentScreen === "yahtzee") &&
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
  }, [player?.id]);

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

  const handleHostGameMultiplayer = async (gameType: "bingo" | "checkers" | "uno" | "yahtzee") => {
    if (!player) return;
    const res = await apiCall("/api/game/create", { playerId: player.id, gameType });
    if (res && res.success) {
      speak(`Creating a multiplayer ${gameType} lobby. Preparing game room!`);
      setActiveScreen(gameType as any);
    }
  };

  const handleJoinGameMultiplayer = async (gameId: string) => {
    if (!player) return;
    const res = await apiCall("/api/game/join", { gameId, playerId: player.id });
    if (res && res.success) {
      speak("Connected successfully! Joining the group match.");
    } else if (res && res.error) {
      speak(`Could not join: ${res.error}`);
    }
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
            <div className="flex items-center gap-2 flex-wrap">
              <h1 id="app-title-header" className={`${headerTitleScale} font-black uppercase tracking-tight`}>
                Room 2 Room Connect
              </h1>
              {player?.isStaff && (
                <div className="bg-teal-600 text-white font-black text-[10px] uppercase px-2.5 py-1 rounded-full border-2 border-slate-950 inline-flex items-center gap-1 shadow-sm leading-none">
                  <span className="w-1.5 h-1.5 bg-green-300 rounded-full animate-ping"></span>
                  Staff Mode
                </div>
              )}
            </div>
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

      {/* RECEIVED BROADCAST BANNER */}
      {activeAnnouncement && (
        <div 
          id={`announcement-banner-${activeAnnouncement.id}`}
          className="w-full max-w-6xl mx-auto mb-6 p-5 bg-blue-50 text-slate-900 border-4 border-blue-600 rounded-3xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-5 select-none"
        >
          <div className="flex items-center gap-4 flex-grow">
            <span className="text-5xl filter drop-shadow-md flex-shrink-0 animate-bounce">{activeAnnouncement.senderAvatar}</span>
            <div className="flex-grow">
              <span className="bg-blue-605 text-white font-black text-[10px] uppercase px-2 py-0.5 rounded border border-blue-800 tracking-wider inline-block mb-1">
                📢 FACILITY BROADCAST ANNOUNCEMENT
              </span>
              <h4 className="text-lg font-black text-slate-950 leading-tight">
                Message from {activeAnnouncement.senderLabel}:
              </h4>
              <p className="text-xl font-bold tracking-tight text-slate-900 mt-2 block bg-white/70 p-3 rounded-2xl border-2 border-slate-200">
                "{activeAnnouncement.text}"
              </p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-shrink-0">
            <button
              id="ann-got-it-btn"
              onClick={() => handleDismissAnnouncement(activeAnnouncement.id)}
              className="px-6 py-4 bg-emerald-500 hover:bg-emerald-600 border-3 border-slate-950 text-white text-xl font-black rounded-2xl flex items-center justify-center gap-2 shadow-md transition active:scale-95 cursor-pointer"
            >
              Got It! 👍
            </button>
            <button
              id="ann-report-btn"
              onClick={() => handleReportAnnouncement(activeAnnouncement.id)}
              className="px-4 py-3 bg-red-100 hover:bg-red-200 border-3 border-slate-950 text-red-950 text-xs font-black rounded-xl flex items-center justify-center gap-1 transition active:scale-95 cursor-pointer animate-pulse"
              title="Report appropriate notice"
            >
              Report ⚠️
            </button>
          </div>
        </div>
      )}

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
          <span>{errorMessage.includes("PIN") || errorMessage.includes("Facility") ? errorMessage : `Local Sync Error: ${errorMessage}`}</span>
          <button
            onClick={() => setErrorMessage("")}
            className="ml-auto bg-orange-800 text-white border-2 border-orange-950 font-bold px-3 py-1 rounded-lg text-xs hover:bg-orange-900 active:scale-95 transition cursor-pointer"
          >
            Dismiss ✕
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
                  joinableGames={joinableGames}
                  onSendMessage={handleSendMessage}
                  onSendInvite={handleSendInvite}
                  onRespondInvite={handleRespondInvite}
                  onSelectGameSolo={handleSelectGameSolo}
                  onHostGameMultiplayer={handleHostGameMultiplayer}
                  onJoinGameMultiplayer={handleJoinGameMultiplayer}
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

      {/* POPUP PROMPT FOR JOINING LOBBY GAME IN PROGRESS */}
      {invitedJoinProgressGame && (
        <div className="fixed inset-0 bg-slate-900/85 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border-8 border-slate-950 p-6 md:p-8 rounded-3xl max-w-lg w-full flex flex-col gap-6 shadow-2xl text-center">
            <span className="text-6xl animate-bounce">🍀</span>
            <h3 className="text-2xl md:text-3xl font-black uppercase text-slate-900 leading-tight">
              Join Game In-Progress?
            </h3>
            <p className="text-lg font-extrabold text-slate-700 leading-relaxed">
              There is a multiplayer <span className="uppercase text-indigo-750 font-black">{invitedJoinProgressGame.gameType}</span> match currently in progress hosted by <span className="text-slate-950 font-black">{invitedJoinProgressGame.hostName}</span>.
              <br /><br />
              Would you like to join their lobby and play along?
            </p>
            <div className="flex gap-4">
              <button
                id="join-progress-yes"
                onClick={async () => {
                  const gId = invitedJoinProgressGame.id;
                  setInvitedJoinProgressGame(null);
                  await handleJoinGameMultiplayer(gId);
                }}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 text-white border-4 border-slate-950 py-3.5 rounded-2xl text-xl font-black uppercase cursor-pointer active:scale-95 transition"
              >
                Yes, Join ➔
              </button>
              <button
                id="join-progress-no"
                onClick={() => {
                  setInvitedJoinProgressGame(null);
                  speak("No problem. You can always join later from the lobby menu!");
                }}
                className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-900 border-4 border-slate-950 py-3.5 rounded-2xl text-xl font-black uppercase cursor-pointer active:scale-95 transition"
              >
                No, thanks
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FLOATING ACTION TRIGGER */}
      {player && player.isStaff && (
        <button
          id="floating-make-announcement-btn"
          onClick={() => {
            setShowAnnouncementComposer(true);
            speak("Opening announcement composer.");
          }}
          className="fixed bottom-6 right-6 z-40 bg-blue-600 hover:bg-blue-700 text-white font-black border-4 border-slate-950 px-5 py-4 rounded-3xl shadow-2xl flex items-center justify-center gap-2 transform hover:scale-105 active:scale-95 transition-all cursor-pointer text-base uppercase"
          title="Compose and broadcast a facility announcement"
        >
          <Megaphone size={22} className="animate-pulse" />
          Make Announcement
        </button>
      )}

      {/* COMPOSER OVERLAY DIALOG */}
      {showAnnouncementComposer && player && (
        <AnnouncementComposer
          senderId={player.id}
          senderLabel={player.isStaff && player.staffName ? player.staffName : (player.isStaff ? `Staff ${player.avatar}` : `Room ${player.room} (Bed ${player.bed})`)}
          senderAvatar={player.avatar}
          staffLogs={staffLogs}
          apiCall={apiCall}
          onClose={() => setShowAnnouncementComposer(false)}
          speak={speak}
        />
      )}

      {/* 6. BOTTOM MARGINS BRUTALIST ATTRIBUTES (No telemetry, plain, humble footer) */}
      <footer className="mt-12 py-6 border-t-2 border-stone-200 text-center text-xs font-mono text-stone-500 max-w-6xl mx-auto uppercase">
        Room 2 Room Connect • Senior Care Facility Communication Hub • Offline Local Persistence
      </footer>
    </div>
  );
}
