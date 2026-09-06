import assert from "node:assert/strict";
import test from "node:test";

import { LazyIndexedDbConnection } from "./indexedDbPrimitives.js";

type Listener = () => void;

class FakeOpenRequest {
  result!: IDBDatabase;
  error: DOMException | null = null;
  private readonly listeners = new Map<string, Listener[]>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const callback =
      typeof listener === "function" ? () => listener({} as Event) : () => listener.handleEvent({} as Event);
    const current = this.listeners.get(type) ?? [];
    current.push(callback);
    this.listeners.set(type, current);
  }

  dispatch(type: string): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener();
  }
}

class FakeDatabase {
  closeCount = 0;
  private readonly listeners = new Map<string, Listener[]>();

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const callback =
      typeof listener === "function" ? () => listener({} as Event) : () => listener.handleEvent({} as Event);
    const current = this.listeners.get(type) ?? [];
    current.push(callback);
    this.listeners.set(type, current);
  }

  close(): void {
    this.closeCount += 1;
  }

  dispatch(type: string): void {
    for (const listener of [...(this.listeners.get(type) ?? [])]) listener();
  }
}

class FakeFactory {
  readonly requests: FakeOpenRequest[] = [];

  open(): IDBOpenDBRequest {
    const request = new FakeOpenRequest();
    this.requests.push(request);
    return request as unknown as IDBOpenDBRequest;
  }
}

function fixture(factory: FakeFactory): LazyIndexedDbConnection {
  return new LazyIndexedDbConnection({
    factory: factory as unknown as IDBFactory,
    databaseName: "test",
    databaseVersion: 1,
    upgrade: () => {},
    openErrorMessage: "open failed",
    blockedErrorMessage: "open blocked",
  });
}

test("failed open is not cached and the next get retries", async () => {
  const factory = new FakeFactory();
  const connection = fixture(factory);

  const first = connection.get();
  factory.requests[0]!.error = new DOMException("boom");
  factory.requests[0]!.dispatch("error");
  await assert.rejects(first, /boom/);

  const second = connection.get();
  assert.equal(factory.requests.length, 2);
  const database = new FakeDatabase();
  factory.requests[1]!.result = database as unknown as IDBDatabase;
  factory.requests[1]!.dispatch("success");
  assert.equal(await second, database as unknown as IDBDatabase);
});

test("blocked open is abandoned; a late success is closed and the next get retries", async () => {
  const factory = new FakeFactory();
  const connection = fixture(factory);

  const first = connection.get();
  factory.requests[0]!.dispatch("blocked");
  await assert.rejects(first, /open blocked/);

  const abandonedDatabase = new FakeDatabase();
  factory.requests[0]!.result = abandonedDatabase as unknown as IDBDatabase;
  factory.requests[0]!.dispatch("success");
  assert.equal(abandonedDatabase.closeCount, 1);

  connection.get();
  assert.equal(factory.requests.length, 2);
});

test("versionchange closes the cached database and the next get reopens it", async () => {
  const factory = new FakeFactory();
  const connection = fixture(factory);

  const firstPromise = connection.get();
  const firstDatabase = new FakeDatabase();
  factory.requests[0]!.result = firstDatabase as unknown as IDBDatabase;
  factory.requests[0]!.dispatch("success");
  await firstPromise;

  assert.equal(connection.get(), firstPromise);
  firstDatabase.dispatch("versionchange");
  assert.equal(firstDatabase.closeCount, 1);

  connection.get();
  assert.equal(factory.requests.length, 2);
});

test("a stale database versionchange cannot clear a newer cached connection", async () => {
  const factory = new FakeFactory();
  const connection = fixture(factory);

  const firstPromise = connection.get();
  const firstDatabase = new FakeDatabase();
  factory.requests[0]!.result = firstDatabase as unknown as IDBDatabase;
  factory.requests[0]!.dispatch("success");
  await firstPromise;

  firstDatabase.dispatch("versionchange");
  const secondPromise = connection.get();
  const secondDatabase = new FakeDatabase();
  factory.requests[1]!.result = secondDatabase as unknown as IDBDatabase;
  factory.requests[1]!.dispatch("success");
  await secondPromise;

  firstDatabase.dispatch("versionchange");
  assert.equal(connection.get(), secondPromise);
  assert.equal(factory.requests.length, 2);
});
