const { loginHandler, wechatLoginHandler, refreshToken, logout, getCurrentUser, userByOpenIdHandler } = require('../../../src/controllers/authController');
const { User, Role, AuditLog } = require('../../../src/models');
const { login: wechatLogin } = require('../../../src/config/wechat');
const { generateToken } = require('../../../src/utils/jwt');
const { comparePassword } = require('../../../src/utils/password');
const { HTTP_STATUS } = require('../../../src/utils/constants');

// Mock dependencies
jest.mock('../../../src/models');
jest.mock('../../../src/config/wechat');
jest.mock('../../../src/utils/jwt');
jest.mock('../../../src/utils/password');
jest.mock('../../../src/utils/logger');

describe('AuthController', () => {
  let req, res;

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Setup request and response mocks
    req = {
      body: {},
      user: {},
      ip: '127.0.0.1',
      get: jest.fn().mockReturnValue('test-user-agent'),
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
  });

  describe('loginHandler', () => {
    it('should return 400 if username or password is missing', async () => {
      req.body = { username: '', password: '' };

      await loginHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST);
      expect(res.json).toHaveBeenCalledWith({
        message: '用户名和密码不能为空',
      });
    });

    it('should return 401 if user not found', async () => {
      req.body = { username: 'testuser', password: 'password123' };
      User.findOne = jest.fn().mockResolvedValue(null);

      await loginHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.UNAUTHORIZED);
      expect(res.json).toHaveBeenCalledWith({
        message: '用户名或密码错误',
      });
    });

    it('should return 403 if user is inactive', async () => {
      req.body = { username: 'testuser', password: 'password123' };
      const mockUser = {
        id: 1,
        active: false,
        contact_phone: 'testuser',
      };
      User.findOne = jest.fn().mockResolvedValue(mockUser);

      await loginHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN);
      expect(res.json).toHaveBeenCalledWith({
        message: '账号已被禁用，请联系管理员',
      });
    });

    it('should return 401 if password is invalid', async () => {
      req.body = { username: 'testuser', password: 'wrongpassword' };
      const mockUser = {
        id: 1,
        active: true,
        password_hash: 'hashedpassword',
        contact_phone: 'testuser',
      };
      User.findOne = jest.fn().mockResolvedValue(mockUser);
      comparePassword.mockResolvedValue(false);

      await loginHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.UNAUTHORIZED);
      expect(res.json).toHaveBeenCalledWith({
        message: '用户名或密码错误',
      });
    });

    it('should return 200 and token if login successful', async () => {
      req.body = { username: 'testuser', password: 'password123' };
      const mockRole = {
        id: 4,
        name: 'property_staff',
        display_name: '物业员工',
        permissions_json: { canSubmit: true },
      };
      const mockUser = {
        id: 1,
        name: 'Test User',
        active: true,
        password_hash: 'hashedpassword',
        contact_phone: 'testuser',
        role_id: 4,
        role: mockRole,
        department: 'IT',
        last_login_at: null,
        update: jest.fn().mockResolvedValue(true),
      };

      User.findOne = jest.fn().mockResolvedValue(mockUser);
      comparePassword.mockResolvedValue(true);
      generateToken.mockReturnValue('mock-jwt-token');
      AuditLog.create = jest.fn().mockResolvedValue({});

      await loginHandler(req, res);

      expect(mockUser.update).toHaveBeenCalledWith({
        last_login_at: expect.any(Date),
      });
      expect(generateToken).toHaveBeenCalledWith({
        userId: 1,
        roleId: 4,
      });
      expect(AuditLog.create).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'mock-jwt-token',
          user: expect.objectContaining({
            id: 1,
            name: 'Test User',
          }),
        })
      );
    });
  });

  describe('wechatLoginHandler', () => {
    it('should return 400 if code is missing', async () => {
      req.body = {};

      await wechatLoginHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'WeChat login code is required',
          code: 'CODE_REQUIRED',
        },
      });
    });

    it('should return 401 if WeChat API fails', async () => {
      req.body = { code: 'invalid-code' };
      wechatLogin.mockRejectedValue(new Error('WeChat API error'));

      await wechatLoginHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.UNAUTHORIZED);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'WeChat login failed. Please try again.',
          code: 'WECHAT_LOGIN_FAILED',
        },
      });
    });

    it('should create new user if openid not found', async () => {
      req.body = { code: 'valid-code', userInfo: { nickName: 'WeChat User' } };
      wechatLogin.mockResolvedValue({
        openid: 'test-openid',
        session_key: 'test-session-key',
      });

      const mockRole = {
        id: 4,
        name: 'property_staff',
        display_name: '物业员工',
        permissions_json: { canSubmit: true },
      };

      const mockNewUser = {
        id: 1,
        name: 'WeChat User',
        role_id: 4,
        wechat_openid: 'test-openid',
        active: true,
        last_login_at: expect.any(Date),
      };

      User.findOne = jest.fn().mockResolvedValue(null);
      User.create = jest.fn().mockResolvedValue(mockNewUser);
      User.findByPk = jest.fn().mockResolvedValue({
        ...mockNewUser,
        role: mockRole,
      });
      generateToken.mockReturnValue('mock-jwt-token');
      AuditLog.create = jest.fn().mockResolvedValue({});

      await wechatLoginHandler(req, res);

      expect(User.create).toHaveBeenCalledWith({
        wechat_openid: 'test-openid',
        name: 'WeChat User',
        role_id: 4,
        active: true,
        last_login_at: expect.any(Date),
      });
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          token: 'mock-jwt-token',
        }),
      });
    });

    it('should return 403 if existing user is inactive', async () => {
      req.body = { code: 'valid-code' };
      wechatLogin.mockResolvedValue({
        openid: 'test-openid',
        session_key: 'test-session-key',
      });

      const mockInactiveUser = {
        id: 1,
        active: false,
        wechat_openid: 'test-openid',
      };

      User.findOne = jest.fn().mockResolvedValue(mockInactiveUser);

      await wechatLoginHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'Your account has been deactivated. Please contact administrator.',
          code: 'USER_INACTIVE',
        },
      });
    });

    it('should login existing active user', async () => {
      req.body = { code: 'valid-code' };
      wechatLogin.mockResolvedValue({
        openid: 'test-openid',
        session_key: 'test-session-key',
      });

      const mockRole = {
        id: 4,
        name: 'property_staff',
        display_name: '物业员工',
        permissions_json: { canSubmit: true },
      };

      const mockUser = {
        id: 1,
        name: 'Existing User',
        active: true,
        wechat_openid: 'test-openid',
        role_id: 4,
        role: mockRole,
        update: jest.fn().mockResolvedValue(true),
      };

      User.findOne = jest.fn().mockResolvedValue(mockUser);
      generateToken.mockReturnValue('mock-jwt-token');
      AuditLog.create = jest.fn().mockResolvedValue({});

      await wechatLoginHandler(req, res);

      expect(mockUser.update).toHaveBeenCalledWith({
        last_login_at: expect.any(Date),
      });
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          token: 'mock-jwt-token',
          user: expect.objectContaining({
            id: 1,
            name: 'Existing User',
          }),
        }),
      });
    });
  });

  describe('refreshToken', () => {
    it('should return 403 if user is inactive', async () => {
      req.user = { id: 1, active: false };

      await refreshToken(req, res);

      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'User account is inactive',
          code: 'USER_INACTIVE',
        },
      });
    });

    it('should generate new token for active user', async () => {
      req.user = {
        id: 1,
        active: true,
        role_id: 4,
        wechat_openid: 'test-openid',
      };

      generateToken.mockReturnValue('new-mock-jwt-token');

      await refreshToken(req, res);

      expect(generateToken).toHaveBeenCalledWith({
        userId: 1,
        roleId: 4,
        openid: 'test-openid',
      });
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          token: 'new-mock-jwt-token',
          expiresIn: expect.any(String),
        },
      });
    });
  });

  describe('logout', () => {
    it('should log logout event and return success', async () => {
      req.user = { id: 1, name: 'Test User' };
      AuditLog.create = jest.fn().mockResolvedValue({});

      await logout(req, res);

      expect(AuditLog.create).toHaveBeenCalledWith(
        expect.objectContaining({
          user_id: 1,
          action: expect.any(String),
          resource_type: 'auth',
        })
      );
      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logged out successfully',
      });
    });
  });

  describe('getCurrentUser', () => {
    it('should return 404 if user not found', async () => {
      req.user = { id: 1 };
      User.findByPk = jest.fn().mockResolvedValue(null);

      await getCurrentUser(req, res);

      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.NOT_FOUND);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'User not found',
          code: 'USER_NOT_FOUND',
        },
      });
    });

    it('should return 403 if user is inactive', async () => {
      req.user = { id: 1 };
      const mockUser = {
        id: 1,
        active: false,
      };
      User.findByPk = jest.fn().mockResolvedValue(mockUser);

      await getCurrentUser(req, res);

      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.FORBIDDEN);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        error: {
          message: 'User account is inactive',
          code: 'USER_INACTIVE',
        },
      });
    });

    it('should return user data for active user', async () => {
      req.user = { id: 1 };
      const mockRole = {
        id: 4,
        name: 'property_staff',
        display_name: '物业员工',
        permissions_json: { canSubmit: true },
      };
      const mockUser = {
        id: 1,
        name: 'Test User',
        active: true,
        role_id: 4,
        role: mockRole,
        contact_phone: '1234567890',
        department: 'IT',
        supervisor: null,
        last_login_at: new Date(),
        created_at: new Date(),
      };

      User.findByPk = jest.fn().mockResolvedValue(mockUser);

      await getCurrentUser(req, res);

      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.OK);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          user: expect.objectContaining({
            id: 1,
            name: 'Test User',
            role: expect.objectContaining({
              name: 'property_staff',
            }),
          }),
        },
      });
    });
  });

  describe('userByOpenIdHandler', () => {
    it('should return 400 if openid is missing', async () => {
      req.body = {};

      await userByOpenIdHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.BAD_REQUEST);
      expect(res.json).toHaveBeenCalledWith({
        message: 'WeChat openid is required',
      });
    });

    it('should create new user if openid not found', async () => {
      req.body = { openid: 'test-openid' };
      const mockRole = {
        id: 4,
        name: 'property_staff',
        display_name: '物业员工',
        permissions_json: { canSubmit: true },
      };

      User.findOne = jest.fn().mockResolvedValue(null);
      User.create = jest.fn().mockResolvedValue({
        id: 1,
        wechat_openid: 'test-openid',
      });
      User.findByPk = jest.fn().mockResolvedValue({
        id: 1,
        name: '微信用户',
        role_id: 4,
        active: true,
        role: mockRole,
      });
      generateToken.mockReturnValue('mock-jwt-token');
      AuditLog.create = jest.fn().mockResolvedValue({});

      await userByOpenIdHandler(req, res);

      expect(User.create).toHaveBeenCalledWith({
        wechat_openid: 'test-openid',
        name: '微信用户',
        role_id: 4,
        active: true,
        last_login_at: expect.any(Date),
      });
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          token: 'mock-jwt-token',
          user: expect.any(Object),
        })
      );
    });

    it('should return 401 if existing user is inactive', async () => {
      req.body = { openid: 'test-openid' };
      const mockUser = {
        id: 1,
        active: false,
        wechat_openid: 'test-openid',
        update: jest.fn(),
      };

      User.findOne = jest.fn().mockResolvedValue(mockUser);

      await userByOpenIdHandler(req, res);

      expect(res.status).toHaveBeenCalledWith(HTTP_STATUS.UNAUTHORIZED);
      expect(res.json).toHaveBeenCalledWith({
        message: '账号已被禁用，请联系管理员',
      });
    });
  });
});
