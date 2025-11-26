// FoundryVTT Gold API - Enhanced REST API with chat message support
// Based on foundry-rest-api by ThreeHats, enhanced by ssjmarx

const moduleId = "foundryvtt-gold-api";
const recentRolls = [];
const recentChatMessages = [];
const MAX_ROLLS_STORED = 20;
const MAX_CHAT_MESSAGES_STORED = 100;

// Settings configuration
const SETTINGS = {
    ACTOR_CURRENCY_ATTRIBUTE: "actorCurrencyAttribute",
    WS_RELAY_URL: "wsRelayUrl",
    API_KEY: "apiKey",
    CUSTOM_NAME: "customName",
    LOG_LEVEL: "logLevel",
    PING_INTERVAL: "pingInterval",
    RECONNECT_MAX_ATTEMPTS: "reconnectMaxAttempts",
    RECONNECT_BASE_DELAY: "reconnectBaseDelay",
    CHAT_MESSAGES_LIMIT: "chatMessagesLimit",
    MAX_CHAT_MESSAGES_STORED: "maxChatMessagesStored",
    
    DEFAULTS: () => ({
        [SETTINGS.ACTOR_CURRENCY_ATTRIBUTE]: {
            name: "Actor Currency attribute",
            hint: "Reference path to the actor currency attribute",
            scope: "world",
            config: false,
            default: "",
            type: String
        },
        [SETTINGS.WS_RELAY_URL]: {
            name: "WebSocket Relay URL",
            hint: "URL for the WebSocket relay server",
            scope: "world",
            config: true,
            type: String,
            default: "wss://foundryvtt-rest-api-relay.fly.dev",
            requiresReload: true
        },
        [SETTINGS.API_KEY]: {
            name: "API Key",
            hint: "API Key for authentication with the relay server",
            scope: "world",
            config: true,
            type: String,
            default: game.world.id,
            requiresReload: true
        },
        [SETTINGS.CUSTOM_NAME]: {
            name: "Custom Client Name",
            hint: "A custom name to identify this client (optional)",
            scope: "world",
            config: true,
            type: String,
            default: "",
            requiresReload: true
        },
        [SETTINGS.LOG_LEVEL]: {
            name: "Log Level",
            hint: "Set the level of detail for module logging",
            scope: "world",
            config: true,
            type: Number,
            choices: { 0: "debug", 1: "info", 2: "warn", 3: "error" },
            default: 2
        },
        [SETTINGS.PING_INTERVAL]: {
            name: "Ping Interval (seconds)",
            hint: "How often (in seconds) the module sends a ping to the relay server to keep the connection alive.",
            scope: "world",
            config: true,
            type: Number,
            default: 30,
            range: { min: 5, max: 600, step: 1 },
            requiresReload: true
        },
        [SETTINGS.RECONNECT_MAX_ATTEMPTS]: {
            name: "Max Reconnect Attempts",
            hint: "Maximum number of times the module will try to reconnect after losing connection.",
            scope: "world",
            config: true,
            type: Number,
            default: 20,
            requiresReload: true
        },
        [SETTINGS.RECONNECT_BASE_DELAY]: {
            name: "Reconnect Base Delay (ms)",
            hint: "Initial delay (in milliseconds) before the first reconnect attempt. Subsequent attempts use exponential backoff.",
            scope: "world",
            config: true,
            type: Number,
            default: 1000,
            requiresReload: true
        },
        [SETTINGS.CHAT_MESSAGES_LIMIT]: {
            name: "Default Chat Message Limit",
            hint: "Default number of chat messages to return when requested",
            scope: "world",
            config: true,
            type: Number,
            default: 50,
            range: { min: 1, max: 200, step: 1 }
        },
        [SETTINGS.MAX_CHAT_MESSAGES_STORED]: {
            name: "Max Chat Messages Stored",
            hint: "Maximum number of chat messages to keep in memory",
            scope: "world",
            config: true,
            type: Number,
            default: 100,
            range: { min: 10, max: 500, step: 10 }
        }
    })
};

