/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from "react";
import { Announcement } from "../types";
import { Megaphone, X, Volume2, ShieldAlert, Clock, CheckCircle } from "lucide-react";

interface AnnouncementComposerProps {
  senderId: string;
  senderLabel: string;
  senderAvatar: string;
  staffLogs: Announcement[];
  apiCall: (endpoint: string, bodyJson: any) => Promise<any>;
  onClose: () => void;
  speak: (phrase: string) => void;
}

const PRESET_ANNOUNCEMENTS = [
  { label: "🍲 Lunch in 20 min", text: "Attention everyone: Delicious lunch will be served in the main dining hall in 20 minutes! We look forward to seeing you there." },
  { label: "🏋️ PT in 1 hour", text: "Physical Therapy sessions will begin in the wellness wing in 1 hour. Please prepare with comfortable footwear." },
  { label: "🎨 Activity Change", text: "Notice: The afternoon bingo session has been moved to the Solarium room due to a schedule change. Starts in 15 minutes!" },
  { label: "💊 Medication Reminder", text: "Friendly reminder: Afternoon medication dispersal scheduled is currently active. Please stay near your bed or lounge area." },
  { label: "🚨 Emergency", text: "ALERT: This is a test of the facility priority announcement system. Please remain calm, no emergency exists." },
  { label: "📋 General Other", text: "Attention residents: Please note that mail delivery is delayed today. We will notify you once it arrives." },
];

