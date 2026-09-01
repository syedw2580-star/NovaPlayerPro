import { useEffect, useRef } from 'react';

interface ShortcutHandlers {
  togglePlay: () => void;
  toggleFullscreen: () => void;
  toggleMute: () => void;
  toggleBooster300: () => void;
  seekDelta: (seconds: number) => void;
  setShowShortcutsModal: React.Dispatch<React.SetStateAction<boolean>>;
  setVolumeBoost: React.Dispatch<React.SetStateAction<number>>;
  setIsSmartBoostEnabled: React.Dispatch<React.SetStateAction<boolean>>;
  setAudioDelay: React.Dispatch<React.SetStateAction<number>>;
  setSubtitleDelay?: React.Dispatch<React.SetStateAction<number>>;
  setLoopA: React.Dispatch<React.SetStateAction<number | null>>;
  setLoopB: React.Dispatch<React.SetStateAction<number | null>>;
  cycleThreeDMode?: () => void;
  toggleDialogueBoost?: () => void;
  cycleSubtitleTrack?: () => void;
  cycleAudioTrack?: () => void;
}

interface StateValues {
  currentTime: number;
  loopA: number | null;
  loopB: number | null;
  volumeBoost: number;
  isSmartBoostEnabled: boolean;
}

export function useKeyboardShortcuts(handlers: ShortcutHandlers, stateValues: StateValues) {
  const latestStateRef = useRef(stateValues);
  const latestHandlersRef = useRef(handlers);

  useEffect(() => {
    latestStateRef.current = stateValues;
    latestHandlersRef.current = handlers;
  });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      const isTextInput =
        activeEl instanceof HTMLTextAreaElement ||
        (activeEl instanceof HTMLInputElement && activeEl.type !== 'range' && activeEl.type !== 'checkbox' && activeEl.type !== 'radio');
      if (isTextInput) return;

      const { currentTime: cTime, loopA: lA, volumeBoost: vBoost, isSmartBoostEnabled: sBoost } = latestStateRef.current;
      const currentHandlers = latestHandlersRef.current;

      switch (e.key.toLowerCase()) {
        case ' ':
        case 'k':
        case 'f6':
        case 'mediaplaypause':
        case 'mediaplay':
        case 'mediapause':
          e.preventDefault();
          currentHandlers.togglePlay();
          break;
        case 'f':
          e.preventDefault();
          currentHandlers.toggleFullscreen();
          break;
        case 'm':
          e.preventDefault();
          currentHandlers.toggleMute();
          break;
        case 'arrowright':
          e.preventDefault();
          currentHandlers.seekDelta(e.shiftKey ? 60 : 5);
          break;
        case 'arrowleft':
          e.preventDefault();
          currentHandlers.seekDelta(e.shiftKey ? -60 : -5);
          break;
        case '?':
        case '/':
          if (e.shiftKey) {
            e.preventDefault();
            currentHandlers.setShowShortcutsModal((prev) => !prev);
          }
          break;
        case 'arrowup':
          e.preventDefault();
          currentHandlers.setVolumeBoost(Math.min(vBoost + 10, sBoost ? 300 : 200));
          break;
        case 'arrowdown':
          e.preventDefault();
          currentHandlers.setVolumeBoost(Math.max(vBoost - 10, 0));
          break;
        case 'v':
          e.preventDefault();
          currentHandlers.toggleBooster300();
          break;
        case 'j':
          if (e.shiftKey) {
            e.preventDefault();
            const step = e.ctrlKey ? 1.0 : 0.1;
            currentHandlers.setAudioDelay((prev) => Math.max(-60.0, Math.round((prev - step) * 10) / 10));
          }
          break;
        case 'l':
          if (e.shiftKey) {
            e.preventDefault();
            const step = e.ctrlKey ? 1.0 : 0.1;
            currentHandlers.setAudioDelay((prev) => Math.min(60.0, Math.round((prev + step) * 10) / 10));
          }
          break;
        case '[':
        case 'g':
        case 'z':
          e.preventDefault();
          if (currentHandlers.setSubtitleDelay) {
            const step = e.shiftKey ? 0.1 : 1.0;
            currentHandlers.setSubtitleDelay((prev) => Math.max(-60.0, Math.round((prev - step) * 10) / 10));
          }
          break;
        case ']':
        case 'h':
        case 'x':
          e.preventDefault();
          if (currentHandlers.setSubtitleDelay) {
            const step = e.shiftKey ? 0.1 : 1.0;
            currentHandlers.setSubtitleDelay((prev) => Math.min(60.0, Math.round((prev + step) * 10) / 10));
          }
          break;
        case 'r':
        case 'u':
          e.preventDefault();
          currentHandlers.setAudioDelay(0);
          if (currentHandlers.setSubtitleDelay) {
            currentHandlers.setSubtitleDelay(0);
          }
          break;
        case '3':
          e.preventDefault();
          if (currentHandlers.cycleThreeDMode) {
            currentHandlers.cycleThreeDMode();
          }
          break;
        case 'd':
          e.preventDefault();
          if (currentHandlers.toggleDialogueBoost) {
            currentHandlers.toggleDialogueBoost();
          }
          break;
        case 's':
          e.preventDefault();
          if (currentHandlers.cycleSubtitleTrack) {
            currentHandlers.cycleSubtitleTrack();
          }
          break;
        case 'a':
          e.preventDefault();
          if (e.shiftKey && currentHandlers.cycleAudioTrack) {
            currentHandlers.cycleAudioTrack();
          } else {
            currentHandlers.setLoopA(cTime);
          }
          break;
        case 'b':
          e.preventDefault();
          if (lA !== null && cTime > lA) {
            currentHandlers.setLoopB(cTime);
          } else if (currentHandlers.cycleAudioTrack) {
            currentHandlers.cycleAudioTrack();
          }
          break;
        case 'c':
          e.preventDefault();
          currentHandlers.setLoopA(null);
          currentHandlers.setLoopB(null);
          break;
        default:
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, []);
}
