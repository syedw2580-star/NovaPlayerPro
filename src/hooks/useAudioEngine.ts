import { useState, useEffect } from 'react';
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

  // Initialize AudioEngine whenever activeVideo or videoRef.current is ready
  useEffect(() => {
    if (videoRef.current) {
      const engine = AudioEngine.getOrCreate(videoRef.current);
      setAudioEngine(engine);
      engine.initialize();

      const handleUserGesture = () => {
        engine.initialize();
        engine.resume();
      };

      window.addEventListener('click', handleUserGesture);
      window.addEventListener('keydown', handleUserGesture);

      return () => {
        window.removeEventListener('click', handleUserGesture);
        window.removeEventListener('keydown', handleUserGesture);
      };
    }
  }, [videoRef.current, activeVideo]);

  // Sync volume boost, HTML5 video element volume, and smart booster state
  useEffect(() => {
    const engine = audioEngine || (videoRef.current ? AudioEngine.getOrCreate(videoRef.current) : null);
    if (engine && videoRef.current) {
      engine.initialize();
      engine.resume();

      if (isAudioEngineEnabled) {
        if (volumeBoost <= 100) {
          videoRef.current.volume = Math.max(0, volumeBoost / 100);
          engine.setVolumeBoost(100);
        } else {
          videoRef.current.volume = 1.0;
          engine.setVolumeBoost(volumeBoost); // 150%, 200%, 300% loudness boost!
        }
        engine.setSmartBooster(isSmartBoostEnabled);
      } else {
        videoRef.current.volume = Math.min(Math.max(0, volumeBoost), 100) / 100;
        engine.setVolumeBoost(100);
      }
    }
  }, [audioEngine, isAudioEngineEnabled, volumeBoost, isSmartBoostEnabled, activeVideo, videoRef.current]);

  // Sync Dialogue Boost (Center Channel Gain & Speech Clarity Formant Filter)
  useEffect(() => {
    const engine = audioEngine || (videoRef.current ? AudioEngine.getOrCreate(videoRef.current) : null);
    if (engine && isAudioEngineEnabled) {
      engine.setDialogueBoost(dialogueBoost);
    }
  }, [audioEngine, dialogueBoost, isAudioEngineEnabled, videoRef.current]);

  // Sync equalizer presets
  useEffect(() => {
    const engine = audioEngine || (videoRef.current ? AudioEngine.getOrCreate(videoRef.current) : null);
    if (engine && isAudioEngineEnabled) {
      engine.applyPreset(activePreset);
    }
  }, [audioEngine, activePreset, isAudioEngineEnabled, videoRef.current]);

  // Sync audio stream delay offset
  useEffect(() => {
    const engine = audioEngine || (videoRef.current ? AudioEngine.getOrCreate(videoRef.current) : null);
    if (engine) {
      engine.setAudioDelay(audioDelay > 0 ? audioDelay : 0);
    }
  }, [audioEngine, audioDelay, videoRef.current]);

  return { audioEngine };
}
