import { createFileRoute } from "@tanstack/react-router";
import { ChatView } from "@/components/app/chat-view";

export const Route = createFileRoute("/_authed/")({ component: Home });

function Home() {
  return <ChatView />;
}
