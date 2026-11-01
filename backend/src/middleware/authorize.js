import { AppError } from "../shared/utils/app-error.js";

export function authorize(...allowedRoles) {
	return (req, res, next) => {
		if (!req.user) return next(new AppError(401, "Authentication required"));
		if (!req.user.roles.some((role) => allowedRoles.includes(role))) {
			return next(new AppError(403, "You do not have permission to access this resource"));
		}
		return next();
	};
}
