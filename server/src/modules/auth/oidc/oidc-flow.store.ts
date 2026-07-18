export interface OidcTransaction {
  state: string;
  nonce: string;
  codeVerifier: string;
  createdAt: number;
}

export interface OidcLoginResult {
  accessToken: string;
  expiresIn: number;
  passwordChangeRequired: boolean;
  createdAt: number;
}

export interface OidcFlowStore {
  readonly backend: 'memory' | 'redis';
  putTransaction(id: string, value: OidcTransaction, ttlMs: number): Promise<void>;
  takeTransaction(id: string): Promise<OidcTransaction | undefined>;
  putResult(id: string, value: OidcLoginResult, ttlMs: number): Promise<void>;
  takeResult(id: string): Promise<OidcLoginResult | undefined>;
  ping(): Promise<void>;
  close(): Promise<void>;
}

export class MemoryOidcFlowStore implements OidcFlowStore {
  readonly backend = 'memory' as const;
  private readonly transactions = new Map<string, { value: OidcTransaction; expiresAt: number }>();
  private readonly results = new Map<string, { value: OidcLoginResult; expiresAt: number }>();

  constructor(private readonly now: () => number = Date.now) {}

  async putTransaction(id: string, value: OidcTransaction, ttlMs: number) {
    this.transactions.set(id, { value: structuredClone(value), expiresAt: this.now() + ttlMs });
  }

  async takeTransaction(id: string) {
    return this.take(this.transactions, id);
  }

  async putResult(id: string, value: OidcLoginResult, ttlMs: number) {
    this.results.set(id, { value: structuredClone(value), expiresAt: this.now() + ttlMs });
  }

  async takeResult(id: string) {
    return this.take(this.results, id);
  }

  async ping() {}

  async close() {
    this.transactions.clear();
    this.results.clear();
  }

  private take<T>(records: Map<string, { value: T; expiresAt: number }>, id: string) {
    const record = records.get(id);
    records.delete(id);
    if (!record || record.expiresAt <= this.now()) return undefined;
    return structuredClone(record.value);
  }
}
