import "dotenv/config";
import { verifySmtpConnection } from "../src/shared/services/email.service.js";

try {
	await verifySmtpConnection();
	console.info("SMTP connection verified.");
} catch (error) {
	console.error(`SMTP connection check failed (${error.category ?? "unexpected"}).`);
	process.exitCode = 1;
}
