"use client";

// Inline SVG logos for each OTA — never breaks, no external dependencies
const logos: Record<string, React.ReactNode> = {
  "Airbnb": (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="#FF5A5F" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0zm5.7 17.4c-.3.6-.9 1-1.5 1-.3 0-.5-.1-.8-.2-1.5-.8-2.7-2-3.5-3.3-.1-.2-.2-.3-.3-.5l-.3-.6c-.2-.4-.4-.8-.5-1.2-.4-1-.6-2-.6-2.8 0-1.2.4-2.1 1.2-2.7.6-.5 1.4-.7 2.1-.7.2 0 .4 0 .5.1.8.1 1.4.5 1.9 1.1.5.6.7 1.4.7 2.3 0 .6-.1 1.2-.3 1.8h-.1c-.1-.4-.3-.7-.6-1-.3-.3-.7-.4-1.1-.4-.7 0-1.3.5-1.3 1.3 0 .5.2 1.1.5 1.8.2.4.4.8.7 1.2.7 1 1.6 1.9 2.7 2.5.2.1.4.2.6.2.4 0 .7-.2.9-.5.2-.3.2-.7.1-1.1l-.1-.2c.5.7.7 1.5.5 2.2-.1.3-.2.5-.4.7z"/>
    </svg>
  ),
  "Booking.com": (
    <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill="#003580"/>
      <text x="12" y="16.5" textAnchor="middle" fill="white" fontSize="14" fontWeight="700" fontFamily="Arial, sans-serif">B</text>
      <circle cx="18" cy="7" r="2.5" fill="white"/>
    </svg>
  ),
  "Expedia": (
    <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill="#FBCE00"/>
      <text x="12" y="17" textAnchor="middle" fill="#1C1C1C" fontSize="15" fontWeight="700" fontFamily="Arial, sans-serif">E</text>
    </svg>
  ),
  "Vrbo": (
    <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill="#3D67B0"/>
      <path d="M5 8l4 8h1l2-4 2 4h1l4-8h-2l-3 6-2-4h-1l-2 4-3-6H5z" fill="white"/>
    </svg>
  ),
  "Agoda": (
    <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill="#5FC2EC"/>
      <text x="12" y="17" textAnchor="middle" fill="white" fontSize="14" fontWeight="700" fontFamily="Arial, sans-serif">A</text>
    </svg>
  ),
  "Direct": (
    <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill="#80020E"/>
      <text x="12" y="17" textAnchor="middle" fill="white" fontSize="14" fontWeight="700" fontFamily="Arial, sans-serif">H</text>
    </svg>
  ),
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

// Fallback icon for unknown channels
function FallbackIcon({ channel }: { channel: string }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <rect width="24" height="24" rx="4" fill="#999"/>
      <text x="12" y="17" textAnchor="middle" fill="white" fontSize="14" fontWeight="700" fontFamily="Arial, sans-serif">
        {channel.charAt(0).toUpperCase()}
      </text>
    </svg>
  );
}

export default function ChannelBadge({ channel, compact = false }: { channel: string; compact?: boolean }) {
  const normalized = normalizeChannel(channel);
  const displayName = normalized === "Direct" ? "Hostyo" : normalized;
  const logo = logos[normalized];

  return (
    <span className="inline-flex items-center gap-[6px] text-[13px] text-[#555] font-medium">
      <span className="flex-shrink-0 flex items-center">
        {logo || <FallbackIcon channel={channel} />}
      </span>
      {!compact && <span>{displayName}</span>}
    </span>
  );
}

// Export for use in filter dropdowns
export function getChannelIcon(channel: string): React.ReactNode {
  const normalized = normalizeChannel(channel);
  return logos[normalized] || <FallbackIcon channel={channel} />;
}

export { normalizeChannel };
