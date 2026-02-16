import { cn } from "@/lib/utils";
import { Smile, Paperclip, Mic, MoreVertical, Phone, Video } from "lucide-react";

interface PhoneFrameProps {
  children: React.ReactNode;
}

export function PhoneFrame({ children }: PhoneFrameProps) {
  return (
    <div
      data-testid="phone-frame"
      className={cn(
        "mx-auto w-full max-w-[380px] rounded-2xl border-2 border-foreground/20 overflow-hidden flex flex-col",
        "bg-[#ECE5DD] dark:bg-[#0B141A]"
      )}
    >
      <div className="h-6 bg-gray-300 dark:bg-gray-800 rounded-t-xl flex items-center justify-center">
        <div className="w-16 h-1 rounded-full bg-gray-400 dark:bg-gray-600" />
      </div>

      <div className="bg-[#075E54] dark:bg-[#1F2C34] flex items-center gap-3 px-3 py-2">
        <div className="h-9 w-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
          <span className="text-white text-xs font-bold">AI</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-semibold truncate">AI-Продавец</p>
          <p className="text-white/70 text-xs">онлайн</p>
        </div>
        <div className="flex items-center gap-3">
          <Video className="w-4 h-4 text-white/80" />
          <Phone className="w-4 h-4 text-white/80" />
          <MoreVertical className="w-4 h-4 text-white/80" />
        </div>
      </div>

      <div
        data-testid="phone-frame-content"
        className="flex-1 overflow-y-auto p-3 space-y-1"
        style={{ maxHeight: "500px" }}
      >
        {children}
      </div>

      <div className="bg-[#F0F0F0] dark:bg-[#1F2C34] flex items-center gap-2 px-2 py-2">
        <Smile className="w-5 h-5 text-muted-foreground shrink-0" />
        <div className="flex-1 rounded-full bg-white dark:bg-[#2A3942] px-3 py-1.5">
          <span className="text-xs text-muted-foreground">Сообщение</span>
        </div>
        <Paperclip className="w-5 h-5 text-muted-foreground shrink-0" />
        <div className="h-8 w-8 rounded-full bg-[#075E54] dark:bg-[#00A884] flex items-center justify-center shrink-0">
          <Mic className="w-4 h-4 text-white" />
        </div>
      </div>
    </div>
  );
}
