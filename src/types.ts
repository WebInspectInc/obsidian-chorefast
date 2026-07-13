export interface ChorefastData {
	sourceFile: string | null;
	serverUrl: string;
	syncId: string;
}

export const DEFAULT_DATA: ChorefastData = {
	sourceFile: null,
	serverUrl: 'https://chore.fast',
	syncId: '',
};