// Logger utility
class ModuleLogger {
    static debugLevel() {
        return game.settings.get(moduleId, "logLevel");
    }

    static debug(message, ...args) {
        if (this.debugLevel() < 1) console.log(`${moduleId} | ${message}`, ...args);
        return message;
    }

    static info(message, ...args) {
        if (this.debugLevel() < 2) console.log(`${moduleId} | ${message}`, ...args);
        return message;
    }

    static warn(message, ...args) {
        if (this.debugLevel() < 3) console.warn(`${moduleId} | ${message}`, ...args);
        return message;
    }

    static error(message, ...args) {
        if (this.debugLevel() < 4) console.error(`${moduleId} | ${message}`, ...args);
        return message;
    }
}

// WebSocket close codes
const WSCloseCodes = {
    Normal: 1000,
    NoClientId: 4001,
    NoAuth: 4002,
    NoConnectedGuild: 4003,
    InternalError: 4000,
    DuplicateConnection: 4004,
    ServerShutdown: 4005
};

// WebSocket Manager
class WebSocketManager {
    static instance = null;

    constructor(url, token) {
        this.url = url;
        this.token = token;
        this.socket = null;
        this.messageHandlers = new Map();
        this.reconnectTimer = null;
        this.reconnectAttempts = 0;
        this.clientId = `foundry-${game.user?.id || Math.random().toString(36).substring(2, 15)}`;
        this.pingInterval = null;
        this.isConnecting = false;
        this.isPrimaryGM = this.checkIfPrimaryGM();
        
        ModuleLogger.info(`Created WebSocketManager with clientId: ${this.clientId}, isPrimaryGM: ${this.isPrimaryGM}`);
        
        if (game.user?.isGM && game.user?.role === 4) {
            Hooks.on("userConnected", this.reevaluatePrimaryGM.bind(this));
            Hooks.on("userDisconnected", this.reevaluatePrimaryGM.bind(this));
        }
    }

    static getInstance(url, token) {
        if (!game.user?.isGM || game.user?.role !== 4) {
            ModuleLogger.info("WebSocketManager not created - user is not a full GM");
            return null;
        }

        if (!WebSocketManager.instance) {
            ModuleLogger.info("Creating new WebSocketManager instance");
            WebSocketManager.instance = new WebSocketManager(url, token);
        }
        return WebSocketManager.instance;
    }

    checkIfPrimaryGM() {
        if (!game.user?.isGM || game.user?.role !== 4) return false;
        
        const currentUserId = game.user.id;
        const activeGMs = game.users?.filter(u => u.role === 4 && u.active) || [];
        
        if (activeGMs.length === 0) return false;
        
        const sortedGMs = [...activeGMs].sort((a, b) => 
            (a.id || "").localeCompare(b.id || "")
        );
        const isPrimary = sortedGMs[0]?.id === currentUserId;
        
        ModuleLogger.info(`Primary GM check - Current user: ${currentUserId}, Primary GM: ${sortedGMs[0]?.id}, isPrimary: ${isPrimary}`);
        return isPrimary;
    }

    reevaluatePrimaryGM() {
        const wasPrimary = this.isPrimaryGM;
        this.isPrimaryGM = this.checkIfPrimaryGM();
        
        if (wasPrimary !== this.isPrimaryGM) {
            ModuleLogger.info(`Primary GM status changed: ${wasPrimary} -> ${this.isPrimaryGM}`);
            
            if (this.isPrimaryGM && !this.isConnected()) {
                ModuleLogger.info("Taking over as primary GM, connecting WebSocket");
                this.connect();
            } else if (!this.isPrimaryGM && this.isConnected()) {
                ModuleLogger.info("No longer primary GM, disconnecting WebSocket");
                this.disconnect();
            }
        }
    }

