import Image from "next/image";

import { cn } from "@/lib/utils";

export function ProductLogo({ className }: { className?: string }) {
  return (
    <Image
      src="/brand/tape-lockup.svg"
      alt=""
      width={90}
      height={32}
      loading="eager"
      unoptimized
      className={cn("h-8 w-[90px] shrink-0", className)}
    />
  );
}
