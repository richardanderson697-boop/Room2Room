/**
 * Optimized speech synthesis utility for elder-friendly pacing
 * without device audio-resampling distortion.
 */

let activeUtterance: SpeechSynthesisUtterance | null = null;

export const speakPhrase = (phrase: string, forceVoiceEnabled: boolean = true) => {
  if (!("speechSynthesis" in window)) return;
  if (!forceVoiceEnabled) return;

  try {
    // 1. Cancel ongoing speech to clear the hardware channel
    window.speechSynthesis.cancel();

    // 2. Build new utterance
    const utterance = new SpeechSynthesisUtterance(phrase);

    // 3. Prevent garbage collection (famous Chrome/Android speech synthesis crash/distortion bug)
    activeUtterance = utterance;
    (window as any)._lastUtterance = utterance;

    // 4. Set access-friendly pacing. Rates below 0.9 trigger low-quality offline pitch-shifting
    // on certain tablets/operating systems, leading to a pixelated or scratchy distortion.
    // 0.92 offers a perfect balance of comfort, clarity, and hardware compatibility.
    utterance.rate = 0.92;
    utterance.pitch = 1.0;

    // 5. Select premium/natural voice if available
    const voices = window.speechSynthesis.getVoices();
    if (voices && voices.length > 0) {
      const englishVoices = voices.filter(
        (v) => v.lang.startsWith("en") || v.lang.includes("EN")
      );
      if (englishVoices.length > 0) {
        // Seek Google Natural, Samantha, Microsoft David, Hazel, etc.
        const bestVoice = englishVoices.find(
          (v) =>
            v.name.includes("Google") ||
            v.name.includes("Natural") ||
            v.name.includes("Samantha") ||
            v.name.includes("Premium") ||
            v.name.includes("David") ||
            v.name.includes("Zira") ||
            v.name.includes("Hazel") ||
            v.name.includes("Microsoft")
        );
        utterance.voice = bestVoice || englishVoices[0];
      }
    }

    utterance.onend = () => {
      activeUtterance = null;
    };

    utterance.onerror = () => {
      activeUtterance = null;
    };

    // 6. 50ms yield gap prevents sound hardware synchronization collisions on mobile browsers
    setTimeout(() => {
      try {
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn("Speech Synthesis runtime error:", e);
      }
    }, 50);

  } catch (err) {
    console.error("Speech Synthesis setup failed:", err);
  }
};
