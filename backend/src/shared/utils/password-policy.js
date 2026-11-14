export const PASSWORD_POLICY_MESSAGE = "Password must be 8 to 128 characters and include at least one letter, one number, and one special character.";

export function hasPasswordComposition(password) {
	return /\p{L}/u.test(password)
		&& /\p{N}/u.test(password)
		&& /[^\p{L}\p{N}\s]/u.test(password);
}

export function meetsPasswordPolicy(password) {
	return typeof password === "string"
		&& password.length >= 8
		&& password.length <= 128
		&& hasPasswordComposition(password);
}
