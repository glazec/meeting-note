"use client";

import { useCallback, useState } from "react";
import { motion } from "framer-motion";
import { LAYERS, type Layer } from "./layers-data";
import { cn } from "@/lib/utils";

type Props = {
  activeId: string;
  onActivate: (id: string) => void;
};

export function HeroStack({ activeId, onActivate }: Props) {
  const activeIndex = LAYERS.findIndex((l) => l.id === activeId);
  const [hovered, setHovered] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width - 0.5;
      const py = (e.clientY - rect.top) / rect.height - 0.5;
      setTilt({ x: py * -10, y: px * 14 });
    },
    [],
  );

  const handlePointerLeave = useCallback(() => {
    setHovered(false);
    setTilt({ x: 0, y: 0 });
  }, []);

  return (
    <div
      className="relative h-full w-full select-none"
      style={{ perspective: "1400px" }}
      onPointerEnter={() => setHovered(true)}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      aria-label="Interactive stack of Tape layers — drag or click a layer"
    >
      <motion.div
        className="absolute inset-0"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateX: 56 + tilt.x, rotateZ: -26 + tilt.y }}
        transition={{ type: "spring", stiffness: 60, damping: 18 }}
      >
        {LAYERS.map((layer, i) => {
          const isActive = layer.id === activeId;
          const lift = isActive ? 190 : i * 46;
          const fan = hovered ? (i - 1.5) * 7 : 0;
          return (
            <LayerCard
              key={layer.id}
              layer={layer}
              index={i}
              lift={lift}
              fan={fan}
              isActive={isActive}
              dimmed={!isActive}
              above={i > activeIndex}
              onActivate={onActivate}
            />
          );
        })}
      </motion.div>
    </div>
  );
}

function LayerCard({
  layer,
  index,
  lift,
  fan,
  isActive,
  dimmed,
  above,
  onActivate,
}: {
  layer: Layer;
  index: number;
  lift: number;
  fan: number;
  isActive: boolean;
  dimmed: boolean;
  above: boolean;
  onActivate: (id: string) => void;
}) {
  return (
    <motion.button
      type="button"
      onClick={() => onActivate(layer.id)}
      className={cn(
        "absolute left-1/2 top-1/2 block h-[260px] w-[280px] -translate-x-1/2 -translate-y-1/2 cursor-pointer border-2 text-left sm:h-[320px] sm:w-[420px]",
        isActive
          ? "border-ink bg-ivory"
          : "border-ink/70 bg-ivory-deep",
        "shadow-[8px_8px_0_0_var(--ink)]",
      )}
      style={{
        transformStyle: "preserve-3d",
        zIndex: isActive ? 50 : index,
      }}
      initial={false}
      animate={{
        translateZ: lift,
        rotateZ: fan,
        opacity: above && !isActive ? 0.35 : dimmed ? 0.72 : 1,
        scale: isActive ? 1.02 : 1,
        pointerEvents: isActive ? "auto" : "none",
      }}
      transition={{ type: "spring", stiffness: 120, damping: 16, mass: 0.9 }}
      aria-pressed={isActive}
      aria-label={`${layer.tag}: ${layer.title}`}
    >
      <span className="flex h-full flex-col justify-between p-5 sm:p-6">
        <span className="flex items-center justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[0.22em] text-ink/60">
            {layer.tag}
          </span>
          <span
            className={cn(
              "inline-block size-2.5 rounded-full",
              isActive ? "bg-cobalt" : "bg-ink/20",
            )}
          />
        </span>
        <span>
          <span
            className={cn(
              "font-display block text-xl leading-tight sm:text-3xl",
              isActive ? "text-ink" : "text-ink/80",
            )}
          >
            {layer.title}
          </span>
          {isActive ? (
            <span className="mt-3 block max-w-[30ch] text-sm leading-6 text-ink/70">
              {layer.body}
            </span>
          ) : null}
        </span>
        <span className="flex flex-wrap gap-1.5">
          {(isActive ? layer.chips : []).map((chip) => (
            <span
              key={chip}
              className="border border-ink/25 px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest text-ink/70"
            >
              {chip}
            </span>
          ))}
        </span>
      </span>
    </motion.button>
  );
}
