export class HttpError extends Error {
	constructor(
		public readonly status: number,
		message: string,
		public readonly body?: unknown,
		public readonly path?: string,
	) {
		super(message);
		this.name = "HttpError";
	}
}
