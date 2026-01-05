/**
 * Generate JWT token for testing
 */
import { generateToken } from './modules/auth/auth.js';

const userId = '00000000-0000-0000-0000-000000000001'; // Test User A
const token = generateToken(userId);

console.log('JWT Token for Test User A:');
console.log(token);
