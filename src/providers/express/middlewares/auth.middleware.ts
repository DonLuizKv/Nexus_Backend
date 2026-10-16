// import { Request, Response, NextFunction } from 'express';
// import { Token } from '../../security/TokenType';
// import { Errors } from '../../../shared/errors/Errors';
// import { verifyToken } from '../../security/jwt.service';
// import { ConfigEnv } from '../../../config/env';

// interface AuthenticatedRequest extends Request {
//     user?: Token;
// }

// const env = new ConfigEnv();

// export const TokenVerification = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
//     const token = req.cookies?.session_token;
//     if (!token) throw Errors.CLIENT.UNAUTHORIZED("Authentication required, please login.");

//     const decoded = verifyToken(token, env.JWT.ACCESS_SECRET);
//     req.user = decoded;
//     next();
// };

// export const RoleVerification = (...roles: string[]) => {
//     return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
//         if (!req.user) {
//             throw Errors.CLIENT.UNAUTHORIZED("Authentication required, please login.");
//         }

//         if (!roles.includes(req.user.role)) {
//             throw Errors.CLIENT.FORBIDDEN("Unauthorized, you don't have permission to access this resource.");
//         }

//         next();
//     };
// };