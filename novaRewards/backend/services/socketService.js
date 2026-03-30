const { Server } = require('socket.io');
const { verifyToken } = require('./tokenService');

let io = null;

/**
 * Initialise Socket.IO on the given HTTP server.
 * Call once from server.js after creating the http.Server.
 */
function initSocketIO(httpServer, corsOptions) {
  io = new Server(httpServer, {
    cors: corsOptions,
    path: '/socket.io',
  });

  // JWT handshake authentication
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) return next(new Error('Authentication required'));

    try {
      const decoded = verifyToken(token);
      if (!decoded?.userId) return next(new Error('Invalid token'));
      socket.userId = decoded.userId;
      next();
    } catch {
      next(new Error('Invalid or expired token'));
    }
  });

  io.on('connection', (socket) => {
    // Each user joins their own private room so we can target them
    socket.join(`user:${socket.userId}`);

    socket.on('disconnect', () => {
      socket.leave(`user:${socket.userId}`);
    });
  });

  return io;
}

/**
 * Emit a notification to a specific user.
 * @param {number|string} userId
 * @param {{ type: string, message: string, createdAt: string }} notification
 */
function emitNotification(userId, notification) {
  if (!io) return;
  io.to(`user:${userId}`).emit('notification', notification);
}

function getIO() {
  return io;
}

module.exports = { initSocketIO, emitNotification, getIO };
