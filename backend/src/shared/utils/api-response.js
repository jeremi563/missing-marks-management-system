export function sendSuccess(res, message, data, statusCode = 200, pagination) {
	const response = { success: true, message, data };
	if (pagination) response.pagination = pagination;
	return res.status(statusCode).json(response);
}

export function sendFailure(res, message, statusCode = 400, details) {
	const body = { success: false, message };
	if (details !== undefined) body.details = details;
	return res.status(statusCode).json(body);
}
