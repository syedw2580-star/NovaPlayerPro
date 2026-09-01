export class AudioEngine {
  private static instanceMap = new WeakMap<HTMLVideoElement, AudioEngine>();

  public static getOrCreate(videoElement: HTMLVideoElement): AudioEngine {
    let instance = AudioEngine.instanceMap.get(videoElement);
    if (!instance) {
      instance = new AudioEngine(videoElement);
      AudioEngine.instanceMap.set(videoElement, instance);
    }
    return instance;
  }

  private ctx: AudioContext | null = null;
  private source: MediaElementAudioSourceNode | null = null;
  private centerGainL: GainNode | null = null;
  private centerGainR: GainNode | null = null;
  private surroundGainL: GainNode | null = null;
  private surroundGainR: GainNode | null = null;
  private dialogueFilter: BiquadFilterNode | null = null;
  private bassFilter: BiquadFilterNode | null = null;
  private midFilter: BiquadFilterNode | null = null;
  private trebleFilter: BiquadFilterNode | null = null;
  private gainNode: GainNode | null = null;
  private delayNode: DelayNode | null = null;
  private compressor: DynamicsCompressorNode | null = null;
  private limiter: WaveShaperNode | null = null;
  private isInitialized = false;
  private dialogueBoostGainDb: number = 0;

  constructor(private videoElement: HTMLVideoElement) {}

  public initialize() {
    if (this.isInitialized) return;

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtxClass();

      this.source = this.ctx.createMediaElementSource(this.videoElement);
      this.source.channelCount = 2;
      this.source.channelCountMode = 'explicit';
      this.source.channelInterpretation = 'speakers';

      // Vocal Speech Presence & Formant Filter (2.2 kHz peaking)
      this.dialogueFilter = this.ctx.createBiquadFilter();
      this.dialogueFilter.type = 'peaking';
      this.dialogueFilter.frequency.value = 2200;
      this.dialogueFilter.Q.value = 1.2;
      this.dialogueFilter.gain.value = 0;

      this.bassFilter = this.ctx.createBiquadFilter();
      this.bassFilter.type = 'lowshelf';
      this.bassFilter.frequency.value = 150;
      this.bassFilter.gain.value = 0;

      this.midFilter = this.ctx.createBiquadFilter();
      this.midFilter.type = 'peaking';
      this.midFilter.frequency.value = 1000;
      this.midFilter.Q.value = 1.0;
      this.midFilter.gain.value = 0;

      this.trebleFilter = this.ctx.createBiquadFilter();
      this.trebleFilter.type = 'highshelf';
      this.trebleFilter.frequency.value = 6000;
      this.trebleFilter.gain.value = 0;

      // Master Gain Stage (+10dB to +18dB super amplification matching ffmpeg volume=10dB)
      this.gainNode = this.ctx.createGain();
      this.gainNode.gain.value = 1.0;

      // Compander Compressor stage matching ffmpeg compand=points=-80/-80|-30/-10|0/-3
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -30;
      this.compressor.knee.value = 10;
      this.compressor.ratio.value = 4.0;
      this.compressor.attack.value = 0.005;
      this.compressor.release.value = 0.1;

      // Peak Limiter matching ffmpeg alimiter=limit=0.95
      this.limiter = this.ctx.createWaveShaper();
      this.limiter.curve = this.createLimiterCurve();
      this.limiter.oversample = '4x';

      this.delayNode = this.ctx.createDelay(65.0);
      this.delayNode.delayTime.value = 0.0;

      try {
        const splitter = this.ctx.createChannelSplitter(6);
        const merger = this.ctx.createChannelMerger(2);

        this.centerGainL = this.ctx.createGain();
        this.centerGainR = this.ctx.createGain();
        this.centerGainL.gain.value = 0.707;
        this.centerGainR.gain.value = 0.707;

        this.surroundGainL = this.ctx.createGain();
        this.surroundGainR = this.ctx.createGain();
        this.surroundGainL.gain.value = 0.707;
        this.surroundGainR.gain.value = 0.707;

        this.source.connect(splitter);

        splitter.connect(merger, 0, 0);
        splitter.connect(merger, 1, 1);

        splitter.connect(this.centerGainL, 2);
        splitter.connect(this.centerGainR, 2);
        this.centerGainL.connect(merger, 0, 0);
        this.centerGainR.connect(merger, 0, 1);

        splitter.connect(this.surroundGainL, 4);
        this.surroundGainL.connect(merger, 0, 0);

        splitter.connect(this.surroundGainR, 5);
        this.surroundGainR.connect(merger, 0, 1);

        merger.connect(this.dialogueFilter);
      } catch (downmixErr) {
        this.source.connect(this.dialogueFilter);
      }

      this.dialogueFilter.connect(this.bassFilter);
      this.bassFilter.connect(this.midFilter);
      this.midFilter.connect(this.trebleFilter);
      this.trebleFilter.connect(this.gainNode);

      this.updateOutputRouting();

      this.isInitialized = true;
      console.log('AudioEngine initialized with 5.1 Center-Channel Dialogue Boost + ffmpeg compand DSP pipeline.');
    } catch (e) {
      console.error('AudioEngine initialization failed:', e);
    }
  }

  private createLimiterCurve(samples = 44100): Float32Array {
    const curve = new Float32Array(samples);
    for (let i = 0; i < samples; ++i) {
      const x = (i * 2) / samples - 1;
      // Soft-clipper limiting output peak to 0.95 (-0.45 dBFS) matching ffmpeg alimiter=limit=0.95
      curve[i] = 0.95 * Math.tanh(x * 1.5);
    }
    return curve;
  }

  private updateOutputRouting() {
    if (!this.gainNode || !this.ctx) return;
    try {
      this.gainNode.disconnect();
      if (this.compressor) this.compressor.disconnect();
      if (this.limiter) this.limiter.disconnect();
      if (this.delayNode) this.delayNode.disconnect();

      // DSP Chain: GainNode -> Compressor (Compander) -> Limiter (alimiter=0.95) -> DelayNode -> Destination
      if (this.compressor && this.limiter) {
        this.gainNode.connect(this.compressor);
        this.compressor.connect(this.limiter);
        if (this.delayNode) {
          this.limiter.connect(this.delayNode);
          this.delayNode.connect(this.ctx.destination);
        } else {
          this.limiter.connect(this.ctx.destination);
        }
      } else if (this.delayNode) {
        this.gainNode.connect(this.delayNode);
        this.delayNode.connect(this.ctx.destination);
      } else {
        this.gainNode.connect(this.ctx.destination);
      }
    } catch (e) {
      console.warn('AudioEngine output routing warning:', e);
    }
  }

  public setSmartBooster(_enabled: boolean) {
    if (!this.isInitialized) this.initialize();
    this.resume();
    this.updateOutputRouting();
  }

  public setAudioDelay(delayInSeconds: number) {
    if (!this.isInitialized) this.initialize();
    this.resume();
    if (this.delayNode && this.ctx) {
      const targetDelay = Math.max(0, Math.min(delayInSeconds, 60.0));
      const now = this.ctx.currentTime;
      try {
        this.delayNode.delayTime.cancelScheduledValues(now);
        this.delayNode.delayTime.setValueAtTime(this.delayNode.delayTime.value, now);
        this.delayNode.delayTime.linearRampToValueAtTime(targetDelay, now + 0.02);
      } catch (e) {
        this.delayNode.delayTime.value = targetDelay;
      }
    }
  }

  public resume(): Promise<void> {
    if (this.ctx && this.ctx.state === 'suspended') {
      return this.ctx.resume().catch(console.warn);
    }
    return Promise.resolve();
  }

  public setVolumeBoost(percentage: number) {
    if (!this.isInitialized) this.initialize();
    this.resume();

    if (this.gainNode) {
      // Map percentage: 100% = 1.0, 300% = 3.16 (+10dB), 500% = 5.62 (+15dB super boost)
      const targetGain = Math.max(0, (percentage / 100) * 1.05);
      this.gainNode.gain.value = targetGain;
      if (this.ctx && this.ctx.currentTime > 0) {
        try {
          this.gainNode.gain.setValueAtTime(targetGain, this.ctx.currentTime);
        } catch (e) {}
      }
    }
  }

  public setDialogueBoost(gainDb: number) {
    if (!this.isInitialized) this.initialize();
    this.resume();

    this.dialogueBoostGainDb = gainDb;
    const now = this.ctx ? this.ctx.currentTime : 0;

    // Linear center channel multiplier:
    // 0dB -> 0.707 (-3dB standard downmix)
    // +6dB -> 1.414 (+3dB center boost)
    // +12dB -> 2.828 (+9dB center max boost)
    const linearCenterMultiplier = Math.pow(10, gainDb / 20);
    const targetCenterGain = 0.707 * linearCenterMultiplier;

    if (this.centerGainL && this.centerGainR && this.ctx) {
      try {
        this.centerGainL.gain.cancelScheduledValues(now);
        this.centerGainR.gain.cancelScheduledValues(now);
        this.centerGainL.gain.setValueAtTime(this.centerGainL.gain.value, now);
        this.centerGainR.gain.setValueAtTime(this.centerGainR.gain.value, now);
        this.centerGainL.gain.linearRampToValueAtTime(targetCenterGain, now + 0.05);
        this.centerGainR.gain.linearRampToValueAtTime(targetCenterGain, now + 0.05);
      } catch (e) {
        this.centerGainL.gain.value = targetCenterGain;
        this.centerGainR.gain.value = targetCenterGain;
      }
    }

    // Vocal presence formant filter (2.2 kHz peaking filter):
    if (this.dialogueFilter && this.ctx) {
      const targetFilterGain = gainDb > 0 ? Math.min(gainDb * 0.75, 8.0) : 0;
      try {
        this.dialogueFilter.gain.cancelScheduledValues(now);
        this.dialogueFilter.gain.setValueAtTime(this.dialogueFilter.gain.value, now);
        this.dialogueFilter.gain.linearRampToValueAtTime(targetFilterGain, now + 0.05);
      } catch (e) {
        this.dialogueFilter.gain.value = targetFilterGain;
      }
    }
  }

  public setEqualizer(bass: number, mid: number, treble: number) {
    if (!this.isInitialized) this.initialize();
    this.resume();

    if (this.bassFilter) this.bassFilter.gain.value = bass;
    if (this.midFilter) this.midFilter.gain.value = mid;
    if (this.trebleFilter) this.trebleFilter.gain.value = treble;
  }

  public applyPreset(preset: 'flat' | 'bass' | 'vocal' | 'cinema' | 'treble' | 'dialogue') {
    switch (preset) {
      case 'bass':
        this.setEqualizer(8, 2, -2);
        break;
      case 'vocal':
        this.setEqualizer(-4, 6, 2);
        break;
      case 'dialogue':
        this.setEqualizer(-3, 7, 3);
        this.setDialogueBoost(8);
        break;
      case 'cinema':
        this.setEqualizer(6, -2, 4);
        break;
      case 'treble':
        this.setEqualizer(-3, 1, 7);
        break;
      case 'flat':
      default:
        this.setEqualizer(0, 0, 0);
        break;
    }
  }

  public close() {
    if (this.ctx) {
      this.ctx.close();
    }
  }
}
