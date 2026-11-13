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
		if (roles.some((role) => ["student", "lecturer", "cod", "administrator"].includes(role)) && req.user.approvalStatus !== "APPROVED") {
			return next(new AppError(403, "Your account is not yet approved for this area."));
		}
		return next();
	};
}
