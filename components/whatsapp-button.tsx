import { MessageCircle } from "lucide-react";
import { whatsappUrl } from "@/lib/member/whatsapp";
import { cn } from "@/lib/utils";

/**
 * Opens a WhatsApp chat with `phone` (wa.me click-to-chat) in a new tab.
 * Renders nothing usable for a number that cannot be normalized, so a typo
 * in the stored phone never produces a link to the wrong person.
 */
export function WhatsAppButton({
  phone,
  name,
  compact = false,
  className,
}: {
  phone: string;
  /** Recipient's name, for the accessible label. */
  name: string;
  /** Icon-only, for table cells. */
  compact?: boolean;
  className?: string;
}) {
  const url = whatsappUrl(phone);
  if (!url) {
    return compact ? (
      <span className="text-muted-foreground" title="Nomor HP tidak valid untuk WhatsApp">
        —
      </span>
    ) : null;
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`Kirim pesan WhatsApp ke ${name}`}
      title="Kirim pesan WhatsApp"
      className={cn(
        "inline-flex items-center justify-center gap-1.5 rounded-lg text-sm font-medium transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        "bg-emerald-600 text-white hover:bg-emerald-700 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400",
        compact ? "size-11 xl:size-8" : "h-9 px-3",
        className,
      )}
    >
      <MessageCircle className="size-4" />
      {!compact && "WhatsApp"}
    </a>
  );
}
