export function getOnlineOverlayState(status, hasShareLink = false) {
  const message = status?.message || "";
  const players = Number(status?.players || 0);

  if (message === "Waiting for opponent" || (message === "Player joined" && players < 2)) {
    return {
      title: "Waiting for opponent",
      message: "Share the invite link so another player can join.",
      canResume: false,
      canCopyInvite: Boolean(hasShareLink)
    };
  }

  if (message === "Room disconnected") {
    return {
      title: "Room disconnected",
      message: "The room was closed before the match started.",
      canResume: false,
      canCopyInvite: false,
      canExitRoom: true
    };
  }

  if (message === "Player joined" || message.includes("started a rematch")) {
    return {
      title: "Get Ready",
      message: "Opponent joined. Starting soon...",
      canResume: false,
      canCopyInvite: false
    };
  }

  if (message.startsWith("Starting in")) {
    return {
      title: "Get Ready",
      message,
      canResume: false,
      canCopyInvite: false
    };
  }

  if (message.includes("paused")) {
    return {
      title: "Paused",
      message,
      canResume: true,
      canCopyInvite: false
    };
  }

  return null;
}
