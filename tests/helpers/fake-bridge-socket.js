// Fake WebSocket for bridge tests — no real network needed.
import { EventEmitter } from "node:events";

export class FakeBridgeSocket extends EventEmitter {
  sent = [];
  closed = false;
  readyState = 1; // OPEN

  constructor(handler) {
    super();
    this._handler = handler ?? null;
  }

  send(data) {
    this.sent.push(data);
    if (this._handler) {
      const parsed = JSON.parse(data);
      this._handler(parsed, this);
    }
  }

  close() {
    this.closed = true;
    this.readyState = 3; // CLOSED
    queueMicrotask(() => this.emit("close"));
  }

  terminate() {
    this.close();
  }

  /** Simulate receiving a message from the "extension" */
  reply(payload) {
    this.emit("message", JSON.stringify(payload));
  }

  /** Simulate connection opening */
  open() {
    this.emit("open");
  }
}

/**
 * Factory generator for injecting into the bridge via __setSocketFactoryForTests.
 *
 * @param {Function} handler - Called with (parsedMsg, socket) when socket.send() is called
 * @param {object} [options]
 * @param {boolean} [options.autoOpen=true] - Automatically emit "open" after creation
 * @param {Function} [options.onCreate] - Called with (socket) after creation
 */
export function createSocketFactory(handler, options = {}) {
  const { autoOpen = true, onCreate } = options;
  return function socketFactory(_url) {
    const socket = new FakeBridgeSocket(handler);
    if (onCreate) onCreate(socket);
    if (autoOpen) queueMicrotask(() => socket.open());
    return socket;
  };
}
