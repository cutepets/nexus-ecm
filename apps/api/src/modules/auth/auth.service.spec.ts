import { createHash } from 'node:crypto';
import { AuthService } from './auth.service';

describe('AuthService.logout', () => {
  const refreshToken = 'refresh-token-for-session-a';
  const userId = 'authenticated-user';

  function createService() {
    const prisma = {
      refreshToken: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
      auditLog: { create: jest.fn().mockResolvedValue({}) },
    };
    const service = new AuthService({} as never, prisma as never, {} as never, {} as never, {} as never);
    return { service, prisma };
  }

  it('revokes only a refresh token belonging to the authenticated user', async () => {
    const { service, prisma } = createService();

    await service.logout(refreshToken, userId, { ip: '127.0.0.1', ua: 'jest' });

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: {
        tokenHash: createHash('sha256').update(refreshToken).digest('hex'),
        userId,
        revokedAt: null,
      },
      data: { revokedAt: expect.any(Date) },
    });
  });
});
