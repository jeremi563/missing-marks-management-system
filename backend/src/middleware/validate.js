export function validate(schema, source = "body") {
	return (req, res, next) => {
		const result = schema.safeParse(req[source]);
		if (!result.success) {
			return next(Object.assign(new Error("Request validation failed"), {
				statusCode: 400,
				details: result.error.issues.map(({ path, message }) => ({ path: path.join("."), message })),
			}));
		}
		if (source === "query") {
			Object.defineProperty(req, "query", {
				configurable: true,
				enumerable: true,
				writable: true,
				value: result.data,
			});
		} else {
			req[source] = result.data;
		}
		return next();
	};
}
