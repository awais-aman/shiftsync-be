import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import { Roles } from '@/common/decorators/roles.decorator';
import { RolesGuard } from '@/common/guards/roles.guard';
import { SupabaseJwtGuard } from '@/common/guards/supabase-jwt.guard';
import { RoutePaths } from '@/shared/constants';
import type { AuthenticatedUser } from '@/types/auth';
import { CreateSwapRequestDto } from '@/swaps/dto/create-swap.dto';
import { RejectSwapDto } from '@/swaps/dto/reject-swap.dto';
import { SwapRequestDto } from '@/swaps/dto/swap.dto';
import { SwapsService } from '@/swaps/swaps.service';
import { UserRepository } from '@/database/repositories/user.repository';

class SwapInboxDto {
  outgoing!: SwapRequestDto[];
  incoming!: SwapRequestDto[];
  awaitingApproval!: SwapRequestDto[];
}

@ApiTags('Swaps')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing, invalid, or expired JWT' })
@ApiForbiddenResponse({ description: 'Authenticated but lacks required role' })
@UseGuards(SupabaseJwtGuard, RolesGuard)
@Controller(RoutePaths.SwapRequests)
export class SwapsController {
  constructor(
    private readonly swapsService: SwapsService,
    private readonly userRepository: UserRepository,
  ) {}

  @Get()
  @ApiOperation({
    summary:
      'List swap requests grouped by outgoing (mine), incoming (mine), and awaitingApproval (manager+)',
  })
  @ApiOkResponse({ type: SwapInboxDto })
  async list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SwapInboxDto> {
    // Expire overdue drop requests on every read so the inbox view is fresh.
    await this.swapsService.expireOverdueDrops();
    const profile = await this.userRepository.findProfileById(user.id);
    const role = profile?.role ?? UserRole.staff;
    return this.swapsService.listForUser(user.id, role);
  }

  @Get('open')
  @ApiOperation({
    summary:
      'List open drop requests the staff member is qualified to claim (skill + cert match)',
  })
  @ApiOkResponse({ type: SwapRequestDto, isArray: true })
  listOpen(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SwapRequestDto[]> {
    return this.swapsService.listOpenForStaff(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single swap request' })
  @ApiOkResponse({ type: SwapRequestDto })
  @ApiNotFoundResponse({ description: 'Swap not found' })
  findById(
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<SwapRequestDto> {
    return this.swapsService.findById(id);
  }

  @Post()
  @ApiOperation({
    summary:
      'Create a swap or drop request for one of the requester\'s assignments',
  })
  @ApiCreatedResponse({ type: SwapRequestDto })
  @ApiBadRequestResponse({
    description:
      'Pending-cap exceeded, swap missing peer, shift already started, etc.',
  })
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateSwapRequestDto,
  ): Promise<SwapRequestDto> {
    return this.swapsService.create(user.id, dto);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Requester cancels their own pending request' })
  @ApiOkResponse({ type: SwapRequestDto })
  @ApiConflictResponse({ description: 'Already in a final state' })
  cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<SwapRequestDto> {
    return this.swapsService.cancel(id, user.id);
  }

  @Post(':id/accept')
  @ApiOperation({
    summary: 'Targeted peer accepts a swap request (moves to accepted_by_peer)',
  })
  @ApiOkResponse({ type: SwapRequestDto })
  accept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<SwapRequestDto> {
    return this.swapsService.accept(id, user.id);
  }

  @Post(':id/claim')
  @ApiOperation({
    summary:
      'Staff claims an open drop request (constraint engine must clear them); manager approval still required',
  })
  @ApiOkResponse({ type: SwapRequestDto })
  @ApiBadRequestResponse({
    description: 'Not a pending drop, or constraint engine rejected the claimer',
  })
  @ApiConflictResponse({ description: 'Already claimed by someone else' })
  claim(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<SwapRequestDto> {
    return this.swapsService.claim(id, user.id);
  }

  @Post(':id/approve')
  @Roles(UserRole.admin, UserRole.manager)
  @ApiOperation({
    summary:
      'Manager approves; for swaps, re-runs the constraint engine on the post-swap assignee',
  })
  @ApiOkResponse({ type: SwapRequestDto })
  @ApiBadRequestResponse({
    description:
      'Constraint engine rejected the post-swap assignee, or status is not approvable',
  })
  approve(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
  ): Promise<SwapRequestDto> {
    return this.swapsService.approve(id, user.id);
  }

  @Post(':id/reject')
  @Roles(UserRole.admin, UserRole.manager)
  @ApiOperation({ summary: 'Manager rejects, optionally with reason' })
  @ApiOkResponse({ type: SwapRequestDto })
  reject(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id', new ParseUUIDPipe()) id: string,
    @Body() body: RejectSwapDto,
  ): Promise<SwapRequestDto> {
    return this.swapsService.reject(id, user.id, body.reason);
  }
}
