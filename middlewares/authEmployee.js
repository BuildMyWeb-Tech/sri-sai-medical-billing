// C:\Users\Siddharathan\Desktop\gocart-ecommerce-full-stack\middlewares\authEmployee.js
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'employee_jwt_secret_kingcart_2024';

export function verifyEmployeeToken(request) {
  try {
    const authHeader = request.headers.get
      ? request.headers.get('authorization') || ''
      : request.headers?.authorization || '';

    const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : null;

    if (!token) return null;

    const decoded = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (err) {
    console.error('verifyEmployeeToken error:', err.message);
    return null;
  }
}

export function hasPermission(employee, permission) {
  if (!employee) return false;
  if (employee.role === 'STORE_OWNER' || employee.role === 'ADMIN') return true;
  return employee.permissions?.[permission] === true;
}

export const JWT_SECRET_KEY = JWT_SECRET;

export default verifyEmployeeToken;