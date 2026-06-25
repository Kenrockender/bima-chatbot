"use client";

import { useEffect, useRef, useState } from "react";

export function AudioWaveform({ active, barCount = 24 }: { active: boolean; barCount?: number }) {
  const [levels, setLevels] = useState<number[]>(() => new Array(barCount).fill(0));
  const ctxRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const rafRef = useRef<number | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    if (!active) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      setLevels(new Array(barCount).fill(0));
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        const ctx = new AudioContext();
        ctxRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 64;
        analyser.smoothingTimeConstant = 0.7;
        source.connect(analyser);
        analyserRef.current = analyser;

        const buf = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          if (cancelled) return;
          analyser.getByteFrequencyData(buf);
          const bars: number[] = [];
          const step = Math.max(1, Math.floor(buf.length / barCount));
          for (let i = 0; i < barCount; i++) {
            const val = buf[Math.min(i * step, buf.length - 1)] ?? 0;
            bars.push(val / 255);
          }
          setLevels(bars);
          rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
      } catch {
        // mic already in use or denied — silently degrade
      }
    })();

    return () => {
      cancelled = true;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      ctxRef.current?.close().catch(() => {});
      ctxRef.current = null;
    };
  }, [active, barCount]);

  return (
    <div className="flex items-center justify-center gap-[2px] h-8">
      {levels.map((v, i) => (
        <div
          key={i}
          className="w-[3px] rounded-full bg-life-blue/80"
          style={{
            height: `${Math.max(3, v * 28)}px`,
            transition: "height 80ms ease-out",
          }}
        />
      ))}
    </div>
  );
}