export default function AnnouncementComposer({
  senderId,
  senderLabel,
  senderAvatar,
  staffLogs,
  apiCall,
  onClose,
  speak,
}: AnnouncementComposerProps) {
  const [text, setText] = useState("");
  const [target, setTarget] = useState("all");
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const handleSend = async () => {
    if (!text.trim()) {
      setErrorMessage("Please enter an announcement phrase or select a preset!");
      speak("Please enter an announcement phrase first.");
      return;
    }

    setIsBroadcasting(true);
    setErrorMessage("");
    setSuccessMessage("");

    const res = await apiCall("/api/announcement/send", {
      senderId,
      text: text.trim(),
      target,
    });

    setIsBroadcasting(false);

    if (res.error) {
      setErrorMessage(res.error);
      speak(res.error);
    } else {
      setSuccessMessage("Announcement Broadcasted Successfully!");
      speak("Attention. Announcement broadcast successfully delivered.");
      setText("");
      // Automatically close or show success briefly
      setTimeout(() => {
        onClose();
      }, 1500);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div 
        id="announcement-composer-container"
        className="bg-stone-50 text-slate-900 border-4 border-slate-950 max-w-2xl w-full rounded-3xl shadow-2xl p-6 flex flex-col max-h-[90vh] overflow-hidden"
      >
        {/* HEADER */}
        <div className="flex items-center justify-between border-b-4 border-slate-950 pb-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 text-white p-3 rounded-2xl border-2 border-slate-950">
              <Megaphone size={28} className="animate-bounce" />
            </div>
            <div>
              <h2 className="text-2xl font-black uppercase tracking-tight">Staff Announcement Broadcast</h2>
              <span className="text-xs font-bold text-slate-500 uppercase">
                Sending as: {senderLabel} {senderAvatar}
              </span>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 bg-stone-200 hover:bg-stone-300 rounded-xl border-2 border-slate-900 transition active:scale-95 cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* SCROLLABLE INNER */}
        <div className="flex-grow overflow-y-auto py-4 flex flex-col gap-5 pr-2">
          
          {/* SUCCESS / ERROR */}
          {errorMessage && (
            <div className="p-4 bg-red-100 border-3 border-red-800 text-red-950 font-black rounded-xl text-center">
              ⚠️ {errorMessage}
            </div>
          )}
          {successMessage && (
            <div className="p-4 bg-emerald-100 border-3 border-emerald-800 text-emerald-950 font-black rounded-xl text-center flex items-center justify-center gap-2">
              <CheckCircle size={20} className="text-emerald-700 animate-pulse" /> {successMessage}
            </div>
          )}

          {/* SCRIPT AREA */}
          <div>
            <label className="block text-sm font-black uppercase tracking-wide text-slate-700 mb-1.5">
              Step 1: Compose Announcement Text
            </label>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type your message to the residents..."
              maxLength={1000}
              rows={4}
              className="w-full text-lg border-3 border-slate-900 rounded-2xl p-3 bg-white text-slate-900 font-bold focus:outline-none placeholder-slate-400"
            />
          </div>

          {/* PRESETS */}
          <div>
            <label className="block text-xs font-black uppercase tracking-wide text-slate-500 mb-2">
              📋 Tap a quick preset to autopopulate:
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {PRESET_ANNOUNCEMENTS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => {
                    setText(preset.text);
                    speak(preset.label);
                  }}
                  className="p-2 bg-white hover:bg-zinc-100 border-2 border-slate-950 rounded-xl text-xs font-black text-left shadow-sm transition active:scale-95"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          {/* TARGET */}
          <div>
            <label className="block text-sm font-black uppercase tracking-wide text-slate-700 mb-1.5">
              Step 2: Select Recipient Target
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {[
                { id: "all", label: "👥 Everyone" },
                { id: "wing-1", label: "🚪 Wing 1 (1xx)" },
                { id: "wing-2", label: "🚪 Wing 2 (2xx)" },
                { id: "wing-3", label: "🚪 Wing 3 (3xx)" },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTarget(t.id)}
                  className={`p-3 border-3 rounded-xl font-black text-xs uppercase text-center cursor-pointer transition ${
                    target === t.id
                      ? "bg-blue-600 border-slate-950 text-white"
                      : "bg-white border-slate-950 text-slate-950 hover:bg-slate-100"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* AUDIT LOG IN STAFF MODE ONLY */}
          <div className="border-t-3 border-slate-900 pt-4 mt-2">
            <h3 className="text-sm font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
              <ShieldAlert size={16} /> Historic Announcements & Reports Log
            </h3>
            <span className="text-[10px] font-bold text-slate-500 block mb-3 uppercase">
              Visible exclusively to registered facility staff
            </span>

            <div className="flex flex-col gap-2 max-h-48 overflow-y-auto bg-stone-200 border-3 border-slate-900 p-2.5 rounded-xl">
              {staffLogs.length === 0 ? (
                <div className="text-center py-4 text-xs font-mono text-stone-500 uppercase">
                  No announcements broadcasted yet in this session.
                </div>
              ) : (
                staffLogs.slice().reverse().map((log) => (
                  <div key={log.id} className="bg-white p-2.5 rounded-lg border-2 border-slate-950 flex flex-col gap-1.5 text-xs">
                    <div className="flex items-center justify-between font-mono text-[10px] text-zinc-500">
                      <span className="font-bold flex items-center gap-1 text-slate-800">
                        {log.senderAvatar} {log.senderLabel}
                      </span>
                      <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                    </div>
                    <p className="font-semibold text-slate-900 block">{log.text}</p>
                    <div className="flex items-center justify-between mt-1 text-[10px] font-mono border-t border-slate-100 pt-1.5">
                      <span className="bg-slate-100 px-1.5 py-0.5 rounded uppercase font-black text-slate-650">
                        Target: {log.target}
                      </span>
                      {log.reportsCount && log.reportsCount > 0 ? (
                        <span className="bg-red-100 text-red-950 border border-red-300 font-bold px-1.5 py-0.5 rounded animate-pulse">
                          ⚠️ FLAG REPORTS: {log.reportsCount}
                        </span>
                      ) : (
                        <span className="text-emerald-700 font-bold">
                          ✓ No Reports
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* BOTTOM ACTION */}
        <button
          onClick={handleSend}
          disabled={isBroadcasting}
          className="w-full mt-2 py-4 bg-blue-600 hover:bg-blue-700 border-4 border-slate-950 text-white font-black text-lg uppercase rounded-2xl flex items-center justify-center gap-2 shadow-md transition active:scale-98 disabled:opacity-50 cursor-pointer text-center"
        >
          <Megaphone size={22} />
          {isBroadcasting ? "Broadcasting..." : "BROADCAST TO SYSTEM"}
        </button>
      </div>
    </div>
  );
}
