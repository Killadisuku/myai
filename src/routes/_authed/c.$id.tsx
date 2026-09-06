import { createFileRoute } from "@tanstack/react-router";
import { ChatView } from "@/components/app/chat-view";

export const Route = createFileRoute("/_authed/c/$id")({ component: ConversationPage });

function ConversationPage() {
  const { id } = Route.useParams();
  return <ChatView key={id} conversationId={id} />;
}