    connect() {
        if (!game.user?.isGM || game.user?.role !== 4) {
            ModuleLogger.info("WebSocket connection aborted - user is not a full GM");
            return;
        }

        if (!this.isPrimaryGM) {
            ModuleLogger.info("WebSocket connection aborted - user is not the primary GM");
            return;
        }

        if (this.isConnecting) {
            ModuleLogger.info("Already attempting to connect");
            return;
        }

        if (this.socket && (this.socket.readyState === WebSocket.CONNECTING || this.socket.readyState === WebSocket.OPEN)) {
            ModuleLogger.info("WebSocket already connected or connecting");
            return;
        }

        this.isConnecting = true;

        try {
            const url = new URL(this.url);
            url.searchParams.set("id", this.clientId);
            url.searchParams.set("token", this.token);
            
            if (game.world) {
                url.searchParams.set("worldId", game.world.id);
                url.searchParams.set("worldTitle", game.world.title);
            }
            
            url.searchParams.set("foundryVersion", game.version);
            url.searchParams.set("systemId", game.system.id);
            url.searchParams.set("systemTitle", game.system.title || game.system.id);
            url.searchParams.set("systemVersion", game.system.version || "unknown");

            const customName = game.settings.get(moduleId, "customName");
            if (customName) {
                url.searchParams.set("customName", customName);
            }

            ModuleLogger.info(`Connecting to WebSocket at ${url.toString()}`);
            this.socket = new WebSocket(url.toString());

            const timeout = setTimeout(() => {
                if (this.socket && this.socket.readyState === WebSocket.CONNECTING) {
                    ModuleLogger.error("Connection timed out");
                    this.socket.close();
                    this.socket = null;
                    this.isConnecting = false;
                    this.scheduleReconnect();
                }
            }, 5000);

            this.socket.addEventListener("open", () => {
                clearTimeout(timeout);
                this.onOpen();
            });

            this.socket.addEventListener("close", (event) => {
                clearTimeout(timeout);
                this.onClose(event);
            });

            this.socket.addEventListener("error", (event) => {
                clearTimeout(timeout);
                this.onError(event);
            });

            this.socket.addEventListener("message", this.onMessage.bind(this));

        } catch (error) {
            ModuleLogger.error("Error creating WebSocket:", error);
            this.isConnecting = false;
            this.scheduleReconnect();
        }
    }

    disconnect() {
        if (this.socket) {
            ModuleLogger.info("Disconnecting WebSocket");
            this.socket.close(WSCloseCodes.Normal, "Disconnecting");
            this.socket = null;
        }

        if (this.reconnectTimer !== null) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }

