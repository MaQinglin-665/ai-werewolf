"use client";

import Image from "next/image";
import type * as React from "react";
import type { Role } from "@/game/types";
import { ROLE_CARD_ASPECT_RATIOS, ROLE_CARD_IMAGES } from "./viewHelpers";

export function RoleCardArtwork({
  role,
  title,
  src = ROLE_CARD_IMAGES[role],
  className = "",
  imageClassName = "object-contain",
  priority = false,
  sizes = "120px",
  style,
}: {
  role: Role;
  title: string;
  src?: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  sizes?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={["relative shrink-0 overflow-hidden bg-[#120c0a]", className].join(" ")}
      style={{ aspectRatio: ROLE_CARD_ASPECT_RATIOS[role], ...style }}
    >
      <Image
        fill
        priority={priority}
        sizes={sizes}
        className={imageClassName}
        src={src}
        alt={`${title}身份牌`}
      />
    </div>
  );
}
