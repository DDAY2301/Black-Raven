import test from "node:test";
import assert from "node:assert/strict";
import { composeMail, smtpTransaction } from "../src/smtp.js";
import { validateEnquiry } from "../../backend/lib.js";

function fakeServer({ rejectAuth = false, rejectRecipient = false } = {}) {
  const commands = [];
  let controller;
  const socket = {
    opened: Promise.resolve(),
    readable: new ReadableStream({
      start(c) { controller = c; c.enqueue(new TextEncoder().encode("220 smtp.test ESMTP ready\r\n")); }
    }),
    writable: new WritableStream({
      write(bytes) {
        const line = new TextDecoder().decode(bytes);
        commands.push(line);
        let response = "500 Unsupported\r\n";
        if (line.startsWith("EHLO ")) response = "250-smtp.test\r\n250-AUTH PLAIN LOGIN\r\n250 SIZE 50000\r\n";
        else if (line.startsWith("AUTH PLAIN ")) response = rejectAuth ? "535 Authentication failed\r\n" : "235 Authenticated\r\n";
        else if (line.startsWith("MAIL FROM:")) response = "250 Sender accepted\r\n";
        else if (line.startsWith("RCPT TO:")) response = rejectRecipient ? "550 Recipient rejected\r\n" : "250 Recipient accepted\r\n";
        else if (line === "DATA\r\n") response = "354 End data with <CRLF>.<CRLF>\r\n";
        else if (line.endsWith("\r\n.\r\n")) response = "250 Message queued\r\n";
        controller.enqueue(new TextEncoder().encode(response));
      }
    }),
    close() { try { controller.close(); } catch (_) {} }
  };
  return {
    connect: (addr, opts) => {
      assert.equal(addr.hostname, "smtpout.secureserver.net");
      assert.equal(addr.port, 465);
      assert.equal(opts.secureTransport, "on");
      return socket;
    },
    commands
  };
}
const account = { host: "smtpout.secureserver.net", port: 465, username: "info@blackraven.solutions", password: "placeholder-test-only" };

test("Black Raven enquiry validation rejects invalid and injected data", () => {
  assert.equal(validateEnquiry({ name: "A", email: "x@y.com", message: "Hello world" }).error, "Invalid name");
  assert.ok(validateEnquiry({ name: "Customer", email: "hello@example.com", message: "Hello, I want to learn more about your programmes." }).value);
  assert.equal(validateEnquiry({ name: "Customer\r\nBcc:x", email: "hello@example.com", message: "Message body long enough" }).error, "Invalid name");
});

test("MIME content keeps only fixed sender and safe visitor reply-to", () => {
  const mail = composeMail({
    from: "info@blackraven.solutions", to: "info@blackraven.solutions", replyTo: "customer@example.com",
    body: "Pozdravljeni, zanima me izlet."
  });
  assert.match(mail, /From: Black Raven Website <info@blackraven.solutions>/);
  assert.match(mail, /Reply-To: <customer@example.com>/);
  assert.match(mail, /\r\nContent-Transfer-Encoding: base64\r\n/);
  assert.match(mail, /Subject: =\?UTF-8\?B\?/);
  assert.ok(!mail.includes("Pozdravljeni"), "Body should be safely encoded");
  assert.throws(() => composeMail({ from: "bad\r\nBcc:evil@example.com", to: "info@blackraven.solutions", replyTo: "user@example.com", body: "x" }), /Invalid SMTP address/);
});

test("Cloudflare socket authenticates and accepts outgoing message", async () => {
  const smtp = fakeServer();
  const mime = composeMail({ from: account.username, to: account.username, replyTo: "visitor@example.com", body: "Test message" });
  assert.equal(await smtpTransaction(smtp.connect, account, { to: account.username, mime }), true);
  assert.ok(smtp.commands.some(c => c.startsWith("AUTH PLAIN ")));
  assert.ok(smtp.commands.some(c => c.includes("RCPT TO:<info@blackraven.solutions>")));
  assert.ok(smtp.commands.some(c => c.includes("Message-ID:")));
});

test("SMTP authentication fails safely", async () => {
  const smtp = fakeServer({ rejectAuth: true });
  await assert.rejects(smtpTransaction(smtp.connect, account), /SMTP unexpected response 535/);
});

test("SMTP recipient refusal must not claim successful sending", async () => {
  const smtp = fakeServer({ rejectRecipient: true });
  const mime = composeMail({ from: account.username, to: account.username, replyTo: "visitor@example.com", body: "Test message" });
  await assert.rejects(smtpTransaction(smtp.connect, account, { to: account.username, mime }), /SMTP unexpected response 550/);
});
