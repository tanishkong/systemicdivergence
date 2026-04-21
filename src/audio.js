let ctx = null;
let humOsc = null;
let humFilter = null;
let staticNode = null;
let staticFilter = null;
let staticGainNode = null;
let bcNode = null;
let pulseOsc = null;

export async function initAudio() {
  if (!ctx) {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    ctx = new AudioContext();
  }
  if (ctx.state === 'suspended') {
    await ctx.resume();
  }
}

export function startBackgroundAmbience() {
  if (!ctx || humOsc) return;
  
  // 1. Deep Mechanical Hum (45Hz Sine)
  humOsc = ctx.createOscillator();
  humOsc.type = 'sine';
  humOsc.frequency.setValueAtTime(45, ctx.currentTime);
  
  humFilter = ctx.createBiquadFilter();
  humFilter.type = 'lowpass';
  humFilter.frequency.value = 150;
  
  const humGain = ctx.createGain();
  humGain.gain.value = 0.6;
  
  humOsc.connect(humFilter);
  humFilter.connect(humGain);
  humGain.connect(ctx.destination);
  humOsc.start();

  // 2. 1950s Radio Static (White Noise through bandpass)
  const bufferSize = ctx.sampleRate * 2;
  const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const output = noiseBuffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) {
    output[i] = Math.random() * 2 - 1;
  }
  
  staticNode = ctx.createBufferSource();
  staticNode.buffer = noiseBuffer;
  staticNode.loop = true;
  
  staticFilter = ctx.createBiquadFilter();
  staticFilter.type = 'bandpass';
  staticFilter.frequency.value = 800; // mid-range static
  staticFilter.Q.value = 0.5;
  
  staticGainNode = ctx.createGain();
  staticGainNode.gain.value = 0.04; // Very subtle
  
  // Real bitcrusher via sample-and-hold logic
  bcNode = ctx.createScriptProcessor(4096, 1, 1);
  let phaser = 0;
  let last = 0;
  bcNode.normFreq = 1.0;
  bcNode.onaudioprocess = function(e) {
    const input = e.inputBuffer.getChannelData(0);
    const output = e.outputBuffer.getChannelData(0);
    for (let i = 0; i < input.length; i++) {
      phaser += bcNode.normFreq;
      if (phaser >= 1.0) {
        phaser -= 1.0;
        last = input[i];
      }
      output[i] = last;
    }
  };
  
  staticNode.connect(staticFilter);
  staticFilter.connect(bcNode);
  bcNode.connect(staticGainNode);
  staticGainNode.connect(ctx.destination);
  staticNode.start();
}

export function startTelemetryBeacon() {
  if (!ctx || pulseOsc) return;
  
  // 0.5 Hz LFO modulating a low Square Wave volume
  pulseOsc = ctx.createOscillator();
  pulseOsc.type = 'square';
  pulseOsc.frequency.value = 800; // beacon tone
  
  const pulseFilter = ctx.createBiquadFilter();
  pulseFilter.type = 'bandpass';
  pulseFilter.frequency.value = 1200;
  
  const lfo = ctx.createOscillator();
  lfo.type = 'sine';
  lfo.frequency.value = 0.3; // 0.3 times a second pulse
  
  const lfoGain = ctx.createGain();
  lfoGain.gain.value = 0.03; // Pulse amplitude
  
  const mainGain = ctx.createGain();
  mainGain.gain.value = 0; // Base amplitude 0
  
  const panner = ctx.createStereoPanner();
  panner.pan.value = 0.8; // Right channel for Norden
  
  lfo.connect(lfoGain);
  lfoGain.connect(mainGain.gain); // Modulate gain
  
  pulseOsc.connect(pulseFilter);
  pulseFilter.connect(mainGain);
  mainGain.connect(panner);
  panner.connect(ctx.destination);
  
  pulseOsc.start();
  lfo.start();
}

export function updateSystemicAudio(elapsed, turnIdx) {
  if (!ctx || !humOsc || !staticGainNode || !bcNode) return;
  const frac = Math.min(elapsed / 120, 1.0);
  
  // Structural Scaling: hum pitch drops
  humOsc.frequency.setTargetAtTime(45 - frac * 15, ctx.currentTime, 0.5); 
  
  // Structural Scaling: static volume rises harshly
  staticGainNode.gain.setTargetAtTime(0.04 + frac * 0.12, ctx.currentTime, 0.5);
  
  // True Bitcrushing: resolution drops drastically per turn
  bcNode.normFreq = Math.max(0.08, 1.0 - (turnIdx * 0.22)); 
}

// Drops hum pitch and distorts static for end-of-game divergence
export function triggerDivergenceAudio() {
  if (!ctx || !humOsc) return;
  // Slowly collapse the frequencies
  humOsc.frequency.exponentialRampToValueAtTime(10, ctx.currentTime + 4);
  staticFilter.frequency.exponentialRampToValueAtTime(3000, ctx.currentTime + 3);
  staticFilter.Q.value = 5; // harsh ringing
  if (bcNode) bcNode.normFreq = 0.02; // maximum bitcrush fragmentation
}

export function stopAllAudio() {
  if (ctx && ctx.state === 'running') {
    ctx.suspend();
  }
}

export function playDialogueBlip() {
  if (!ctx || ctx.state !== 'running') return;
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(500 + Math.random() * 80, ctx.currentTime);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.02, ctx.currentTime);
  const panner = ctx.createStereoPanner();
  panner.pan.value = -0.7; // Left side for the General's typing
  
  osc.connect(gain);
  gain.connect(panner);
  panner.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.05);
}

// Attack sound: White noise burst + pitch sweep down
export function playAttackSound() {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(600, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(100, ctx.currentTime + 0.2);
  
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.15, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.21);
}

// Crit sound: higher pitch sweep, aggressive
export function playCritSound() {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.setValueAtTime(1200, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.3);
  
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.2, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
  
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.31);
}

// Norden counter: deep thud / low freq crunch
export function playCounterSound() {
  if (!ctx) return;
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(150, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + 0.3);
  
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.4, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
  
  // Create distortion curve
  const dist = ctx.createWaveShaper();
  dist.curve = makeDistortionCurve(60);
  dist.oversample = '4x';
  
  osc.connect(dist);
  dist.connect(gain);
  gain.connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + 0.31);
}

// Helper for crunch
function makeDistortionCurve(amount) {
  const k = amount;
  const n_samples = 44100;
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) {
    const x = i * 2 / n_samples - 1;
    curve[i] = ( 3 + k ) * x * 20 * deg / ( Math.PI + k * Math.abs(x) );
  }
  return curve;
}
