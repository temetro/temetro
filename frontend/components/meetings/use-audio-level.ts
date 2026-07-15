"use client";

import { useEffect, useState } from "react";

// Returns true while the given stream's audio is above a speaking threshold —
// used to draw a Discord-style "speaking" ring around a participant's tile.
// Degrades silently if the Web Audio API isn't available.
export function useSpeaking(stream: MediaStream | null): boolean {
  const [speaking, setSpeaking] = useState(false);

  // Stop reporting "speaking" the moment the stream goes away or changes, so a
  // muted tile can't keep a stale ring. Adjusted during render rather than in
  // the effect below, which is only for driving the Web Audio graph.
  const [prevStream, setPrevStream] = useState(stream);
  if (prevStream !== stream) {
    setPrevStream(stream);
    setSpeaking(false);
  }

  useEffect(() => {
    if (!stream || stream.getAudioTracks().length === 0) return;
    let ctx: AudioContext | null = null;
    let raf = 0;
    try {
      ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      source.connect(analyser);
      const data = new Uint8Array(analyser.frequencyBinCount);
      const tick = () => {
        analyser.getByteTimeDomainData(data);
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i]! - 128) / 128;
          sum += v * v;
        }
        setSpeaking(Math.sqrt(sum / data.length) > 0.045);
        raf = requestAnimationFrame(tick);
      };
      tick();
    } catch {
      /* no Web Audio — no ring */
    }
    return () => {
      cancelAnimationFrame(raf);
      ctx?.close().catch(() => {});
    };
  }, [stream]);

  return speaking;
}
