"use client";

type VolumeControlProps = {
  volume: number;
  onChange: (volume: number) => void;
  disabled?: boolean;
};

export function VolumeControl({ volume, onChange, disabled }: VolumeControlProps) {
  const pct = Math.round(volume * 100);

  return (
    <div
      className={`mx-auto w-full max-w-xs px-2 ${disabled ? "opacity-50" : ""}`}
      title={
        disabled
          ? "Audio bisu di mode ini — volume tidak berlaku"
          : "Volume di perangkat ini saja"
      }
    >
      <div className="mb-1.5 flex items-center justify-between text-xs text-jam-muted">
        <span>Volume (perangkat ini)</span>
        <span aria-live="polite">{pct}%</span>
      </div>
      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={volume}
        disabled={disabled}
        onChange={(e) => onChange(Number.parseFloat(e.target.value))}
        className="h-2 w-full cursor-pointer accent-jam-accent disabled:cursor-not-allowed"
        aria-label="Volume perangkat"
      />
    </div>
  );
}
