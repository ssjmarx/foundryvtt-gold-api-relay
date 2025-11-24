# Foundry VTT Gold API
Join the [discord](https://discord.gg/U634xNGRAC) server for updates, questions, and discussions

## 📝 About This Fork

This is a **fork** of the original [ThreeHats/foundryvtt-rest-api-relay](https://github.com/ThreeHats/foundryvtt-rest-api-relay) repository, specifically enhanced for **The Gold Box** project.

### 🎯 Our Enhancements

This fork includes all the functionality of the original relay server **PLUS** additional chat API endpoints designed specifically for AI-powered TTRPG assistance:

#### ✅ New Chat API Endpoints

**POST /chat** - Send chat messages to Foundry VTT
- Send messages as any speaker (players, NPCs, AI assistants)
- Support for in-character (IC) and out-of-character (OOC) messages
- Whisper and blind message support
- Dice roll integration with Foundry's chat system
- Full validation and authentication

**GET /chat/messages** - Retrieve chat history
- Filter by user, message type, or time range
- Search capabilities within chat content
- Pagination and sorting options
- Real-time WebSocket message delivery

#### 🔧 Technical Enhancements
- **WebSocket Integration**: Chat messages automatically delivered via Foundry's WebSocket system
- **Message Validation**: Comprehensive input validation for all chat parameters
- **Error Handling**: Proper HTTP status codes and error responses
- **TypeScript Support**: Full type safety for all new endpoints

---

## 📚 Original Project Information

This project consists of two main components:

- **Original Relay Server**: [ThreeHats/foundryvtt-rest-api-relay](https://github.com/ThreeHats/foundryvtt-rest-api-relay)
- **Original Foundry Module**: [ThreeHats/foundryvtt-rest-api](https://github.com/ThreeHats/foundryvtt-rest-api)

### Core Features (from Original)
- WebSocket relay to connect Foundry clients with external applications
- REST API endpoints for searching Foundry content and retrieving entity data
- Client management for tracking Foundry connections
- Data storage and search results
- Integration with Foundry's QuickInsert for powerful search capabilities

---

## 🚀 Installation

### Using Docker Compose (Recommended)
The easiest way to run the relay server:

```bash
# Clone this fork
git clone https://github.com/ssjmarx/foundryvtt-gold-api.git
cd foundryvtt-gold-api

# Start server
docker-compose up -d

# To stop server
docker-compose down
```

The server will be available at http://localhost:3010 and will automatically restart unless manually stopped.

### Manual Installation
```bash
### Install dependencies
pnpm install

### Run in development mode
PORT=3010 pnpm dev

### Build for production
pnpm build

### Start production server
pnpm local
```

## ⚙️ Configuration

The server can be configured using environment variables:

- `PORT`: The port server listens on (default: `3010`)
- `NODE_ENV`: Set to `production` for production deployments
- `WEBSOCKET_PING_INTERVAL_MS`: WebSocket ping interval (default: `20000`)
- `CLIENT_CLEANUP_INTERVAL_MS`: Client cleanup interval (default: `15000`)
- `REDIS_URL`: Redis connection URL (optional, for multi-instance deployments)

## 📖 API Documentation

### New Chat Endpoints

#### POST /chat
Send a chat message to Foundry VTT.

```bash
curl -X POST http://localhost:3010/chat \
  -H "Content-Type: application/json" \
  -H "x-api-key: YOUR_API_KEY" \
  -d '{
    "clientId": "your-client-id",
    "message": {
      "message": "Hello from API!",
      "speaker": "AI Assistant",
      "type": "ic",
      "whisper": ["Player1"],
      "blind": ["GM"],
      "rollData": {...}
    }
  }'
```

#### GET /chat/messages
Retrieve chat history with filtering options.

```bash
curl -X GET "http://localhost:3010/chat/messages?clientId=your-id&limit=10&type=ic" \
  -H "x-api-key: YOUR_API_KEY"
```

### Original Endpoints
All original endpoints from the ThreeHats relay server are fully documented in the [original wiki](https://github.com/ThreeHats/foundryvtt-rest-api/wiki).

---

## 🔧 Development

### Documentation System
This project uses TypeDoc and Docusaurus for comprehensive API documentation:

```bash
# Install documentation dependencies
pnpm docs:install

# Generate API documentation from TypeScript source
pnpm docs:generate

# Start documentation development server
pnpm docs:dev
```

The documentation will be available at [http://localhost:3000](http://localhost:3000).

### Building for Production
```bash
# Build static documentation files
pnpm docs:build

# Serve the built documentation
pnpm docs:serve
```

## 🎯 Use with The Gold Box

This fork is specifically designed to work with **The Gold Box** - an AI-powered Foundry VTT module:

1. **Install Gold Box**: [Latest Release](https://github.com/ssjmarx/Gold-Box/releases/latest)
2. **Configure Backend**: Set up API keys and AI providers
3. **Start Relay Server**: `./backend.sh` (includes this chat-enhanced relay)
4. **Enjoy AI Chat**: Full AI-powered TTRPG assistance with Foundry integration

## 🤝 Contributing

### For Gold Box Development
- Fork this repository: [ssjmarx/foundryvtt-gold-api](https://github.com/ssjmarx/foundryvtt-gold-api)
- Make your enhancements for AI chat functionality
- Submit pull requests to improve the Gold Box experience

### For Original Project
- Original issues and discussions: [ThreeHats/foundryvtt-rest-api-relay](https://github.com/ThreeHats/foundryvtt-rest-api-relay)
- Original roadmap: [ThreeHats Project Board](https://github.com/users/ThreeHats/projects/7)

## 📄 License

This fork maintains the same license as the original project. See [LICENSE](LICENSE) for details.

## 🙏 Acknowledgments

- **ThreeHats**: For creating the original Foundry REST API relay server
- **Foundry VTT Community**: For the amazing ecosystem and feedback
- **Contributors**: Everyone who has helped improve this project

---

**Original Project**: [ThreeHats/foundryvtt-rest-api-relay](https://github.com/ThreeHats/foundryvtt-rest-api-relay)  
**Gold Box Fork**: [ssjmarx/foundryvtt-gold-api](https://github.com/ssjmarx/foundryvtt-gold-api)  
**Main Project**: [ssjmarx/Gold-Box](https://github.com/ssjmarx/Gold-Box)
