import {
  register,
  login,
  logout,
  getMe,
  updateMe,
  changePassword,
  setTokenCookie,
  clearTokenCookie,
} from '../services/auth.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ApiError } from '../utils/ApiError.js';

export const registerController = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const { user, accessToken } = await register({ name, email, password });
  setTokenCookie(res, accessToken);
  res.status(201).json({ data: { user, accessToken } });
});

export const loginController = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const { user, accessToken } = await login({ email, password });
  setTokenCookie(res, accessToken);
  res.json({ data: { user, accessToken } });
});

export const logoutController = asyncHandler(async (_req, res) => {
  await logout();
  clearTokenCookie(res);
  res.json({ data: { success: true } });
});

export const meController = asyncHandler(async (req, res) => {
  const user = await getMe(req.user._id);
  res.json({ data: { user } });
});

export const updateMeController = asyncHandler(async (req, res) => {
  const user = await updateMe(req.user._id, req.body);
  res.json({ data: { user } });
});

export const changePasswordController = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) {
    throw ApiError.badRequest('Current password and new password are required');
  }
  if (newPassword.length < 8) {
    throw ApiError.badRequest('New password must be at least 8 characters');
  }
  await changePassword(req.user._id, { currentPassword, newPassword });
  res.json({ data: { success: true } });
});