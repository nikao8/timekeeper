import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';
import { AppConfigService } from '../config/app-config.service';
import type { JwtPayload } from '../auth/strategies/jwt.strategy';

type SocketAuthData = {
  userId?: string;
  employeeId?: string;
};

@WebSocketGateway({
  cors: { origin: true, credentials: true },
  namespace: '/events',
})
export class EventsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(EventsGateway.name);

  constructor(
    private readonly jwt: JwtService,
    private readonly config: AppConfigService,
  ) {}

  async handleConnection(client: Socket): Promise<void> {
    try {
      const token =
        (client.handshake.auth?.token as string | undefined) ??
        client.handshake.headers.authorization?.replace('Bearer ', '');
      if (!token) {
        client.disconnect();
        return;
      }
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.jwtSecret,
      });
      const data = client.data as SocketAuthData;
      data.userId = payload.sub;
      data.employeeId = payload.employeeId;
      await client.join(`user:${payload.sub}`);
      await client.join(`employee:${payload.employeeId}`);
      this.logger.debug(`WS connected ${payload.email}`);
    } catch {
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.debug(`WS disconnected ${client.id}`);
  }

  @SubscribeMessage('join-team')
  handleJoinTeam(@ConnectedSocket() client: Socket, @MessageBody() managerEmployeeId: string) {
    const data = client.data as SocketAuthData;
    if (data.employeeId === managerEmployeeId) {
      void client.join(`team:${managerEmployeeId}`);
    }
  }

  emitNotification(userId: string, payload: unknown): void {
    this.server.to(`user:${userId}`).emit('notification', payload);
  }

  emitTeamEvent(managerEmployeeId: string, payload: unknown): void {
    this.server.to(`team:${managerEmployeeId}`).emit('team-event', payload);
    this.server.to(`employee:${managerEmployeeId}`).emit('team-event', payload);
  }

  emitEmployeeUpdate(employeeId: string, payload: unknown): void {
    this.server.to(`employee:${employeeId}`).emit('time-clock', payload);
  }
}
