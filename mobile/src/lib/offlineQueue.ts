import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_STORAGE_KEY = '@livewire_offline_queue_v1';

export interface QueuedMessage {
  id: string; // Client UUID primary key
  stream_id: string;
  user_id: string;
  author_name: string;
  content: string;
  created_at: string;
  retry_count: number;
  status: 'queued' | 'sending' | 'failed' | 'sent';
  last_error?: string;
}

/**
 * Retrieve all queued messages across all streams
 */
export async function getOfflineQueue(): Promise<QueuedMessage[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as QueuedMessage[];
  } catch (e) {
    console.warn('[OfflineQueue] Failed to load queue:', e);
    return [];
  }
}

/**
 * Retrieve queued messages for a specific stream
 */
export async function getStreamQueue(streamId: string): Promise<QueuedMessage[]> {
  const all = await getOfflineQueue();
  return all.filter((m) => m.stream_id === streamId);
}

/**
 * Save full queue to storage
 */
async function saveQueue(queue: QueuedMessage[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (e) {
    console.error('[OfflineQueue] Failed to save queue:', e);
  }
}

/**
 * Enqueue a message for offline sending.
 * Uses client UUID so it is strictly idempotent.
 */
export async function enqueueOfflineMessage(params: {
  id: string;
  stream_id: string;
  user_id: string;
  author_name: string;
  content: string;
  errorReason?: string;
}): Promise<QueuedMessage> {
  const current = await getOfflineQueue();

  // If already in queue, update it
  const existingIdx = current.findIndex((m) => m.id === params.id);
  const now = new Date().toISOString();

  if (existingIdx !== -1) {
    current[existingIdx] = {
      ...current[existingIdx],
      status: 'queued',
      last_error: params.errorReason || current[existingIdx].last_error,
    };
    await saveQueue(current);
    return current[existingIdx];
  }

  const newEntry: QueuedMessage = {
    id: params.id,
    stream_id: params.stream_id,
    user_id: params.user_id,
    author_name: params.author_name,
    content: params.content,
    created_at: now,
    retry_count: 0,
    status: 'queued',
    last_error: params.errorReason,
  };

  current.push(newEntry);
  await saveQueue(current);
  return newEntry;
}

/**
 * Remove a specific message by its UUID once sent or dismissed
 */
export async function removeOfflineMessage(id: string): Promise<void> {
  const current = await getOfflineQueue();
  const filtered = current.filter((m) => m.id !== id);
  await saveQueue(filtered);
}

/**
 * Update message status (e.g. sending, failed, retry count)
 */
export async function updateOfflineMessage(
  id: string,
  updates: Partial<QueuedMessage>
): Promise<void> {
  const current = await getOfflineQueue();
  const idx = current.findIndex((m) => m.id === id);
  if (idx !== -1) {
    current[idx] = { ...current[idx], ...updates };
    await saveQueue(current);
  }
}

/**
 * Clear queue for a stream, or all streams
 */
export async function clearOfflineQueue(streamId?: string): Promise<void> {
  if (!streamId) {
    await AsyncStorage.removeItem(QUEUE_STORAGE_KEY);
    return;
  }
  const current = await getOfflineQueue();
  const remaining = current.filter((m) => m.stream_id !== streamId);
  await saveQueue(remaining);
}

