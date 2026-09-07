import React, { useState, useEffect, useRef } from 'react';
import { AudioEngine } from '../utils/audioEngine';
import { VideoItem } from '../types';

interface UseAudioEngineProps {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  activeVideo: VideoItem | null;
  isAudioEngineEnabled: boolean;
  volumeBoost: number;
  isSmartBoostEnabled: boolean;
  activePreset: 'flat' | 'bass' | 'vocal' | 'cinema' | 'treble' | 'dialogue';
  dialogueBoost: number; // in dB (0, 6, 12)
  audioDelay: number;
}

export function useAudioEngine({
  videoRef,
  activeVideo,
  isAudioEngineEnabled,
  volumeBoost,
  isSmartBoostEnabled,
  activePreset,
  dialogueBoost,
  audioDelay,
}: UseAudioEngineProps) {
  const [audioEngine, setAudioEngine] = useState<AudioEngine | null>(null);
  const currentEngineRef = useRef<AudioEngine | null>(null);

  // Initialize or attach AudioEngine whenever activeVideo changes
  useEffect(() => {
    const videoEl = videoRef.current;
    if (!videoEl) return;

    const engine = AudioEngine.getOrCreate(videoEl);
    setAudioEngine(engine);
    currentEngineRef.current = engine;
    engine.initialize();

    const handleUserGesture = () => {
      engine.initialize();
      engine.resume();
    };

    window.addEventListener('click', handleUserGesture, { passive: true });
    window.addEventListener('keydown', handleUserGesture, { passive: true });

    return () => {
      window.removeEventListener('click', handleUserGesture);
      window.removeEventListener('keydown', handleUserGesture);
    };
  }, [activeVideo?.id, videoRef]);

  // Sync volume boost, HTML5 video element volume, and smart booster state
  useEffect(() => {
    const engine = audioEngine;
    const videoEl = videoRef.current;
    if (!engine || !videoEl) return;

    engine.initialize();
    engine.resume();

    if (isAudioEngineEnabled) {
      if (volumeBoost <= 100) {
        videoEl.volume = Math.max(0, volumeBoost / 100);
        engine.setVolumeBoost(100);
      } else {
        videoEl.volume = 1.0;
        engine.setVolumeBoost(volumeBoost); // 150%, 200%, 300% loudness boost!
      }
      engine.setSmartBooster(isSmartBoostEnabled);
    } else {
      videoEl.volume = Math.min(Math.max(0, volumeBoost), 100) / 100;
      engine.setVolumeBoost(100);
      engine.setSmartBooster(false);
    }
  }, [audioEngine, isAudioEngineEnabled, volumeBoost, isSmartBoostEnabled, videoRef]);

  // Sync Dialogue Boost (Center Channel Gain & Speech Clarity Formant Filter)
  useEffect(() => {
    if (audioEngine && isAudioEngineEnabled) {
      audioEngine.setDialogueBoost(dialogueBoost);
    }
  }, [audioEngine, dialogueBoost, isAudioEngineEnabled]);

  // Sync equalizer presets
  useEffect(() => {
    if (audioEngine && isAudioEngineEnabled) {
      audioEngine.applyPreset(activePreset);
    }
  }, [audioEngine, activePreset, isAudioEngineEnabled]);

  // Sync audio stream delay offset
  useEffect(() => {
    if (audioEngine) {
      audioEngine.setAudioDelay(audioDelay > 0 ? audioDelay : 0);
    }
  }, [audioEngine, audioDelay]);

  // Clean up AudioContext when component permanently unmounts
  useEffect(() => {
    return () => {
      if (currentEngineRef.current) {
        currentEngineRef.current.close();
      }
    };
  }, []);

  return { audioEngine };
}