        if (this.pingInterval !== null) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }

        this.reconnectAttempts = 0;
        this.isConnecting = false;
    }

    isConnected() {
        return this.socket !== null && this.socket.readyState === WebSocket.OPEN;
    }

    getClientId() {
        return this.clientId;
    }

    send(data) {
        ModuleLogger.info(`Send called, readyState: ${this.socket?.readyState}`);
        
        if (this.socket && this.socket.readyState === WebSocket.OPEN) {
            try {
                ModuleLogger.info("Sending message:", data);
                this.socket.send(JSON.stringify(data));
                return true;
            } catch (error) {
                ModuleLogger.error("Error sending message:", error);
                return false;
            }
        } else {
            ModuleLogger.warn(`WebSocket not ready, state: ${this.socket?.readyState}`);
            return false;
        }
    }

    onMessageType(type, handler) {
        this.messageHandlers.set(type, handler);
    }

    onOpen() {
        ModuleLogger.info("WebSocket connected");
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.send({ type: "ping" });

        const pingInterval = game.settings.get(moduleId, SETTINGS.PING_INTERVAL);
        const intervalMs = pingInterval * 1000;
        
        ModuleLogger.info(`Starting application ping interval: ${pingInterval} seconds`);
        
        if (this.pingInterval !== null) {
            clearInterval(this.pingInterval);
        }
        
        this.pingInterval = setInterval(() => {
            if (this.isConnected()) {
                this.send({ type: "ping" });
            }
        }, intervalMs);
    }

    onClose(event) {
        ModuleLogger.info(`WebSocket disconnected: ${event.code} - ${event.reason}`);
        this.socket = null;
        this.isConnecting = false;

        if (this.pingInterval !== null) {
            clearInterval(this.pingInterval);
            this.pingInterval = null;
        }

        if (event.code !== WSCloseCodes.Normal && this.isPrimaryGM) {
            this.scheduleReconnect();
        }
    }

    onError(event) {
        ModuleLogger.error("WebSocket error:", event);
        this.isConnecting = false;
    }

    async onMessage(event) {
        try {
            const data = JSON.parse(event.data);
            ModuleLogger.info("Received message:", data);

            if (data.type && this.messageHandlers.has(data.type)) {
                ModuleLogger.info(`Handling message of type: ${data.type}`);
                this.messageHandlers.get(data.type)(data, { socketManager: this });
            } else if (data.type) {
                ModuleLogger.warn(`No handler for message type: ${data.type}`);
            }
        } catch (error) {
            ModuleLogger.error("Error processing message:", error);
        }
    }

    scheduleReconnect() {
        if (this.reconnectTimer !== null) return;

        const maxAttempts = game.settings.get(moduleId, SETTINGS.RECONNECT_MAX_ATTEMPTS);
        const baseDelay = game.settings.get(moduleId, SETTINGS.RECONNECT_BASE_DELAY);

        this.reconnectAttempts++;

        if (this.reconnectAttempts > maxAttempts) {
            ModuleLogger.error(`Maximum reconnection attempts (${maxAttempts}) reached`);
            this.reconnectAttempts = 0;
            return;
        }

        const delay = Math.min(30000, baseDelay * Math.pow(2, this.reconnectAttempts - 1));
        
        ModuleLogger.info(`Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempts}/${maxAttempts})`);
        
        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            
            if (this.isPrimaryGM) {
                ModuleLogger.info("Attempting reconnect...");
                this.connect();
            } else {
                ModuleLogger.info("Reconnect attempt aborted - no longer primary GM.");
                this.reconnectAttempts = 0;
            }
        }, delay);
    }
}

// Router utility
class Router {
    constructor(title, routes = []) {
        this.title = title;
        this.routes = routes;
    }

    addRoute(route) {
        this.routes.push(route);
    }

    reflect(socketManager) {
        this.routes.forEach(route => {
            socketManager.onMessageType(route.actionType, route.handler);
        });
    }
}

// Ping Router
const pingRouter = new Router("pingRouter");
pingRouter.addRoute({
    actionType: "ping",
    handler: (data, context) => {
        ModuleLogger.info("Received ping, sending pong");
        context.socketManager.send({ type: "pong" });
    }
});

pingRouter.addRoute({
    actionType: "pong",
    handler: () => {
        ModuleLogger.info("Received pong");
    }
});

// Chat Messages Router - NEW!
const chatRouter = new Router("chatRouter");
chatRouter.addRoute({
    actionType: "chat-messages",
    handler: async (data, context) => {
        const socketManager = context?.socketManager;
        ModuleLogger.info("Received request for chat messages:", data);
        
        try {
            const limit = data.limit || game.settings.get(moduleId, SETTINGS.CHAT_MESSAGES_LIMIT) || 50;
            const sort = data.sort || "timestamp";
            const order = data.order || "desc";
            
            // Get messages from storage
            let messages = [...recentChatMessages];
            
            // Apply sorting
            if (sort === "timestamp") {
                messages.sort((a, b) => {
                    return order === "desc" ? b.timestamp - a.timestamp : a.timestamp - b.timestamp;
                });
            }
            
            // Apply limit
            const limitedMessages = messages.slice(0, limit);
            
            ModuleLogger.info(`Returning ${limitedMessages.length} chat messages`);
            
            socketManager?.send({
                type: "chat-messages-result",
                requestId: data.requestId,
                messages: limitedMessages,
                total: messages.length
            });
            
        } catch (error) {
            ModuleLogger.error("Error processing chat messages request:", error);
            socketManager?.send({
                type: "chat-messages-result",
                requestId: data.requestId,
                error: error.message,
                messages: []
            });
        }
    }
});

