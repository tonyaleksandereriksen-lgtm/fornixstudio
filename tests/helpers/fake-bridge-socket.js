import { EventEmitter } from "node:events";

export class FakeBridgeSocket extends EventEmitter {
  constructor(handler = () => {}) {
    super();
    this.handler = handler;
    this.sent = [];
    this.closed = false;
  }

  send(data) {
    this.sent.push(data);
    const parsed = JSON.parse(String(data));
    this.handler(parsed, this);
  }

  close() {
    if (this.closed) {
      return;
    }

    this.closed = true;
    queueMicrotask(() => this.emit("close"));
  }

  terminate() {
    this.close();
  }

  reply(payload) {
    queueMicrotask(() => this.emit("message", Buffer.from(JSON.stringify(payload))));
  }

  open() {
    queueMicrotask(() => this.emit("open"));
  }
}

export function createSocketFactory(handler, options = {}) {
  const { autoOpen = true, onCreate } = options;

  return () => {
    const socket = new FakeBridgeSocket(handler);
    onCreate?.(socket);

    if (autoOpen) {
      socket.open();
    }

    return socket;
  };
}
