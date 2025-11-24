import { Router } from 'express';
import { requestForwarderMiddleware } from '../../middleware/requestForwarder';
import { authMiddleware, trackApiUsage } from '../../middleware/auth';
import { createApiRoute } from '../route-helpers';

export const chatRouter = Router();

const commonMiddleware = [requestForwarderMiddleware, authMiddleware, trackApiUsage];

/**
 * Send a chat message to Foundry VTT
 * 
 * This endpoint sends a chat message to the Foundry world's chat log.
 * Requires the Foundry module to be installed and connected to the relay server.
 * 
 * @route POST /chat
 * @param {string} clientId - Client ID for the Foundry world
 * @param {object} message - The chat message to send
 * @param {string} message.message - The message content
 * @param {string} message.speaker - The name of the speaker
 * @param {string} message.type - The type of message (ic, ooc, em, etc.)
 * @returns {object} Success response with message details
 */
chatRouter.post("/chat", ...commonMiddleware, createApiRoute({
  type: 'chat',
  requiredParams: [
    { name: 'clientId', from: 'body', type: 'string' }, // Client ID for the Foundry world
    { name: 'message', from: 'body', type: 'object' }, // The complete message object
    { name: 'message.message', from: 'body', type: 'string' }, // Message content
    { name: 'message.speaker', from: 'body', type: 'string' }, // Speaker name
    { name: 'message.type', from: 'body', type: 'string' } // Message type (ic, ooc, em, etc.)
  ],
  optionalParams: [
    { name: 'message.timestamp', from: 'body', type: 'number' }, // Custom timestamp (defaults to current time)
    { name: 'message.whisper', from: 'body', type: 'boolean' }, // Whether this is a whisper message
    { name: 'message.blind', from: 'body', type: 'boolean' }, // Whether this is a blind message (GM only)
    { name: 'message.roll', from: 'body', type: 'object' } // Optional roll data
  ]
}));

/**
 * Get chat messages from Foundry VTT
 * 
 * This endpoint retrieves recent chat messages from the Foundry world's chat log.
 * Requires the Foundry module to be installed and connected to the relay server.
 * 
 * @route GET /chat/messages
 * @returns {object} Chat messages containing content, timestamps, users, etc.
 */
chatRouter.get("/messages", ...commonMiddleware, createApiRoute({
  type: 'chat-messages',
  requiredParams: [
    { name: 'clientId', from: 'query', type: 'string' } // Client ID for the Foundry world
  ],
  optionalParams: [
    { name: 'limit', from: 'query', type: 'number' }, // Maximum number of messages to return (default: 20)
    { name: 'sort', from: 'query', type: 'string' }, // Field to sort by (default: timestamp)
    { name: 'order', from: 'query', type: 'string' }, // Sort order (asc or desc, default: desc)
    { name: 'user', from: 'query', type: 'string' }, // Filter messages by specific user
    { name: 'type', from: 'query', type: 'string' } // Filter messages by type (roll, chat, ooc, etc.)
  ]
}));

export default chatRouter;
