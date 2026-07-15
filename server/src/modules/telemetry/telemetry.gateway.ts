import { ServiceUnavailableException, type OnModuleDestroy } from '@nestjs/common';
import { OnGatewayInit, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import type { AuthPrincipal } from '../iam/iam.types';
import { TelemetryStreamService } from './telemetry-stream.service';
import type { TelemetrySource, TelemetryStreamEvent } from './telemetry.types';

interface SubscriptionRequest {
  afterSequence?: number;
  sources?: TelemetrySource[];
  areaIds?: string[];
}

interface SocketSubscription {
  principal: AuthPrincipal;
  sources?: TelemetrySource[];
  areaIds?: string[];
}

const matches = (subscription: SocketSubscription, event: TelemetryStreamEvent) =>
  (!subscription.sources || subscription.sources.includes(event.point.source)) &&
  (!subscription.areaIds || subscription.areaIds.includes(event.point.areaId));

const tokenFrom = (client: Socket) => {
  const authToken = client.handshake.auth?.token;
  if (typeof authToken === 'string' && authToken) return authToken.replace(/^Bearer\s+/i, '');
  const authorization = client.handshake.headers.authorization;
  const match = authorization?.match(/^Bearer\s+(.+)$/i);
  if (!match) throw new Error('SESSION_INVALID');
  return match[1];
};

const positiveInteger = (value: unknown) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
};

const isString = (value: unknown): value is string => typeof value === 'string' && value.length > 0;

@WebSocketGateway({ namespace: '/telemetry' })
export class TelemetryGateway implements OnGatewayInit, OnModuleDestroy {
  @WebSocketServer() private server!: Namespace;
  private unsubscribe?: () => void;

  constructor(
    private readonly stream: TelemetryStreamService,
    private readonly auth: AuthService,
  ) {}

  afterInit() {
    this.unsubscribe = this.stream.subscribe((event) => this.broadcast(event));
    this.server.on('connection', (client) => void this.handleConnection(client));
  }

  onModuleDestroy() {
    this.unsubscribe?.();
  }

  private async handleConnection(client: Socket) {
    try {
      const token = tokenFrom(client);
      const principal = await this.auth.authenticate(token);
      if (!principal.permissions.includes('telemetry:read')) throw new Error('PERMISSION_DENIED');
      client.data.subscription = { principal } satisfies SocketSubscription;
      client.emit('telemetry:ready', {
        streamId: this.stream.streamId(),
        latestSequence: this.stream.latestSequence(),
        serverTime: new Date().toISOString(),
      });
      client.on(
        'telemetry:subscribe',
        (
          request: SubscriptionRequest = {},
          acknowledge?: (result: {
            replayed: number;
            latestSequence: number;
            replayGap: boolean;
          }) => void,
        ) => {
          const subscription = this.subscription(principal, request);
          client.data.subscription = subscription;
          const afterSequence = positiveInteger(request.afterSequence);
          const earliestSequence = this.stream.earliestSequence();
          const events = this.stream.replay(afterSequence, (event) => matches(subscription, event));
          events.forEach((event) => client.emit('telemetry:sample', event));
          acknowledge?.({
            replayed: events.length,
            latestSequence: this.stream.latestSequence(),
            replayGap: afterSequence > 0 && afterSequence < earliestSequence - 1,
          });
        },
      );
    } catch (error) {
      client.emit('telemetry:error', {
        code:
          error instanceof ServiceUnavailableException
            ? 'SESSION_STORE_UNAVAILABLE'
            : error instanceof Error && error.message === 'PERMISSION_DENIED'
            ? 'PERMISSION_DENIED'
            : 'SESSION_INVALID',
      });
      client.disconnect(true);
    }
  }

  private subscription(principal: AuthPrincipal, request: SubscriptionRequest): SocketSubscription {
    const allowedAreas = principal.dataScope === 'all' ? undefined : principal.areaIds;
    const requestedAreas = Array.isArray(request.areaIds)
      ? request.areaIds.filter(isString)
      : undefined;
    const sources = Array.isArray(request.sources)
      ? request.sources.filter((source): source is TelemetrySource =>
          ['GDS', 'VOC', 'MES'].includes(source),
        )
      : undefined;
    return {
      principal,
      sources: sources?.length ? sources : undefined,
      areaIds: allowedAreas
        ? requestedAreas?.length
          ? requestedAreas.filter((areaId) => allowedAreas.includes(areaId))
          : allowedAreas
        : requestedAreas?.length
          ? requestedAreas
          : undefined,
    };
  }

  private broadcast(event: TelemetryStreamEvent) {
    this.server.sockets.forEach((client) => {
      const subscription = client.data.subscription as SocketSubscription | undefined;
      if (subscription && matches(subscription, event)) client.emit('telemetry:sample', event);
    });
  }
}
