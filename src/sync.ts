import { requestUrl } from 'obsidian';
import type { BoardPayload } from './board';
import type { ChorefastData } from './types';

export interface PublishResult {
	url: string;
}

export async function publishBoard(data: ChorefastData, board: BoardPayload): Promise<PublishResult> {
	if (!data.syncId) {
		throw new Error('No Sync ID configured. Add one in Settings → Chorefast.');
	}

	const headers: Record<string, string> = {};
	if (data.syncSecret) headers['x-sync-secret'] = data.syncSecret;

	const res = await requestUrl({
		url: `${data.serverUrl}/api/board/${data.syncId}`,
		method: 'POST',
		contentType: 'application/json',
		headers,
		body: JSON.stringify({ board }),
	});

	if (res.status === 403) {
		const err = res.json as { error?: string } | undefined;
		throw new Error(err?.error || 'Sync secret required. Check your Sync Secret in settings.');
	}
	if (res.status >= 400) {
		throw new Error(`HTTP ${res.status}`);
	}

	const result = res.json as { url?: string } | undefined;
	return { url: result?.url ?? `${data.serverUrl}/s/${data.syncId}` };
}
