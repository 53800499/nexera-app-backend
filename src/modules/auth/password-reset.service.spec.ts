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

  it('rejects unknown email with an explicit helpful message', async () => {
    prisma.user.findFirst.mockResolvedValue(null);

    await expect(
      service.forgotPassword({ email: 'unknown@test.com' }),
    ).rejects.toThrow("Aucun compte Nexera n'est associé à l'adresse e-mail");
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

    expect(result.message).toContain('Un e-mail de réinitialisation a été envoyé');
    expect(prisma.passwordResetToken.create).toHaveBeenCalled();
    expect(mail.send).toHaveBeenCalled();
  });

  it('rejects invalid reset token', async () => {
    prisma.passwordResetToken.findFirst.mockResolvedValue(null);

    await expect(
      service.resetPassword({ token: 'bad-token', password: 'NewPass123' }),
    ).rejects.toThrow('invalide ou a expiré');
  });
});
