import { UserInvitationService } from './user-invitation.service';

describe('UserInvitationService', () => {
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'FRONT_APP_URL') return 'http://localhost:3001';
      if (key === 'DEFAULT_USER_PASSWORD') return 'password1234';
      return undefined;
    }),
  };

  const mail = {
    send: jest.fn().mockResolvedValue({ sent: true }),
  };

  const passwordReset = {
    issueResetToken: jest.fn().mockResolvedValue('raw-token'),
    getResetUrl: jest
      .fn()
      .mockReturnValue('http://localhost:3001/reset-password?token=raw-token'),
  };

  let service: UserInvitationService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new UserInvitationService(
      config as any,
      mail as any,
      passwordReset as any,
    );
  });

  it('uses default password when env is unset', () => {
    const bareConfig = { get: jest.fn().mockReturnValue(undefined) };
    const bareService = new UserInvitationService(
      bareConfig as any,
      mail as any,
      passwordReset as any,
    );

    expect(bareService.resolveDefaultPassword()).toBe('password1234');
  });

  it('sends invitation with temporary password by default', async () => {
    const result = await service.sendNewUserInvitation({
      user: { id: 'user-1', email: 'john@test.com', firstName: 'John' },
      tenantName: 'Acme',
      initialPassword: 'password1234',
      requestPasswordReset: false,
    });

    expect(result.sent).toBe(true);
    expect(result.passwordResetRequested).toBe(false);
    expect(passwordReset.issueResetToken).not.toHaveBeenCalled();
    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'john@test.com',
        text: expect.stringContaining('password1234'),
      }),
    );
  });

  it('sends invitation with reset link when requested', async () => {
    const result = await service.sendNewUserInvitation({
      user: { id: 'user-1', email: 'john@test.com', firstName: 'John' },
      tenantName: 'Acme',
      initialPassword: 'password1234',
      requestPasswordReset: true,
    });

    expect(result.sent).toBe(true);
    expect(result.passwordResetRequested).toBe(true);
    expect(passwordReset.issueResetToken).toHaveBeenCalledWith('user-1');
    expect(mail.send).toHaveBeenCalledWith(
      expect.objectContaining({
        text: expect.stringContaining('reset-password'),
      }),
    );
  });
});