// Roll Router (existing functionality)
const rollRouter = new Router("rollRouter");
rollRouter.addRoute({
    actionType: "rolls",
    handler: async (data, context) => {
        const socketManager = context?.socketManager;
        ModuleLogger.info("Received request for roll data");
        socketManager?.send({
            type: "rolls-result",
            requestId: data.requestId,
            data: recentRolls.slice(0, data.limit || 20)
        });
    }
});

rollRouter.addRoute({
    actionType: "last-roll",
    handler: (data, context) => {
        const socketManager = context?.socketManager;
        ModuleLogger.info("Received request for last roll data");
        socketManager?.send({
            type: "last-roll-result",
            requestId: data.requestId,
            data: recentRolls.length > 0 ? recentRolls[0] : null
        });
    }
});

// Array of all routers
const routers = [pingRouter, chatRouter, rollRouter];

// Initialize WebSocket
function initializeWebSocket() {
    const wsRelayUrl = game.settings.get(moduleId, "wsRelayUrl");
    const apiKey = game.settings.get(moduleId, "apiKey");
    const module = game.modules.get(moduleId);

    if (!wsRelayUrl) {
        ModuleLogger.error("WebSocket relay URL is empty. Please configure it in module settings.");
        return;
    }

    ModuleLogger.info(`Initializing WebSocket with URL: ${wsRelayUrl}`);

    try {
        if (module.socketManager) {
            ModuleLogger.info("WebSocket manager already exists, not creating a new one");
        } else {
            module.socketManager = WebSocketManager.getInstance(wsRelayUrl, apiKey);
            if (module.socketManager) {
                module.socketManager.connect();
            }
        }

        if (!module.socketManager) {
            ModuleLogger.warn("No WebSocket manager available, skipping message handler setup");
            return;
        }

        const socketManager = module.socketManager;
        routers.forEach(router => {
            router.reflect(socketManager);
        });

        ModuleLogger.info(`Registered ${routers.length} routers with WebSocket manager`);

    } catch (error) {
        ModuleLogger.error("Error initializing WebSocket:", error);
    }
}

// Chat message collection hook
Hooks.on("createChatMessage", (message) => {
    // Skip rolls (they're handled separately by the existing roll hook)
    if (message.isRoll) return;
    
    ModuleLogger.info(`Collecting chat message from ${message.user?.name || "unknown"}`);
    
    const chatData = {
        id: message.id,
        messageId: message.id,
        user: {
            id: message.user?.id,
            name: message.user?.name
        },
        content: message.content,
        flavor: message.flavor || "",
        type: message.type || "player-chat",
        timestamp: Date.now(),
        speaker: message.speaker,
        whisper: message.whisper || [],
        blind: message.blind || false
    };
    
    // Add to storage
    const existingIndex = recentChatMessages.findIndex(m => m.id === message.id);
    if (existingIndex !== -1) {
        recentChatMessages[existingIndex] = chatData;
    } else {
        recentChatMessages.unshift(chatData);
    }
    
    // Limit storage size
    const maxStored = game.settings.get(moduleId, SETTINGS.MAX_CHAT_MESSAGES_STORED) || MAX_CHAT_MESSAGES_STORED;
    if (recentChatMessages.length > maxStored) {
        recentChatMessages.length = maxStored;
    }
});

// Roll message collection hook (existing functionality)
Hooks.on("createChatMessage", (message) => {
    if (message.isRoll && message.rolls?.length > 0) {
        ModuleLogger.info(`Detected dice roll from ${message.user?.name || "unknown"}`);
        
        const messageId = message.id;
        const rollData = {
            id: messageId,
            messageId: message.id,
            user: {
                id: message.user?.id,
                name: message.user?.name
            },
            speaker: message.speaker,
            flavor: message.flavor || "",
            rollTotal: message.rolls[0].total,
            formula: message.rolls[0].formula,
            isCritical: message.rolls[0].isCritical || false,
            isFumble: message.rolls[0].isFumble || false,
            dice: message.rolls[0].dice?.map(d => ({
                faces: d.faces,
                results: d.results.map(r => ({
                    result: r.result,
                    active: r.active
                }))
            })),
            timestamp: Date.now()
        };

        const existingIndex = recentRolls.findIndex(r => r.id === messageId);
        if (existingIndex !== -1) {
            recentRolls[existingIndex] = rollData;
        } else {
            recentRolls.unshift(rollData);
        }

        if (recentRolls.length > MAX_ROLLS_STORED) {
            recentRolls.length = MAX_ROLLS_STORED;
        }

        const module = game.modules.get(moduleId);
        if (module.socketManager?.isConnected()) {
            module.socketManager.send({
                type: "roll-data",
                data: rollData
            });
        }
    }
});

