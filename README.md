# Foundry VTT Gold API Relay

## Original Project
Based on [ThreeHats/foundryvtt-rest-api-relay](https://github.com/ThreeHats/foundryvtt-rest-api-relay)

## New Features

### Chat Endpoints

- **POST /chat** - Send chat messages to Foundry VTT
  - Send messages as any speaker (players, NPCs, AI assistants)
  - Support for in-character (IC) and out-of-character (OOC) messages
  - Whisper and blind message support
  - Dice roll integration with Foundry's chat system
  - Full validation and authentication

- **GET /messages** - Retrieve chat history
  - Filter by user, message type, or time range
  - Search capabilities within chat content
  - Pagination and sorting options
  - Real-time WebSocket message delivery
