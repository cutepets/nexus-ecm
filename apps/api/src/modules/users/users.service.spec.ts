import { UsersService } from './users.service';
import { PrismaService } from '../../core/prisma/prisma.service';

const user = {
  id: 'user-1',
  email: 'admin@gmail.com',
  passwordHash: 'hash',
  fullName: 'Admin',
  avatarUrl: null,
  isActive: true,
  roles: [],
  employee: null,
};

describe('UsersService.findByLoginIdentifier', () => {
  const findUnique = jest.fn();
  const findFirst = jest.fn();
  const service = new UsersService(
    { user: { findUnique, findFirst } } as unknown as PrismaService,
    { record: jest.fn() } as never,
    {} as never,
  );

  beforeEach(() => jest.resetAllMocks());

  it('finds email case-insensitively', async () => {
    findFirst.mockResolvedValue(user);

    const result = await service.findByLoginIdentifier(' Admin@Gmail.Com ');

    expect(result?.id).toBe(user.id);
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: { email: { equals: 'admin@gmail.com', mode: 'insensitive' } } }),
    );
  });

  it('finds a Vietnamese phone after normalization', async () => {
    findUnique.mockResolvedValueOnce(user).mockResolvedValueOnce(null);

    const result = await service.findByLoginIdentifier('0901234567');

    expect(result?.id).toBe(user.id);
    expect(findUnique).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: { phone: '+84901234567' } }));
  });

  it('rejects a phone-shaped identifier that refers to two accounts', async () => {
    findUnique.mockResolvedValueOnce(user).mockResolvedValueOnce({ ...user, id: 'user-2' });

    await expect(service.findByLoginIdentifier('0901234567')).resolves.toBeNull();
  });

  it('finds username case-insensitively', async () => {
    findUnique.mockResolvedValue(user);

    const result = await service.findByLoginIdentifier('Nguyen.Van_A');

    expect(result?.id).toBe(user.id);
    expect(findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { username: 'nguyen.van_a' } }));
  });
});
