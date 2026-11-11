import { AppError } from "../shared/utils/app-error.js";

export function authorize(...allowedRoles) {
	return (req, res, next) => {
		if (!req.user) return next(new AppError(401, "Authentication required"));
		const roles = req.user.roles;
		const hasInvalidRoleCombination = (roles.includes("student") && roles.length > 1)
			|| (roles.includes("administrator") && roles.length > 1);
		if (hasInvalidRoleCombination || !roles.some((role) => allowedRoles.includes(role))) {
			return next(new AppError(403, "You do not have permission to access this resource"));
		}
		return next();
	};
}
