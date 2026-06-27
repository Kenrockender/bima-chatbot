export function BimaAvatar({
  size = 36,
  withPulse = false,
}: {
  size?: number;
  withPulse?: boolean;
}) {
  return (
    <div
      style={{ width: size, height: size }}
      className="relative inline-flex items-center justify-center shrink-0"
      aria-label="BIMA avatar"
    >
      {withPulse && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-[28%] bg-bca-yellow/40 animate-pulseRing"
        />
      )}
      <img
        src="/bima-icon-192.png"
        alt=""
        width={size}
        height={size}
        className="relative z-10 rounded-[22%] drop-shadow-xs"
        aria-hidden
      />
    </div>
  );
}
