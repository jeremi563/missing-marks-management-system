import net from "node:net";

export async function createSmtpServer({ greetingDelayMs = 0, responses = {} } = {}) {
	const messages = [];
	const sockets = new Set();
	const server = net.createServer((socket) => {
		sockets.add(socket);
		socket.setEncoding("utf8");
		socket.on("close", () => sockets.delete(socket));
		if (greetingDelayMs >= 0) setTimeout(() => {
			if (!socket.destroyed) socket.write("220 localhost ESMTP\r\n");
		}, greetingDelayMs).unref();

		let buffer = "";
		let receivingData = false;
		socket.on("data", (chunk) => {
			buffer += chunk;
			while (buffer) {
				if (receivingData) {
					const end = buffer.indexOf("\r\n.\r\n");
					if (end === -1) return;
					messages.push(buffer.slice(0, end + 2));
					buffer = buffer.slice(end + 5);
					receivingData = false;
					socket.write(responses.data ?? "250 Message accepted\r\n");
					continue;
				}

				const lineEnd = buffer.indexOf("\r\n");
				if (lineEnd === -1) return;
				const line = buffer.slice(0, lineEnd);
				buffer = buffer.slice(lineEnd + 2);
				const command = line.split(" ", 1)[0].toUpperCase();
				if (command === "DATA" && !responses.data) {
					receivingData = true;
					socket.write("354 End data with <CR><LF>.<CR><LF>\r\n");
				} else if (command === "DATA") {
					socket.write(responses.data);
				} else if (command === "RCPT" && responses.recipient) {
					socket.write(responses.recipient);
				} else if (command === "AUTH" && responses.auth) {
					socket.write(responses.auth);
				} else if (command === "QUIT") {
					socket.write("221 Bye\r\n");
					socket.end();
				} else if (command === "EHLO" || command === "HELO") {
					socket.write(`250-localhost\r\n${responses.auth ? "250-AUTH PLAIN LOGIN\r\n" : ""}250 SIZE 10485760\r\n`);
				} else {
					socket.write("250 OK\r\n");
				}
			}
		});
	});

	await new Promise((resolve, reject) => {
		server.once("error", reject);
		server.listen(0, "127.0.0.1", resolve);
	});

	return {
		host: "127.0.0.1",
		port: server.address().port,
		messages,
		async close() {
			for (const socket of sockets) socket.destroy();
			await new Promise((resolve) => server.close(resolve));
		},
	};
}
