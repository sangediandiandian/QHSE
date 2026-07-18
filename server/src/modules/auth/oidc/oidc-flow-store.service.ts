import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import type { OidcFlowStore, OidcLoginResult, OidcTransaction } from './oidc-flow.store';

@Injectable()
export class OidcFlowStoreService implements OnModuleDestroy {
  constructor(private readonly store: OidcFlowStore) {}

  get backend() {
    return this.store.backend;
  }

  putTransaction(id: string, value: OidcTransaction, ttlMs: number) {
    return this.store.putTransaction(id, value, ttlMs);
  }

  takeTransaction(id: string) {
    return this.store.takeTransaction(id);
  }

  putResult(id: string, value: OidcLoginResult, ttlMs: number) {
    return this.store.putResult(id, value, ttlMs);
  }

  takeResult(id: string) {
    return this.store.takeResult(id);
  }

  check() {
    return this.store.ping();
  }

  async onModuleDestroy() {
    await this.store.close();
  }
}
