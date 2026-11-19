export async function getSystemSettingValue(db, key, fallback) {
	const findUnique = db.systemSetting?.findUnique;
	if (!findUnique) return fallback;
	const setting = await findUnique.call(db.systemSetting, { where: { key }, select: { value: true } });
	return setting?.value ?? fallback;
}