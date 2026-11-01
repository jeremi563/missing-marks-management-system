export function sendSuccess(res, message, data, statusCode = 200) {
	return res.status(statusCode).json({ success: true, message, data });
}

export function sendFailure(res, message, statusCode = 400, details) {
	const body = { success: false, message };
	if (details !== undefined) body.details = details;
	return res.status(statusCode).json(body);
}
