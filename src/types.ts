/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Player {
  id: string; // "room-bed"
  room: string;
  bed: string;
  avatar: string;
}

export interface OnlineUser {
  id: string;
  label: string;
  avatar: string;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderLabel: string;
  senderAvatar: string;
  receiverId: string;
  text: string;
  timestamp: number;
}

export interface GameInvite {
  id: string;
  senderId: string;
  senderLabel: string;
  senderAvatar: string;
  receiverId: string;
  gameType: "bingo" | "checkers" | "solitaire" | "uno" | "yahtzee";
  status: "pending" | "accepted" | "declined";
  gameId: string;
}

export interface GameSession {
  id: string;
  gameType: string;
  players: string[];
  playerDetails: { [id: string]: { label: string; avatar: string } };
  state: any;
  lastUpdate: number;
}

export interface AccessibilitySettings {
  textScale: "normal" | "large" | "extra-large"; // magnifying settings
  voiceActive: boolean; // Voice recognition toggled on
  speakMessages: boolean; // Voice synthesizer speak chat reads automatically
  colorTheme: "high-contrast-light" | "high-contrast-dark" | "soft-cream";
}

export const AVATAR_SPECS = [
  { char: "👴", name: "Grandpa Ken", color: "bg-blue-100 text-blue-800" },
  { char: "👵", name: "Grandma Rose", color: "bg-rose-100 text-rose-800" },
  { char: "🐱", name: "Friendly Cat", color: "bg-emerald-100 text-emerald-800" },
  { char: "🐶", name: "Happy Dog", color: "bg-yellow-100 text-yellow-800" },
  { char: "🐼", name: "Gentle Panda", color: "bg-slate-100 text-slate-800" },
  { char: "🦉", name: "Wise Owl", color: "bg-indigo-100 text-indigo-800" },
  { char: "🦊", name: "Clever Fox", color: "bg-amber-100 text-amber-800" },
  { char: "🐻", name: "Cuddly Bear", color: "bg-orange-100 text-orange-850" },
];

export const PRESET_MESSAGES = [
  "Hello! 😊",
  "How are you today?",
  "Would you like to play a game? 🎲",
  "I am having fun!",
  "Great game!",
  "Yes!",
  "No, thank you.",
  "Good morning! ☀️",
  "Good evening! 🌙",
  "Bingo! 🍀",
];
