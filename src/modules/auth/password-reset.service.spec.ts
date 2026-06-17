import { PasswordResetService } from './password-reset.service';

describe('PasswordResetService', () => {
  const prisma = {
    user: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    passwordResetToken: {
      updateMany: jest.fn(),
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn((ops) => Promise.all(ops)),
  };

  const config = {
    get: jest.fn((key: string, defaultValue?: string) => {
      if (key === 'PASSWORD_RESET_EXPIRATION_MINUTES') return '60';
      if (key === 'FRONT_APP_URL') return 'http://localhost:3001';
      return defaultValue;
    }),
  };

  const mail = {
    send: jest.fn().mockResolvedValue({ sent: true }),
  };

  let service: PasswordResetService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new PasswordResetService(
      prisma as any,
      config as any,
      mail as any,
    );
  });

  it('returns generic message when email is unknown', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    const result = await service.forgotPassword({ email: 'unknown@test.com' });

    expect(result.message).toContain('If an account exists');
    expect(mail.send).not.toHaveBeenCalled();
  });

  it('creates token and sends email for active user', async () => {
    prisma.user.findFirst.mockResolvedValue({
      id: 'user-1',
      email: 'john@test.com',
      firstName: 'John',
      isActive: true,
    });

    const result = await service.forgotPassword({ email: 'john@test.com' });

    expect(result.message).toContain('If an account exists');
    expect(prisma.passwordResetToken.create).toHaveBeenCalled();
    expect(mail.send).toHaveBeenCalled();
  });

  it('rejects invalid reset token', async () => {
    prisma.passwordResetToken.findFirst.mockResolvedValue(null);

    await expect(
      service.resetPassword({ token: 'bad-token', password: 'NewPass123' }),
    ).rejects.toThrow('Invalid or expired reset token');
  });
});
