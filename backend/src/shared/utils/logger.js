const levels = { debug: 10, info: 20, warn: 30, error: 40 };

function serializeError(error) {
	return {
		name: error?.name ?? "Error",
		code: error?.code,
	};
}

export function createLogger({ level = process.env.LOG_LEVEL ?? "info", sink = console } = {}) {
	const threshold = levels[level] ?? levels.info;

	function write(name, message, fields = {}) {
		if (levels[name] < threshold) return;
		const record = {
			timestamp: new Date().toISOString(),
			level: name,
			message,
			...fields,
		};
		const output = JSON.stringify(record, (_key, value) => value instanceof Error ? serializeError(value) : value);
		const method = name === "debug" ? "log" : name;
		sink[method]?.(output);
	}

	return {
		debug: (message, fields) => write("debug", message, fields),
		info: (message, fields) => write("info", message, fields),
		warn: (message, fields) => write("warn", message, fields),
		error: (message, fields) => write("error", message, fields),
	};
}

export const logger = createLogger();