"use client";

// Real OTA favicon images + SVG fallbacks
const logoImages: Record<string, string> = {
  "Airbnb": "/ota-logos/airbnb.avif",
  "Booking.com": "/ota-logos/booking.svg",
  "Expedia": "/ota-logos/expedia.ico",
  "Direct": "/hostyo-logo.png",
};

const logoFallbacks: Record<string, { bg: string; letter: string }> = {
  "Vrbo": { bg: "#3D67B0", letter: "V" },
  "Agoda": { bg: "#5FC2EC", letter: "A" },
};

function normalizeChannel(channel: string): string {
  const lower = channel.toLowerCase().trim();
  if (lower.includes("booking")) return "Booking.com";
  if (lower.includes("airbnb")) return "Airbnb";
  if (lower.includes("expedia")) return "Expedia";
  if (lower.includes("vrbo")) return "Vrbo";
  if (lower.includes("agoda")) return "Agoda";
  if (lower.includes("direct") || lower.includes("hostyo")) return "Direct";
  return channel;
}

function ChannelLogo({ channel, size = 16 }: { channel: string; size?: number }) {
  const normalized = normalizeChannel(channel);
  const imgSrc = logoImages[normalized];

  if (imgSrc) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imgSrc}
        alt={normalized}
        width={size}
        height={size}
        className="rounded-sm object-contain flex-shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }

  const fallback = logoFallbacks[normalized];
  if (fallback) {
    return (
      <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
        <rect width="24" height="24" rx="4" fill={fallback.bg}/>
        <text x="12" y="17" textAnchor="middle" fill="white" fontSize="14" fontWeight="700" fontFamily="Arial, sans-serif">{fallback.letter}</text>
      </svg>
    );
  }

  // Unknown channel
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" className="flex-shrink-0">
      <rect width="24" height="24" rx="4" fill="#999"/>
      <text x="12" y="17" textAnchor="middle" fill="white" fontSize="14" fontWeight="700" fontFamily="Arial, sans-serif">{channel.charAt(0).toUpperCase()}</text>
    </svg>
  );
}

export default function ChannelBadge({ channel, compact = false }: { channel: string; compact?: boolean }) {
  const normalized = normalizeChannel(channel);
  const displayName = normalized === "Direct" ? "Hostyo" : normalized;

  return (
    <span className="inline-flex items-center gap-[6px] text-[13px] text-[#555] font-medium">
      <ChannelLogo channel={channel} size={16} />
      {!compact && <span>{displayName}</span>}
    </span>
  );
}

export function getChannelIcon(channel: string): React.ReactNode {
  return <ChannelLogo channel={channel} size={16} />;
}

export { normalizeChannel };