// Module initialization
Hooks.once("init", () => {
    console.log(`Initializing ${moduleId}`);

    // Register settings
    for (const [key, setting] of Object.entries(SETTINGS.DEFAULTS())) {
        game.settings.register(moduleId, key, setting);
    }

    // Set up module API
    const module = game.modules.get(moduleId);
    module.api = {
        getWebSocketManager: () => {
            if (module.socketManager) {
                return module.socketManager;
            }
            ModuleLogger.warn("WebSocketManager requested but not initialized");
            return null;
        },
        getChatMessages: (limit = 50) => {
            return recentChatMessages.slice(0, limit);
        },
        getRolls: (limit = 20) => {
            return recentRolls.slice(0, limit);
        }
    };
});

// Settings UI enhancements
Hooks.on("renderSettingsConfig", (app, html) => {
    const $html = html instanceof HTMLElement ? $(html) : html;
    const $apiKey = $html.find(`input[name="${moduleId}.apiKey"]`);
    
    if ($apiKey.length) {
        $apiKey.attr("type", "password");
        
        const $showButton = $('<button type="button" style="margin-left: 10px;"><i class="fas fa-info-circle"></i> Show Client Info</button>');
        $apiKey.after($showButton);
        
        $showButton.on("click", () => {
            const socketManager = game.modules.get(moduleId).api.getWebSocketManager();
            if (socketManager) {
                const clientId = socketManager.getClientId();
                
                new Dialog({
                    title: "Client Information",
                    content: `
                        <div class="form-group">
                            <label>Client ID</label>
                            <div class="form-fields">
                                <input type="text" value="${clientId}" readonly>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>World ID</label>
                            <div class="form-fields">
                                <input type="text" value="${game.world.id}" readonly>
                            </div>
                        </div>
                        <div class="form-group">
                            <label>World Title</label>
                            <div class="form-fields">
                                <input type="text" value="${game.world.title}" readonly>
                            </div>
                        </div>
                        <p class="notes">Click any field to copy its value.</p>
                    `,
                    buttons: {
                        ok: { label: "OK" }
                    },
                    render: (dialog) => {
                        const $dialog = dialog instanceof HTMLElement ? $(dialog) : dialog;
                        const $inputs = $dialog.find('input[type="text"]');
                        $inputs.css("cursor", "pointer");
                        $inputs.on("click", (event) => {
                            const $input = $(event.currentTarget);
                            navigator.clipboard.writeText($input.val()).then(() => {
                                ui.notifications.info("Copied to clipboard.");
                                $input.select();
                            });
                        });
                    }
                }).render(true);
            } else {
                ui.notifications.warn("WebSocketManager is not available.");
            }
        });
        
        $apiKey.on("change", (event) => {
            const value = event.target.value;
            game.settings.set(moduleId, "apiKey", value).then(() => {
                new Dialog({
                    title: "Reload Required",
                    content: "<p>The API Key has been updated. A reload is required for the changes to take effect. Would you like to reload now?</p>",
                    buttons: {
                        yes: {
                            label: "Reload",
                            callback: () => window.location.reload()
                        },
                        no: {
                            label: "Later"
                        }
                    },
                    default: "yes"
                }).render(true);
            });
        });
    }
});

// WebSocket initialization on ready
Hooks.once("ready", () => {
    setTimeout(() => {
        initializeWebSocket();
    }, 1000);
});
