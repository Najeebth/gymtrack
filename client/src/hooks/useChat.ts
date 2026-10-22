import { useCallback, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAppData } from '../context/AppDataContext';
import { useToast } from '../context/ToastContext';
import { clearChatHistoryApi, fetchChatHistoryApi, sendChatMessageApi } from '../api/chat';
import { localToday } from '../utils/date';
import { latestActionableId, readActionStatuses, toWorkoutDraft, writeActionStatus } from '../utils/chat';
import type { ChatActionStatus, ChatMessage } from '../types';

/**
 * Chatbot state: history (React Query cache), optimistic sending, and acting
 * on workout drafts the bot proposes.
 *
 * Confirming a draft goes through AppDataContext.createWorkout, the same path
 * as the workout form, so it saves online or queues to IndexedDB offline.
 */
export function useChat() {
  const { authToken, email, isOnline, createWorkout } = useAppData();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  // Keyed per account so a logout/login never shows the previous user's chat from cache
  const queryKey = ['chat', 'history', email];

  const { data: messages = [], isLoading } = useQuery<ChatMessage[]>({
    queryKey,
    queryFn: () => fetchChatHistoryApi(authToken!),
    enabled: Boolean(authToken) && isOnline,
  });

  // --- Sending ---------------------------------------------------------------

  const sendMutation = useMutation({
    mutationFn: (text: string) => sendChatMessageApi(authToken!, text, localToday()),
    // Show the user's message immediately; the server's copy replaces it on success
    onMutate: async (text) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<ChatMessage[]>(queryKey);
      const tempId = `temp-${Date.now()}`;
      const optimistic: ChatMessage = {
        id: tempId,
        role: 'USER',
        content: text,
        source: null,
        action: null,
        createdAt: new Date().toISOString(),
      };
      queryClient.setQueryData<ChatMessage[]>(queryKey, (old = []) => [...old, optimistic]);
      return { previous, tempId };
    },
    onSuccess: ({ userMessage, assistantMessage }, _text, context) => {
      queryClient.setQueryData<ChatMessage[]>(queryKey, (old = []) => [
        ...old.filter((m) => m.id !== context?.tempId),
        userMessage,
        assistantMessage,
      ]);
    },
    onError: (err, _text, context) => {
      queryClient.setQueryData<ChatMessage[]>(queryKey, context?.previous ?? []);
      showToast(err instanceof Error ? err.message : 'Failed to send message', 'error');
    },
  });

  const canSend = Boolean(authToken) && isOnline;

  const sendMessage = useCallback(
    (text: string): boolean => {
      const trimmed = text.trim();
      if (!trimmed || !canSend || sendMutation.isPending) return false;
      sendMutation.mutate(trimmed);
      return true;
    },
    [canSend, sendMutation]
  );

  // --- Drafts ----------------------------------------------------------------

  const [statuses, setStatuses] = useState(readActionStatuses);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  // A ref, not state: blocks a double tap before React re-renders the disabled button
  const confirmInFlight = useRef(false);

  const markStatus = useCallback((id: string, status: ChatActionStatus) => {
    setStatuses(writeActionStatus(id, status));
  }, []);

  const confirmAction = useCallback(
    async (message: ChatMessage) => {
      if (!message.action || statuses[message.id] || confirmInFlight.current) return;
      confirmInFlight.current = true;
      setConfirmingId(message.id);
      try {
        // createWorkout shows its own saved / queued / failed toast
        const result = await createWorkout(toWorkoutDraft(message.action.draft));
        if (result !== 'error') {
          markStatus(message.id, result);
          queryClient.invalidateQueries({ queryKey: ['workouts'] });
        }
      } finally {
        confirmInFlight.current = false;
        setConfirmingId(null);
      }
    },
    [statuses, createWorkout, markStatus, queryClient]
  );

  const dismissAction = useCallback((id: string) => markStatus(id, 'dismissed'), [markStatus]);

  // --- Clearing --------------------------------------------------------------

  const clearMutation = useMutation({
    mutationFn: () => clearChatHistoryApi(authToken!),
    onSuccess: () => {
      queryClient.setQueryData<ChatMessage[]>(queryKey, []);
      showToast('Chat cleared', 'info');
    },
    onError: (err) => showToast(err instanceof Error ? err.message : 'Failed to clear chat', 'error'),
  });

  return {
    messages,
    isLoading,
    isSending: sendMutation.isPending,
    canSend,
    isOnline,
    sendMessage,
    /** Id of the only draft that can still be confirmed (the newest one). */
    actionableId: latestActionableId(messages),
    statusOf: (id: string): ChatActionStatus | undefined => statuses[id],
    confirmingId,
    confirmAction,
    dismissAction,
    clearHistory: clearMutation.mutate,
    isClearing: clearMutation.isPending,
  };
}
