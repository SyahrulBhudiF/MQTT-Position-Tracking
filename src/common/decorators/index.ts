import { type ExecutionContext, SetMetadata, createParamDecorator } from '@nestjs/common';
import type { Socket } from 'socket.io';

/**
 * Metadata key for public routes (no authentication required)
 */
export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator to mark a route as public (no authentication required)
 *
 * @example
 * @Public()
 * @Get('/health')
 * healthCheck() {
 *   return { status: 'ok' };
 * }
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);

/**
 * Metadata key for roles
 */
export const ROLES_KEY = 'roles';

/**
 * Decorator to specify required roles for a route
 *
 * @example
 * @Roles('admin', 'moderator')
 * @Get('/users')
 * getUsers() {
 *   return this.userService.findAll();
 * }
 */
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);

/**
 * Parameter decorator to extract the current user from the request
 *
 * @example
 * @Get('/profile')
 * getProfile(@CurrentUser() user: User) {
 *   return user;
 * }
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (data) {
      return user?.[data];
    }

    return user;
  },
);

/**
 * Parameter decorator to extract the client IP address
 *
 * @example
 * @Get('/info')
 * getInfo(@ClientIp() ip: string) {
 *   return { ip };
 * }
 */
export const ClientIp = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();

  // Check for forwarded IP (behind proxy)
  const forwardedFor = request.headers['x-forwarded-for'];
  if (forwardedFor) {
    const ips = forwardedFor.split(',');
    return ips[0].trim();
  }

  // Check for real IP header
  const realIp = request.headers['x-real-ip'];
  if (realIp) {
    return realIp;
  }

  // Fall back to socket address
  return request.ip || request.connection?.remoteAddress;
});

/**
 * Parameter decorator to extract the correlation ID from the request
 *
 * @example
 * @Get('/data')
 * getData(@CorrelationId() correlationId: string) {
 *   this.logger.log(`Processing request ${correlationId}`);
 *   return { correlationId };
 * }
 */
export const CorrelationId = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.headers['x-correlation-id'] || request.headers['x-request-id'];
});

/**
 * Parameter decorator for WebSocket client extraction
 *
 * @example
 * @SubscribeMessage('message')
 * handleMessage(@WsClient() client: Socket) {
 *   return { clientId: client.id };
 * }
 */
export const WsClient = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToWs().getClient<Socket>();
});

/**
 * Parameter decorator to extract data from WebSocket message
 *
 * @example
 * @SubscribeMessage('update')
 * handleUpdate(@WsData() data: UpdateDto) {
 *   return this.service.update(data);
 * }
 */
export const WsData = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  return ctx.switchToWs().getData();
});

/**
 * Parameter decorator to extract a specific field from WebSocket data
 *
 * @example
 * @SubscribeMessage('join')
 * handleJoin(@WsDataField('roomId') roomId: string) {
 *   return this.service.joinRoom(roomId);
 * }
 */
export const WsDataField = createParamDecorator((field: string, ctx: ExecutionContext) => {
  const data = ctx.switchToWs().getData();
  return data?.[field];
});

/**
 * Metadata key for race ID parameter name
 */
export const RACE_ID_KEY = 'raceId';

/**
 * Decorator to mark a parameter as containing the race ID
 *
 * @example
 * @Get(':raceId/positions')
 * getPositions(@RaceId() raceId: string) {
 *   return this.trackingService.getRacePositions(raceId);
 * }
 */
export const RaceId = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.params?.raceId || request.query?.raceId || request.body?.raceId;
});

/**
 * Metadata key for participant ID parameter name
 */
export const PARTICIPANT_ID_KEY = 'participantId';

/**
 * Decorator to mark a parameter as containing the participant ID
 *
 * @example
 * @Get(':raceId/participants/:participantId')
 * getParticipant(@ParticipantId() participantId: string) {
 *   return this.trackingService.getParticipant(participantId);
 * }
 */
export const ParticipantId = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return (
    request.params?.participantId || request.query?.participantId || request.body?.participantId
  );
});
