"use client";

export function CustomAvatarCardArt({ src }: { src: string }) {
  return (
    <>
      <span className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(119,216,152,0.22),transparent_56%),linear-gradient(145deg,#0b2d20,#16442f_52%,#070d0a)]" />
      <span className="absolute inset-[10%] rounded-md border border-[#77d898]/22" />
      <span
        className="absolute rounded-md border border-white/12 bg-cover bg-center shadow-inner shadow-black/40"
        style={{ inset: "18% 16%", backgroundImage: `url(${src})` }}
      />
    </>
  );
}
