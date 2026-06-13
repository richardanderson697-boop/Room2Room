import React, { useState, useEffect, useRef } from "react";
import { Mic, MicOff, Volume2, VolumeX, HelpCircle, Activity } from "lucide-react";

interface VoiceAssistantProps {
  onNavTrigger: (activity: "lobby" | "bingo" | "checkers" | "solitaire" | "uno" | "yahtzee") => void;
  onReadLastMessage: () => void;
  voiceActive: boolean;
  onToggleVoice: (active: boolean) => void;
  speakMessages: boolean;
  onToggleSpeakMessages: (active: boolean) => void;
  textScale: "normal" | "large" | "extra-large";
}

export default function VoiceAssistant({
  onNavTrigger,
  onReadLastMessage,
  voiceActive,
  onToggleVoice,
  speakMessages,
  onToggleSpeakMessages,
  textScale,
}: VoiceAssistantProps) {
  const [isListening, setIsListening] = useState<boolean>(false);
  const [transcript, setTranscript] = useState<string>("");
  const [voiceCaps, setVoiceCaps] = useState<string>("Ready for your verbal controls!");
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    // Setup Speech Recognition
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setVoiceCaps("Browser Speech Recognition not supported on this device. Tap buttons directly!");
      return;
    }

    const rec = new SpeechRecognition();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";

    rec.onstart = () => {
      setIsListening(true);
      setVoiceCaps("Listening... speak a command!");
    };

    rec.onresult = (event: any) => {
      const last = event.results.length - 1;
      const resultText = event.results[last][0].transcript.trim().toLowerCase();
      setTranscript(resultText);
      parseSpeechCommand(resultText);
    };

    rec.onerror = (event: any) => {
      console.warn("Speech recognition error", event.error);
      setIsListening(false);
      if (event.error === "not-allowed") {
        setVoiceCaps("Microphone access is blocked! Check browser settings.");
      } else {
        setVoiceCaps("Please try speaking closer to your device.");
      }
    };

    rec.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = rec;

    // Auto-start if toggled active
    if (voiceActive) {
      try {
        rec.start();
      } catch (err) {
        // already started
      }
    }

    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {}
      }
    };
  }, [voiceActive]);

  const toggleListen = () => {
    if (!recognitionRef.current) {
      speak("Speech recognition is unavailable on this browser.");
      return;
    }

    if (isListening) {
      try {
        recognitionRef.current.stop();
      } catch {}
      setIsListening(false);
      onToggleVoice(false);
      speak("Voice service paused.");
    } else {
      onToggleVoice(true);
      try {
        recognitionRef.current.start();
      } catch {}
      speak("Voice service running! Tell me what you want to play.");
    }
  };

  const speak = (phrase: string) => {
    if (!("speechSynthesis" in window)) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(phrase);
      utterance.rate = 0.8; // Senior-friendly pacing
      window.speechSynthesis.speak(utterance);
    } catch {}
  };

  const parseSpeechCommand = (text: string) => {
    setVoiceCaps(`Heard: "${text}"`);
    console.log("Analyzing Senior voice:", text);

    if (text.includes("bingo") || text.includes("play bingo")) {
      speak("Loading Bingo.");
      onNavTrigger("bingo");
    } else if (text.includes("checker") || text.includes("play checkers")) {
      speak("Loading Checkers board.");
      onNavTrigger("checkers");
    } else if (text.includes("solitaire") || text.includes("play solitaire")) {
      speak("Opening Solitaire deck.");
      onNavTrigger("solitaire");
    } else if (text.includes("uno") || text.includes("play uno")) {
      speak("Loading Uno cards.");
      onNavTrigger("uno");
    } else if (text.includes("yahtzee") || text.includes("play yahtzee")) {
      speak("Rolling out Yahtzee dice grid.");
      onNavTrigger("yahtzee");
    } else if (text.includes("menu") || text.includes("home") || text.includes("lobby") || text.includes("go back")) {
      speak("Returning to Room Lobby.");
      onNavTrigger("lobby");
    } else if (text.includes("read message") || text.includes("say message") || text.includes("speak message")) {
      onReadLastMessage();
    } else if (text.includes("sound on") || text.includes("unmute")) {
      onToggleSpeakMessages(true);
      speak("Text reading enabled.");
    } else if (text.includes("sound off") || text.includes("mute")) {
      onToggleSpeakMessages(false);
      speak("Voice muted.");
    } else {
      setVoiceCaps(`Command "${text}" not recognized. Try saying Play Bingo or Home!`);
    }
  };

  const textClass =
    textScale === "extra-large"
      ? "text-2xl"
      : textScale === "large"
      ? "text-xl"
      : "text-base";

  return (
    <div className="bg-slate-900 text-white rounded-2xl border-4 border-slate-950 p-4 shadow-xl flex flex-col md:flex-row items-center justify-between gap-4">
      {/* LEFT ASPECT: VOICE STATUS */}
      <div className="flex items-center gap-3 w-full md:w-auto">
        <button
          id="assistant-voice-toggle"
          onClick={toggleListen}
          className={`flex-shrink-0 w-16 h-16 rounded-full border-4 flex items-center justify-center cursor-pointer transition shadow-md ${
            isListening
              ? "bg-emerald-500 border-white hover:bg-emerald-600 animate-pulse text-white"
              : "bg-red-500 border-slate-950 hover:bg-red-600 text-white"
          }`}
          title={isListening ? "Voice Active: Tap to Mute" : "Voice Offline: Tap to listen"}
        >
          {isListening ? <Mic size={28} /> : <MicOff size={28} />}
        </button>

        <div>
          <div className="flex items-center gap-1.5 font-black uppercase text-xs tracking-wider text-emerald-400">
            <span className={`w-2 h-2 rounded-full ${isListening ? "bg-emerald-400 animate-ping" : "bg-red-500"}`} />
            Voice Assistant Sammy
          </div>
          <p className={`${textClass} font-extrabold max-w-md tracking-tight leading-tight mt-0.5`}>
            {voiceCaps}
          </p>
        </div>
      </div>

      {/* MID PANEL: POPULAR COMMAND CHEATS & STATUSES */}
      <div className="hidden lg:flex flex-col border-l-2 border-slate-800 pl-4">
        <span className="text-[10px] font-black uppercase text-slate-400 mb-1">🎤 Voice Commands:</span>
        <div className="flex flex-wrap gap-1.5 max-w-sm">
          {["Play Bingo", "Play Checkers", "Play Solitaire", "Play Uno", "Play Yahtzee", "Read Message", "Home"].map((cmd) => (
            <span key={cmd} className="bg-slate-800 border border-slate-700 text-[11px] font-bold rounded-lg px-2 py-0.5 text-zinc-300">
              "{cmd}"
            </span>
          ))}
        </div>
      </div>

      {/* RIGHT SIDE: AUDIO PREF STATUSES */}
      <div className="flex gap-2">
        <button
          id="assistant-tts-toggle"
          onClick={() => {
            onToggleSpeakMessages(!speakMessages);
            speak(speakMessages ? "" : "Text to Speech is active.");
          }}
          className={`flex items-center gap-2 border-4 px-4 py-2.5 rounded-xl font-bold hover:opacity-90 transition-colors cursor-pointer ${
            speakMessages ? "bg-zinc-100 border-zinc-950 text-slate-950" : "bg-slate-850 border-slate-750 text-slate-400"
          }`}
        >
          {speakMessages ? <Volume2 size={20} /> : <VolumeX size={20} />}
          <span className="font-extrabold text-sm">
            {speakMessages ? "Speech: ON" : "Speech: MUTED"}
          </span>
        </button>
      </div>
    </div>
  );
}
