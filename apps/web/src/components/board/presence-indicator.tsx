import { useMemo } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useKangStore } from "@/store/kang-store";

export function PresenceIndicator() {
  const users = useKangStore((s) => s.users);
  const currentUser = useKangStore((s) => s.currentUser);

  // Sort so current user is always first, memoized for efficiency
  const sortedUsers = useMemo(() => {
    return users.toSorted((a, b) => {
      if (a.userId === currentUser.userId) return -1;
      if (b.userId === currentUser.userId) return 1;
      return a.displayName.localeCompare(b.displayName);
    });
  }, [users, currentUser.userId]);

  if (users.length === 0) return null;

  return (
    <div className="flex items-center -space-x-2">
      {sortedUsers.map((user) => {
        const initials = user.displayName
          .split(" ")
          .map((w) => w[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);

        const isYou = user.userId === currentUser.userId;

        return (
          <Tooltip key={user.userId}>
            <TooltipTrigger>
              <span
                className={`inline-block relative hover:z-30 transition-transform ${isYou ? "z-20" : "z-0"}`}
              >
                <Avatar
                  className={`h-8 w-8 border-2 border-background transition-transform hover:scale-110 cursor-default relative ${
                    isYou
                      ? "ring-2 ring-green-500 ring-offset-1 ring-offset-background"
                      : ""
                  }`}
                >
                  <AvatarFallback
                    className="text-[11px] font-bold text-white"
                    style={{ backgroundColor: user.color }}
                  >
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </span>
            </TooltipTrigger>
            <TooltipContent>
              <p className="text-xs font-medium">
                {user.displayName}
                {isYou && " (you)"}
              </p>
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
