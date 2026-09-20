/**
 * Produksjonsnavn for den generelle samtalemotoren. Nyhavna-eksportene beholdes
 * som kompatibilitetsalias til de lokale migreringsoraklene er fjernet i U8.
 */
export {
  conversationTools as boardConversationTools,
  createNyhavnaConversation as createBoardConversation,
  type ConversationDeps as BoardConversationDeps,
  type NyhavnaConversation as BoardConversation,
} from "@/lib/realtime/nyhavna-conversation";
