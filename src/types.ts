export interface ChorefastData {
	serverUrl: string;
	syncId: string;
	syncSecret: string;
}

export const DEFAULT_DATA: ChorefastData = {
	serverUrl: 'https://chore.fast',
	syncId: '',
	syncSecret: '',
};
