/**
 * AutoPilot
 * @version 1.0.0
 * Let LLMs take control of your conversations for semi-auto or auto conversation handling, with robust memory management, human response patterns, and other humanization features.
 */

module.exports = class AutoPilot {
    constructor() {
        this._config = {
            name: "AutoPilot",
            version: "1.0.0",
            description: "Let LLMs take control of your conversations for semi-auto or auto conversation handling, with robust memory management, human response patterns, and other humanization features."
        };

        this.settings = {
            useGlobalConfig: false,
            autopilotEnabled: false,
            whitelist: [],
            proactiveModeChannels: [],
            proactiveWaitMinMs: 1800000,
            proactiveWaitMaxMs: 7200000,
            proactiveActiveTimeStart: "07:00",
            proactiveActiveTimeEnd: "17:00",
            shortTermMemoryLimit: 20,
            shortTermMemoryRetention: 5,
            mediumTermMemoryTriggerCount: 10,
            mediumTermMemoryLimit: 10,
            longTermMemoryTriggerCount: 5,
            longTermMemoryLimit: -1,
            useMemorySummaries: true,
            summaryModel: "gpt-4o-mini",
            summarySystemPrompt:
                "You are an AI specialized in condensing conversation logs into short notes. Include both the author's name and ID for each message.",
            longTermStorageEnabled: true,
            disableChannelInstancingForMemories: false,
            maxSplitCharThreshold: 1000,
            maxSplitWordThreshold: 175,
            ownerId: "",
            wpm: 100,
            wpmVariance: 5,
            enableTypingIndicator: true,
            enableChunking: false,
            openAiApiKey: "",
            llmModel: "gpt-3.5-turbo",
            systemPrompt: "You are an AI integrated into a Discord user client.",
            perplexityApiToken: "",
            useAiIntrigueCheck: true,
            intrigueAiModel: "gpt-4o-mini",
            intrigueSystemPrompt:
                "Return yes or no if the message is worth responding to. It's important to respond to most messages. Respond no only when the user clearly hasn't finished their thought.",
            allowIntrigueSessions: true,
            sessionIdleMs: 120000,
            replyTemperature: 0.7,
            replyTopP: 0.8,
            otherTemperature: 0.3,
            otherTopP: 0.33,
            respondMode: "human",
            respondChance: 0.5,
            triggerWords: "help, question, idea",
            useIntriguingCheck: false,
            responseCooldownMs: 3000,
            globalResponseCooldownMs: 3000,
            dedupeSeconds: 10,
            importantMemoryEnabled: true,
            importantMemoryLimit: 10,
            aiWatermarkEnabled: false,
            aiWatermarkText:
                "This content is AI generated. Messages shared are processed in accordance with OpenAI's [privacy policy](https://openai.com/privacy). Content generated may be misleading or inaccurate. Verify important information."
        };

        this.shortTermMemory = [];
        this._memoryCache = {
            mediumTermMemory: [],
            longTermMemory: [],
            globalMemory: [],
            importantMemory: [],
            personalityMemory: []
        };

        this.lastResponseTimestamps = {};
        this.lastGlobalResponseTimestamp = 0;
        this.respondedRecently = new Map();
        this.activeResponses = new Set();
        this.activeChannelSessions = new Map();
        this.activeChannelResponses = new Map();
        this.lastUserMessage = new Map();
        this.nextProactiveWait = {};
        this.messageQueue = [];
        this.queueProcessing = false;

        this.Dispatcher = null;
        this.sendMessageModule = null;
        this.typingModule = null;
        this.currentUserId = null;
        this.currentUserName = "Me";
        this._unsubDispatch = null;
        this._unpatches = [];
        this._proactiveCheckInterval = null;
        this.PresenceStore = BdApi.findModuleByProps("getActivities", "getStatus", "isMobileOnline");

        this.whitelistIcon = `
          <svg width="20" height="20" viewBox="0 0 576 512">
            <path fill="currentColor"
                  d="M528 448H48c-26.51 0-48-21.49-48-48V112
                     c0-26.51 21.49-48 48-48h480c26.51 0 48 21.49
                     48 48v288c0 26.51-21.49 48-48 48zM128 180
                     v-40c0-6.627-5.373-12-12-12H76c-6.627
                     0-12 5.373-12 12v40c0 6.627 5.373
                     12 12 12h40c6.627 0 12-5.373 12-12zm96 0v-40c0-6.627-5.373-12-12-12h-40c-6.627
                     0-12 5.373-12 12v40c0 6.627 5.373
                     12 12 12h40c6.627 0 12-5.373 12-12zm96 0v-40c0-6.627-5.373-12-12-12h-40c-6.627
                     0-12 5.373-12 12v40c0 6.627 5.373
                     12 12 12h40c6.627 0 12-5.373 12-12z"/>
          </svg>`;

        this.proactiveIcon = `
          <svg width="20" height="20" viewBox="0 0 512 512">
            <path fill="currentColor"
                  d="M256 32C132.3 32 32 132.3 32 256
                     s100.3 224 224 224 224-100.3 224-224S379.7
                     32 256 32zm0 400c-97.2 0-176-78.8-176-176
                     0-97.2 78.8-176 176-176 97.2 0 176 78.8
                     176 176 0 97.2-78.8 176-176 176zm80-176
                     c0 8.8-7.2 16-16 16h-48v112c0 8.8-7.2
                     16-16 16s-16-7.2-16-16V256c0-8.8 7.2-16
                     16-16h64c8.8 0 16 7.2 16 16z"/>
          </svg>`;

        this._duplicateInstance = false;
    }

    getName() {
        return this._config.name;
    }
    getAuthor() {
        return "iancdev";
    }
    getVersion() {
        return this._config.version;
    }
    getDescription() {
        if (this._duplicateInstance) {
            return "Duplicate instance (disabled for this user).";
        }
        return this._config.description;
    }

    start() {
        const userStore = BdApi.findModuleByProps("getCurrentUser");
        const user = userStore?.getCurrentUser();
        if (!user) {
            BdApi.showToast("AutoPilot: Could not fetch current user. Plugin not started.", {
                type: "error"
            });
            return;
        }
        this.currentUserId = user.id;
        this.currentUserName = user.username || "Me";

        if (!window.__AutoPilotInstances) {
            window.__AutoPilotInstances = {};
        }
        if (window.__AutoPilotInstances[this.currentUserId]) {
            this._duplicateInstance = true;
            BdApi.showToast(
                `AutoPilot: Another instance is running for user ${this.currentUserName}. Disabled.`,
                { type: "warning" }
            );
            return;
        }
        window.__AutoPilotInstances[this.currentUserId] = true;

        this.loadGlobalScopeConfigFlag();
        this.loadSettings();
        this.loadAllMemoriesFromFile();

        this.Dispatcher = BdApi.findModuleByProps("subscribe", "dispatch");
        this.sendMessageModule = BdApi.findModule(
            (m) => typeof m?.sendMessage === "function" && typeof m?.receiveMessage === "function"
        );
        this.typingModule = BdApi.findModuleByProps("startTyping", "stopTyping");

        this.subscribeToIncomingMessages();
        this.patchSendMessages();
        this.patchChannelTextArea();
        this.startProactiveChecking();

        BdApi.showToast(
            `${this.getName()} v${this.getVersion()} started (User: ${this.currentUserName}).`,
            { type: "info" }
        );
    }

    stop() {
        if (
            !this._duplicateInstance &&
            window.__AutoPilotInstances &&
            window.__AutoPilotInstances[this.currentUserId]
        ) {
            delete window.__AutoPilotInstances[this.currentUserId];
        }
        if (this.Dispatcher && this._unsubDispatch) {
            this._unsubDispatch();
        }
        this._unsubDispatch = null;

        for (const un of this._unpatches) un();
        this._unpatches = [];

        this.stopProactiveChecking();

        if (!this._duplicateInstance) {
            this.saveSettings();
            this.saveAllMemoriesToFile();
        }

        BdApi.showToast(
            `${this.getName()} stopped (User: ${this.currentUserName}).`,
            { type: "info" }
        );
    }

    appendWatermark(text) {
        if (this.settings.aiWatermarkEnabled && text) {
            return text + "\n-# " + this.settings.aiWatermarkText;
        }
        return text;
    }

    getMemFileName() {
        return `autopilot_memories_${this.currentUserId}.json`;
    }

    loadAllMemoriesFromFile() {
        let loaded = null;
        try {
            const memoryKey = this.getDataKeyNameMemory();
            const data = BdApi.loadData(memoryKey, "memories");
            if (data && typeof data === "object") {
                loaded = data;
            }
        } catch (_) {
            //
        }
        if (!loaded) {
            const fallbackKey = this.getDataKeyName();
            const data = BdApi.loadData(fallbackKey, "memories_overhaul");
            if (data && typeof data === "object") {
                loaded = data;
            }
        }
        if (loaded) {
            this._memoryCache.mediumTermMemory = Array.isArray(loaded.mediumTermMemory)
                ? loaded.mediumTermMemory
                : [];
            this._memoryCache.longTermMemory = Array.isArray(loaded.longTermMemory)
                ? loaded.longTermMemory
                : [];
            this._memoryCache.globalMemory = Array.isArray(loaded.globalMemory)
                ? loaded.globalMemory
                : [];
            this._memoryCache.importantMemory = Array.isArray(loaded.importantMemory)
                ? loaded.importantMemory
                : [];
            this._memoryCache.personalityMemory = Array.isArray(loaded.personalityMemory)
                ? loaded.personalityMemory
                : [];
        }
    }

    saveAllMemoriesToFile() {
        const data = this._memoryCache;
        try {
            const memoryKey = this.getDataKeyNameMemory();
            BdApi.saveData(memoryKey, "memories", data);
        } catch (_) {
            const fallbackKey = this.getDataKeyName();
            BdApi.saveData(fallbackKey, "memories_overhaul", data);
        }
    }

    getDataKeyNameMemory() {
        if (this.settings.useGlobalConfig) {
            return this.getName() + "_memories";
        } else {
            return this.getName() + "_" + this.currentUserId + "_memories";
        }
    }

    loadGlobalScopeConfigFlag() {
        const universal = BdApi.loadData(this.getName(), "UNIVERSAL_CONFIG_FLAG");
        if (universal && typeof universal.useGlobalConfig === "boolean") {
            this.settings.useGlobalConfig = universal.useGlobalConfig;
        }
    }

    saveGlobalScopeConfigFlag() {
        BdApi.saveData(this.getName(), "UNIVERSAL_CONFIG_FLAG", {
            useGlobalConfig: this.settings.useGlobalConfig
        });
    }

    getDataKeyName() {
        if (this.settings.useGlobalConfig) {
            return this.getName();
        } else {
            return this.getName() + "_" + this.currentUserId;
        }
    }

    loadSettings() {
        const keyName = this.getDataKeyName();
        const loaded = BdApi.loadData(keyName, "settings");
        if (loaded && typeof loaded === "object") {
            Object.assign(this.settings, loaded);
        }
        this.settings.useGlobalConfig = !!(
            BdApi.loadData(this.getName(), "UNIVERSAL_CONFIG_FLAG")?.useGlobalConfig
        );
    }

    saveSettings() {
        this.saveGlobalScopeConfigFlag();
        const keyName = this.getDataKeyName();
        BdApi.saveData(keyName, "settings", this.settings);
    }

    get mediumTermMemory() {
        return this._memoryCache.mediumTermMemory;
    }
    set mediumTermMemory(val) {
        this._memoryCache.mediumTermMemory = val;
    }

    get longTermMemory() {
        return this._memoryCache.longTermMemory;
    }
    set longTermMemory(val) {
        this._memoryCache.longTermMemory = val;
    }

    get globalMemory() {
        return this._memoryCache.globalMemory;
    }
    set globalMemory(val) {
        this._memoryCache.globalMemory = val;
    }

    get importantMemory() {
        return this._memoryCache.importantMemory;
    }
    set importantMemory(val) {
        this._memoryCache.importantMemory = val;
    }

    get personalityMemory() {
        return this._memoryCache.personalityMemory;
    }
    set personalityMemory(val) {
        this._memoryCache.personalityMemory = val;
    }

    subscribeToIncomingMessages() {
        if (!this.Dispatcher) {
            BdApi.showToast("AutoPilot: Dispatcher not found.", { type: "error" });
            return;
        }
        const onMessageCreate = async (evt) => {
            if (evt.type !== "MESSAGE_CREATE") return;
            const channelId = evt.channelId;
            const message = evt.message ?? evt;
            if (!message?.id) return;
            if (!this.settings.autopilotEnabled) return;

            const authorId = message.author?.id;
            let content = (message.content || "").trim();

            if (this.isOwnerMessage(authorId, content)) {
                this.processOwnerCommand(content, channelId);
                return;
            }

            if (!this.isChannelWhitelisted(channelId)) return;
            if (this.isMyUserId(authorId)) return;

            content = this.normalizeContent(content);
            content = this.stripMetadata(content);
            content = this.stripWatermark(content);

            const key = `${channelId}_${authorId}`;
            this.lastUserMessage.set(key, Date.now());

            const dedupeKey = `${channelId}~${authorId}~${content}`;
            if (this.isDuplicateMessage(dedupeKey)) return;

            const authorName = message.author?.username || `User-${authorId}`;

            if (message.attachments && message.attachments.length > 0) {
                const imageAttachment = message.attachments.find((att) => {
                    if (!att.url) return false;
                    const cleanUrl = att.url.split("?")[0].toLowerCase();
                    return (
                        cleanUrl.endsWith(".png") ||
                        cleanUrl.endsWith(".jpg") ||
                        cleanUrl.endsWith(".jpeg") ||
                        cleanUrl.endsWith(".webp") ||
                        cleanUrl.endsWith(".gif")
                    );
                });
                if (imageAttachment) {
                    this.shortTermMemoryPush({
                        channelId,
                        authorId,
                        authorName,
                        role: "user",
                        type: "image",
                        imageUrl: imageAttachment.url,
                        content,
                        timestamp: Date.now(),
                        messageId: message.id
                    });
                }
            }

            this.shortTermMemoryPush({
                channelId,
                authorId,
                authorName,
                role: "user",
                content,
                timestamp: Date.now(),
                messageId: message.id
            });

            this.checkAndStoreGlobalMemory(authorId, authorName, content);

            let session = this.activeChannelSessions.get(channelId);
            if (!session) {
                session = { isActive: false, lastActivity: 0 };
                this.activeChannelSessions.set(channelId, session);
            }
            const now = Date.now();
            if (session.isActive && now - session.lastActivity > this.settings.sessionIdleMs) {
                session.isActive = false;
            }
            session.lastActivity = now;

            if (content.trim().toLowerCase() === "!end session") {
                session.isActive = false;
                BdApi.showToast("AI session ended for this channel.", { type: "info" });
                this.markAsResponded(dedupeKey);
                return;
            }

            const shouldRespond = await this.shouldRespondToMessage(message, channelId, content);
            if (!shouldRespond) {
                this.markAsResponded(dedupeKey);
                return;
            }
            this.enqueueMessage({ channelId, content, dedupeKey, authorId });
        };
        this._unsubDispatch = this.Dispatcher.subscribe("MESSAGE_CREATE", onMessageCreate);
    }

    async handleReplyFlow(channelId, content, dedupeKey, messageAuthorId) {
        const lockKey = "global";
        if (this.activeChannelResponses.get(lockKey)) return;
        this.activeChannelResponses.set(lockKey, true);

        const processingStartTime = Date.now();
        if (this.settings.respondMode === "attentive") {
            await this.waitForUserTypingToPause(channelId, messageAuthorId);
        }
        if (this.settings.useMemorySummaries) {
            this.autoSummarizeIfNeeded(channelId);
        }
        try {
            let reply = await this.generateReply(channelId, content, processingStartTime);
            if (!reply) return;
            reply = this.stripMetadata(reply);
            await this.processToolCommands(channelId, reply);
            const now = Date.now();
            this.lastResponseTimestamps[channelId] = now;
            this.lastGlobalResponseTimestamp = now;
        } catch (err) {
            console.error("[AutoPilot] Error in handleReplyFlow:", err);
        } finally {
            this.markAsResponded(dedupeKey);
            this.activeResponses.delete(dedupeKey);
            this.activeChannelResponses.delete(lockKey);

            if (this.settings.enableTypingIndicator && this.typingModule) {
                try {
                    this.typingModule.stopTyping(channelId);
                } catch (_) {}
            }
        }
    }

    isOwnerMessage(authorId, content) {
        if (!this.settings.ownerId) return false;
        if (authorId !== this.settings.ownerId) return false;
        if (!content.trim().startsWith("!")) return false;
        return true;
    }

    processOwnerCommand(content, channelId) {
        const lc = content.trim().toLowerCase();
        if (lc.startsWith("!pushtoltm")) {
            this.ownerPushToLTM(channelId);
        } else if (lc.startsWith("!pushtomtm")) {
            this.ownerPushToMTM(channelId);
        } else if (lc.startsWith("!convoend")) {
            this.ownerConvoEnd(channelId);
        } else if (lc.startsWith("!addpersonality")) {
            const raw = content.slice("!addpersonality".length).trim();
            if (raw) {
                this.addPersonalityEntry(raw);
                this.sendOwnerMessage(channelId, "Personality entry added to your profile.");
            }
        } else {
            this.sendOwnerMessage(channelId, `Unknown owner command: ${content}`);
        }
    }

    sendOwnerMessage(channelId, text) {
        if (!this.sendMessageModule) return;
        this.sendMessageModule.sendMessage(channelId, { content: text, skipMemory: true });
    }

    ownerPushToLTM(channelId) {
        this.processMediumTermMemoryForChannel(channelId, true)
            .then(() => {
                this.sendOwnerMessage(channelId, "Manually pushed Medium-Term to Long-Term memory.");
            })
            .catch((err) => {
                console.error("ownerPushToLTM error:", err);
                this.sendOwnerMessage(channelId, "Error pushing to LTM. Check console.");
            });
    }

    ownerPushToMTM(channelId) {
        this.processShortTermMemoryForChannel(channelId, true)
            .then(() => {
                this.sendOwnerMessage(channelId, "Manually pushed Short-Term to Medium-Term memory.");
            })
            .catch((err) => {
                console.error("ownerPushToMTM error:", err);
                this.sendOwnerMessage(channelId, "Error pushing to MTM. Check console.");
            });
    }

    ownerConvoEnd(channelId) {
        this.processShortTermMemoryForChannel(channelId, true)
            .then(() => this.processMediumTermMemoryForChannel(channelId, true))
            .then(() => {
                this.sendOwnerMessage(channelId, "Conversation ended, memory segments updated.");
            })
            .catch((err) => {
                console.error("ownerConvoEnd error:", err);
                this.sendOwnerMessage(channelId, "Error finalizing conversation. Check console.");
            });
    }

    addPersonalityEntry(text) {
        const newItem = {
            id: this.generateUniqueId(),
            content: text,
            timestamp: Date.now(),
            embedding: null
        };
        this.personalityMemory.push(newItem);
        this.generateEmbedding(text)
            .then((emb) => {
                if (emb) {
                    newItem.embedding = emb;
                    this.saveAllMemoriesToFile();
                }
            })
            .catch((err) => console.error("addPersonalityEntry embedding error:", err));

        this.saveAllMemoriesToFile();
    }

    async processToolCommands(channelId, reply) {
        let processed = reply.replace(/\r\n/g, "\n");

        processed = processed.replace(/(\/newmsg|\[newmsg\])\s*/gi, "\n");
        const lines = processed.split("\n").map((l) => l.trim()).filter(Boolean);
        if (lines.includes("/noresponse")) {
            return;
        }
        if (!lines.length) return;

        if (this.settings.enableTypingIndicator && this.typingModule) {
            try {
                this.typingModule.startTyping(channelId);
            } catch (_) {}
        }

        for (const line of lines) {
            const start = Date.now();
            if (this.settings.enableChunking) {
                await this.sendMessageInChunks(channelId, line, start);
            } else {
                await this.simulateTypingAndSend(channelId, line, start);
            }
            if (this.settings.enableTypingIndicator && this.typingModule) {
                try {
                    this.typingModule.startTyping(channelId);
                } catch (_) {}
            }
        }
    }

    async processShortTermMemoryForChannel(channelId, force = false) {
        const channelMsgs = this.shortTermMemory.filter((m) => m.channelId === channelId);
        const retention = this.settings.shortTermMemoryRetention || 0;
        if (!force && channelMsgs.length <= this.settings.shortTermMemoryLimit) {
            return;
        }
        const toSummarize = channelMsgs.slice(0, channelMsgs.length - retention);
        if (toSummarize.length === 0) return;
        const rawSnippet = toSummarize
            .map((m) => {
                const roleLabel =
                    m.role === "assistant"
                        ? `Assistant (${m.authorName})`
                        : `User (${m.authorName})`;
                return `${roleLabel} says: ${m.content}`;
            })
            .join("\n");

        const splittedSnippets = await this.autoSplitIfNeeded(rawSnippet);
        if (splittedSnippets.length > 0) {
            const groupId = this.generateUniqueId();
            for (let i = 0; i < splittedSnippets.length; i++) {
                const chunk = splittedSnippets[i];
                const summary = await this.summarizeMemorySnippet(chunk);
                if (summary) {
                    this.mediumTermMemory.push({
                        id: groupId,
                        segmentId: `${groupId}_${i + 1}`,
                        type: "medium_summary",
                        channelId,
                        authorId: "summarizer",
                        authorName: "Summarizer",
                        content: `[Segment #${i + 1}]\n${summary}`,
                        timestamp: Date.now()
                    });
                }
            }
            this.saveAllMemoriesToFile();
            const retained = channelMsgs.slice(-retention);
            this.shortTermMemory = this.shortTermMemory.filter((m) => m.channelId !== channelId);
            this.shortTermMemory.push(...retained);
            await this.processMediumTermMemoryForChannel(channelId);
        }
    }

    async processMediumTermMemoryForChannel(channelId, force = false) {
        const mediumMessages = this.mediumTermMemory.filter((m) => m.channelId === channelId);
        if (
            (force && mediumMessages.length > 0) ||
            (!force && mediumMessages.length >= this.settings.mediumTermMemoryTriggerCount)
        ) {
            const snippet = mediumMessages
                .map((m) => `[Medium Summary]: ${m.content}`)
                .join("\n");
            const splittedSnippets = await this.autoSplitIfNeeded(snippet);
            if (splittedSnippets.length > 0) {
                const groupId = this.generateUniqueId();
                for (let i = 0; i < splittedSnippets.length; i++) {
                    const chunkText = splittedSnippets[i];
                    const chunkSummary = await this.summarizeMemorySnippet(chunkText);
                    if (!chunkSummary) continue;
                    const ltmEntry = {
                        id: this.generateUniqueId(),
                        groupId,
                        segmentNumber: i + 1,
                        type: "long_summary",
                        channelId,
                        authorId: "summarizer",
                        authorName: "Summarizer",
                        content: `[MTM-Segment #${i + 1}]\n${chunkSummary}`,
                        timestamp: Date.now(),
                        embedding: null
                    };
                    this.longTermMemory.push(ltmEntry);
                    await this.updateMemoryEmbedding(ltmEntry);
                }
                this.mediumTermMemory = this.mediumTermMemory.filter(
                    (m) => m.channelId !== channelId
                );
                this.saveAllMemoriesToFile();
                await this.processLongTermMemoryForChannel(channelId);
            }
        }
    }

    async processLongTermMemoryForChannel(channelId) {
        const longEntries = this.longTermMemory.filter(
            (m) => m.channelId === channelId && m.type === "long_summary"
        );
        if (
            this.settings.longTermMemoryTriggerCount > 0 &&
            longEntries.length >= this.settings.longTermMemoryTriggerCount &&
            this.settings.useMemorySummaries
        ) {
            const snippet = longEntries
                .map((m) => `[Long Summary]: ${m.content}`)
                .join("\n");
            const splitted = await this.autoSplitIfNeeded(snippet);
            if (splitted.length > 0) {
                const groupId = this.generateUniqueId();
                this.longTermMemory = this.longTermMemory.filter(
                    (m) => m.channelId !== channelId || m.type !== "long_summary"
                );
                for (let i = 0; i < splitted.length; i++) {
                    const partial = splitted[i];
                    const partialSummary = await this.summarizeMemorySnippet(partial);
                    if (partialSummary) {
                        const newLtmEntry = {
                            id: this.generateUniqueId(),
                            groupId,
                            segmentNumber: i + 1,
                            type: "long_summary",
                            channelId,
                            authorId: "summarizer",
                            authorName: "Summarizer",
                            content: partialSummary.trim(),
                            timestamp: Date.now(),
                            embedding: null
                        };
                        await this.updateMemoryEmbedding(newLtmEntry);
                        this.longTermMemory.push(newLtmEntry);
                    }
                }
                this.saveAllMemoriesToFile();
            }
        }
        if (this.settings.longTermMemoryLimit !== -1) {
            let updatedEntries = this.longTermMemory.filter(
                (m) => m.channelId === channelId && m.type === "long_summary"
            );
            if (updatedEntries.length > this.settings.longTermMemoryLimit) {
                updatedEntries.sort((a, b) => a.timestamp - b.timestamp);
                const toRemoveCount =
                    updatedEntries.length - this.settings.longTermMemoryLimit;
                const removeIds = new Set(updatedEntries.slice(0, toRemoveCount).map((m) => m.id));
                this.longTermMemory = this.longTermMemory.filter(
                    (m) => m.channelId !== channelId || !removeIds.has(m.id)
                );
                this.saveAllMemoriesToFile();
            }
        }
    }

    autoSummarizeIfNeeded(channelId) {
        const count = this.shortTermMemory.filter((m) => m.channelId === channelId).length;
        if (count >= this.settings.shortTermMemoryLimit) {
            this.processShortTermMemoryForChannel(channelId).catch((err) =>
                console.error("[AutoPilot] autoSummarizeIfNeeded error:", err)
            );
        }
    }

    async summarizeMemorySnippet(snippet) {
        if (!this.settings.useMemorySummaries) return null;
        if (!this.settings.openAiApiKey) return null;
        const sysPrompt = this.settings.summarySystemPrompt || "Condense the logs succinctly.";
        const model = this.settings.summaryModel || "gpt-4o-mini";
        const maxT = 2048;
        const convo = [
            { role: "system", content: sysPrompt },
            { role: "user", content: `Please summarize the following:\n${snippet}\n` }
        ];
        try {
            const result = await this.callOpenAiChatApi(convo, model, maxT, {
                temperature: this.settings.otherTemperature,
                top_p: this.settings.otherTopP
            });
            await this.detectNewPersonalityDetails(result || "");
            return (result || "").trim();
        } catch (err) {
            console.error("[AutoPilot] Summarize snippet error:", err);
            return null;
        }
    }

    async detectNewPersonalityDetails(summaryText) {
        if (!summaryText) return;
        const prompt = `Analyze the following conversation snippet and determine if it contains personality altering details that directly affect the assistant’s behavior, tone, or internal personality. Do not consider any details about the user. If such details exist, extract and summarize them in one concise sentence. If not, simply answer with "NONE".\n\nSnippet:\n${summaryText}`;
        const messages = [
            {
                role: "system",
                content:
                    "You are a personality trait analyzer for an AI assistant. In the provided conversation snippet, the messages labeled 'User' represent the assistant's internal dialogue and state, and messages labeled 'Assistant' represent its external interactions. Your job is to identify only those details that alter or influence the assistant’s internal personality—its tone, behavior, or preferences. Disregard any personality details that pertain to a human user. Refer to the assistant as you. If relevant details exist, return a single concise sentence summarizing them; otherwise, respond with 'NONE'."
            },
            { role: "user", content: prompt }
        ];
        const refinedText = await this.callOpenAiChatApi(
            messages,
            "gpt-4o-mini",
            200,
            { temperature: 0.0, top_p: 1.0 }
        );
        if (!refinedText || refinedText.trim().toUpperCase() === "NONE") return;
        const newItem = {
            id: this.generateUniqueId(),
            content: `${refinedText.trim()}`,
            timestamp: Date.now(),
            embedding: null
        };
        this.personalityMemory.push(newItem);
        try {
            const emb = await this.generateEmbedding(newItem.content);
            if (emb) newItem.embedding = emb;
            this.saveAllMemoriesToFile();
        } catch (err) {
            console.error("detectNewPersonalityDetails embedding error:", err);
        }
    }

    async generateOptimizedQueryForMemory(channelId, memoryType = "default") {
        const conversationArray = this.buildShortTermConversation(channelId, Date.now(), 10);
        const conversationContext = conversationArray.map(m => m.content).join("\n");

        let systemPrompt;
        switch (memoryType.toLowerCase()) {
            case "important":
                systemPrompt =
                    "You are an expert summarizer specializing in extracting high-impact information. Generate a concise query that captures the most critical, actionable details.";
                break;
            case "personality":
                systemPrompt =
                    "You are an expert in analyzing conversational nuances to identify personality traits. Generate a short, focused query for retrieving relevant personality details.";
                break;
            default:
                systemPrompt =
                    "You are an expert in generating precise retrieval queries from conversation context. Produce a short, clear query capturing key topics and essential info.";
                break;
        }
        systemPrompt +=
            " Reference user's username and user's user id whenever possible. Refer to the assistant's name where applicable.";

        const prompt = `Extract key points from the conversation below and generate a concise query for memory retrieval. Your response will be used directly as an embeddings query.\n\n${conversationContext}\n\nQuery:`;

        const messages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
        ];

        const optimizedQuery = await this.callOpenAiChatApi(messages, "gpt-4o-mini", 500, {
            temperature: 0.0,
            top_p: 1.0
        });
        return optimizedQuery.trim();
    }

    async generateReply(channelId, userContent, processingStartTime) {
        if (!this.settings.openAiApiKey) {
            return this.fallbackReply(userContent);
        }

        const channelObj = this.getChannelObject(channelId);
        let channelTypeInfo = "";
        if (channelObj) {
            switch (channelObj.type) {
                case 1:
                    channelTypeInfo = "This is a direct message (DM).";
                    break;
                case 3:
                    channelTypeInfo = `This is a group DM.`;
                    break;
                case 0:
                    channelTypeInfo = "This is a text channel in a server.";
                    break;
                default:
                    channelTypeInfo = "Channel type unknown.";
            }
        }
        const nowStr = new Date().toLocaleString();
        const presenceStr = this.getLocalUserPresenceString();
        const baseSysPrompt =
            this.settings.systemPrompt ||
            "You are an AI integrated into a Discord user client.";

        const conversation = [
            {
                role: "system",
                content: `[Current date/time: ${nowStr}]\n[Assistant Presence: ${presenceStr}]\n[Channel Info: ${channelTypeInfo}]\n${baseSysPrompt}`
            }
        ];

        if (this.settings.longTermStorageEnabled) {
            const optimizedQuery = await this.generateOptimizedQueryForMemory(channelId, "default");
            const queryEmbedding = await this.generateEmbedding(optimizedQuery);
            if (queryEmbedding) {
                const topSummaries = this.retrieveTopLongTermMemories(channelId, queryEmbedding, 5);
                for (const sum of topSummaries) {
                    const sumTime = new Date(sum.timestamp).toLocaleString();
                    conversation.push({
                        role: "system",
                        content: `[LONG MEMORY - Score: ${sum._score.toFixed(
                            3
                        )}, Date=${sumTime}]:\n${sum.content}`
                    });
                }
            }
        }
        if (this.globalMemory.length > 0) {
            for (const gm of this.globalMemory) {
                const gmTime = new Date(gm.timestamp).toLocaleString();
                conversation.push({
                    role: "system",
                    content: `[GLOBAL MEM: ${gm.authorName}, ID=${gm.authorId}, date=${gmTime}]\n${gm.content}`
                });
            }
        }
        if (this.settings.importantMemoryEnabled && this.importantMemory.length > 0) {
            conversation.push({
                role: "system",
                content: this.importantMemory
                    .map((mem) => `[IMPORTANT]: ${mem.content}`)
                    .join("\n")
            });
        }

        const personalityEmbedding = await this.generateEmbedding(userContent);
        if (personalityEmbedding && this.personalityMemory.length > 0) {
            const optimizedQuery = await this.generateOptimizedQueryForMemory(channelId, "personality");
            const queryEmbedding = await this.generateEmbedding(optimizedQuery);
            const topPers = this.retrieveTopPersonalityMemories(queryEmbedding, 5);
            for (const p of topPers) {
                const persTime = new Date(p.timestamp).toLocaleString();
                conversation.push({
                    role: "system",
                    content: `[PERSONALITY - Relevance=${p._score.toFixed(
                        3
                    )}, Date=${persTime}]:\n${p.content}`
                });
            }
        }

        let conversationHistory;
        if (this.settings.disableChannelInstancingForMemories) {
            conversationHistory = this.shortTermMemory.filter((m) => m.timestamp <= processingStartTime);
            conversationHistory.sort((a, b) => a.timestamp - b.timestamp);
            const initiatingChannelMessages = conversationHistory.filter((m) => m.channelId === channelId);
            if (initiatingChannelMessages.length > 0) {
                const lastInitiatingMsg =
                    initiatingChannelMessages[initiatingChannelMessages.length - 1];
                conversationHistory = conversationHistory.filter((m) => m !== lastInitiatingMsg);
                conversationHistory.push(lastInitiatingMsg);
            }
        } else {
            conversationHistory = this.shortTermMemory
                .filter((m) => m.channelId === channelId && m.timestamp <= processingStartTime)
                .sort((a, b) => a.timestamp - b.timestamp);
        }

        for (const m of conversationHistory) {
            if (m.ephemeral) {
                conversation.push({
                    role: "system",
                    content: m.content
                });
            } else {
                let context = `[${m.authorName} (ID: ${m.authorId})]`;
                if (this.settings.disableChannelInstancingForMemories && m.channelId) {
                    context += ` [Channel: ${m.channelId}]`;
                }
                if (m.type === "image" && m.imageUrl) {
                    const messageContent = [];
                    if (m.content && m.content.trim() !== "") {
                        messageContent.push({
                            type: "text",
                            text: `${context}: ${m.content}`
                        });
                    } else {
                        messageContent.push({
                            type: "text",
                            text: context
                        });
                    }
                    messageContent.push({
                        type: "image_url",
                        image_url: { url: m.imageUrl }
                    });
                    conversation.push({
                        role: m.role,
                        content: messageContent
                    });
                } else {
                    conversation.push({
                        role: m.role,
                        content: `${context}: ${m.content}`
                    });
                }
            }
        }

        try {
            let reply = await this.callOpenAiChatApi(conversation, this.settings.llmModel, 500, {
                temperature: this.settings.replyTemperature,
                top_p: this.settings.replyTopP
            });
            reply = (reply || "").trim();

            const searchRegex = /\/search\s+(.+)/gi;
            let searchLoopCount = 0;
            let match;
            while ((match = searchRegex.exec(reply)) !== null) {
                searchLoopCount++;
                if (searchLoopCount > 3) break;
                const commandIndex = match.index;
                const searchQuery = match[1].trim();
                if (commandIndex > 0) {
                    const textBefore = reply.substring(0, commandIndex).trim();
                    if (textBefore) {
                        await this.sendMessageModule.sendMessage(channelId, {
                            content: textBefore
                        });
                    }
                }
                const searchResult = await this.callPerplexityChatApi(searchQuery);
                reply = reply.replace(match[0], "").trim();
                this.shortTermMemoryPush({
                    channelId,
                    role: "system",
                    content: `Search query: ${searchQuery}\nResult: ${searchResult}\n(Use your own words; do not copy verbatim.)`,
                    ephemeral: true,
                    timestamp: Date.now(),
                    messageId: this.generateUniqueId()
                });
                conversation.push({
                    role: "system",
                    content:
                        "Use the above search result in your answer. Remove any '/search' references in final."
                });
                reply = await this.callOpenAiChatApi(conversation, this.settings.llmModel, 2048, {
                    temperature: this.settings.replyTemperature,
                    top_p: this.settings.replyTopP
                });
                reply = this.stripMetadata(reply.trim());
                searchRegex.lastIndex = 0;
            }

            const memoryRegex = /\/addmemory\s+(.+?);/gi;
            let memoryLoopCount = 0;
            let memMatch;
            while ((memMatch = memoryRegex.exec(reply)) !== null) {
                memoryLoopCount++;
                if (memoryLoopCount > 3) break;
                const memoryContent = memMatch[1].trim();
                if (memoryContent) {
                    this.addImportantMemory(memoryContent);
                }
                reply = reply.replace(memMatch[0], "").trim();
                memoryRegex.lastIndex = 0;
            }

            if (!reply) {
                reply = "Ok.";
            }
            return reply || this.fallbackReply(userContent);
        } catch (err) {
            console.error("[AutoPilot] LLM error:", err);
            return this.fallbackReply(userContent);
        }
    }

    fallbackReply() {
        return "An error occurred generating a reply. (No API Key or API error)";
    }

    retrieveTopPersonalityMemories(queryEmbedding, topK = 2) {
        const candidates = this.personalityMemory.filter((pm) => pm.embedding);
        const results = [];
        for (const pm of candidates) {
            const score = this.cosineSimilarity(queryEmbedding, pm.embedding);
            results.push({ ...pm, _score: score });
        }
        results.sort((a, b) => b._score - a._score);
        return results.slice(0, topK);
    }

    async generateEmbedding(text) {
        if (!this.settings.openAiApiKey) return null;
        const url = "https://api.openai.com/v1/embeddings";
        try {
            const body = { input: text, model: "text-embedding-3-small" };
            const resp = await fetch(url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${this.settings.openAiApiKey}`
                },
                body: JSON.stringify(body)
            });
            if (!resp.ok) {
                console.error("[AutoPilot] Embedding error:", resp.status, await resp.text());
                return null;
            }
            const j = await resp.json();
            if (j.data && j.data[0] && j.data[0].embedding) {
                return j.data[0].embedding;
            }
        } catch (err) {
            console.error("[AutoPilot] generateEmbedding error:", err);
        }
        return null;
    }

    async updateMemoryEmbedding(mem) {
        if (!this.settings.longTermStorageEnabled) return;
        if (!this.settings.openAiApiKey) return;
        if (mem.embedding) return;
        const emb = await this.generateEmbedding(mem.content || "");
        if (emb) {
            mem.embedding = emb;
            this.saveAllMemoriesToFile();
        }
    }

    retrieveTopLongTermMemories(channelId, queryEmbedding, topK = 3) {
        let candidates;
        if (this.settings.disableChannelInstancingForMemories) {
            candidates = this.longTermMemory.filter((m) => m.type === "long_summary" && m.embedding);
        } else {
            candidates = this.longTermMemory.filter(
                (m) => m.type === "long_summary" && m.channelId === channelId && m.embedding
            );
        }
        const results = [];
        for (const mem of candidates) {
            const score = this.cosineSimilarity(queryEmbedding, mem.embedding);
            results.push({ ...mem, _score: score });
        }
        results.sort((a, b) => b._score - a._score);
        return results.slice(0, topK);
    }

    cosineSimilarity(vecA, vecB) {
        if (!Array.isArray(vecA) || !Array.isArray(vecB)) return 0;
        let dot = 0;
        let normA = 0;
        let normB = 0;
        for (let i = 0; i < Math.min(vecA.length, vecB.length); i++) {
            dot += vecA[i] * vecB[i];
            normA += vecA[i] * vecA[i];
            normB += vecB[i] * vecB[i];
        }
        normA = Math.sqrt(normA);
        normB = Math.sqrt(normB);
        if (normA === 0 || normB === 0) return 0;
        return dot / (normA * normB);
    }

    enqueueMessage(messageData) {
        this.messageQueue.push(messageData);
        this.processQueue();
    }

    async processQueue() {
        if (this.queueProcessing) return;
        this.queueProcessing = true;
        while (this.messageQueue.length > 0) {
            const msgData = this.messageQueue.shift();
            if (this.messageQueue.length > 0) {
                const wasAnswered = await this.alreadyAnsweredCheck(msgData.channelId, msgData.content);
                if (wasAnswered) {
                    continue;
                }
            }
            await this.handleReplyFlow(
                msgData.channelId,
                msgData.content,
                msgData.dedupeKey,
                msgData.authorId
            );
        }
        this.queueProcessing = false;
    }

    async callOpenAiChatApi(messages, model, maxTokens = 2048, options = {}) {
        const apiKey = this.settings.openAiApiKey;
        if (!apiKey) return null;

        const body = {
            model,
            messages,
            max_tokens: maxTokens,
            temperature:
                typeof options.temperature === "number" ? options.temperature : 0.7,
            top_p: typeof options.top_p === "number" ? options.top_p : 0.8
        };
        if (model === this.settings.llmModel) {
            function addBias(biasObj, tokens, biasValue) {
                tokens.forEach((token) => {
                    biasObj[token.toString()] = biasValue;
                });
            }
            const logitBias = {};
            addBias(logitBias, [63623], -100);
            addBias(logitBias, [17792], -100);
            addBias(logitBias, [1697, 4370], 25);
            addBias(logitBias, [43, 8131, 46], 10);

            body.logit_bias = logitBias;
            body.frequency_penalty =
                typeof options.frequency_penalty === "number" ? options.frequency_penalty : 0.2;
            body.presence_penalty =
                typeof options.presence_penalty === "number" ? options.presence_penalty : 0.4;
        }

        const resp = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`
            },
            body: JSON.stringify(body)
        });
        if (!resp.ok) {
            console.error("[AutoPilot] OpenAI error:", resp.status, await resp.text());
            return null;
        }
        const j = await resp.json();
        return j?.choices?.[0]?.message?.content || null;
    }

    async callPerplexityChatApi(query) {
        const url = "https://api.perplexity.ai/chat/completions";
        const token = this.settings.perplexityApiToken;
        if (!token) {
            console.error("[AutoPilot] Perplexity token not set.");
            return "No live info (missing Perplexity token).";
        }
        const payload = {
            model: "sonar",
            messages: [
                {
                    role: "system",
                    content:
                        "You are a user searching the web. Return the result in paragraph form, no markdown or bullet points."
                },
                { role: "user", content: query }
            ],
            max_tokens: 5000,
            temperature: 0.2,
            top_p: 0.9,
            search_domain_filter: null,
            return_images: false,
            return_related_questions: false,
            top_k: 0,
            stream: false,
            presence_penalty: 0,
            frequency_penalty: 1,
            response_format: null
        };
        try {
            const resp = await fetch(url, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });
            if (!resp.ok) {
                console.error("[AutoPilot] Perplexity error:", resp.status, await resp.text());
                return "Error retrieving info.";
            }
            const j = await resp.json();
            const searchResult = j?.choices?.[0]?.message?.content;
            return searchResult || "No relevant info found.";
        } catch (err) {
            console.error("[AutoPilot] Perplexity API error:", err);
            return "Error retrieving info.";
        }
    }

    async shouldRespondToMessage(msg, channelId, content) {
        const mode = this.settings.respondMode;
        if (mode === "always") return true;
        if (mode === "mention") {
            return msg.mentions?.some((m) => m.id === this.currentUserId);
        }
        if (mode === "random") {
            return Math.random() < this.settings.respondChance;
        }
        if (mode === "attentive") {
            return true;
        }
        if (mode === "human") {
            if (this.settings.useAiIntrigueCheck) {
                const recentMessages = this.shortTermMemory
                    .filter((m) => m.channelId === channelId && m.messageId !== msg.id)
                    .slice(-10)
                    .map((m) => `[${m.authorName}]: ${m.content}`)
                    .join("\n");

                const prompt =
                    this.settings.intrigueSystemPrompt ||
                    "Return yes or no if the message is worth responding to. Answer with only 'yes' or 'no'.";
                const messages = [
                    { role: "system", content: prompt },
                    {
                        role: "user",
                        content: `Recent conversation:\n${recentMessages}`
                    },
                    {
                        role: "user",
                        content: `Current message: ${content}`
                    }
                ];
                try {
                    const result = await this.callOpenAiChatApi(
                        messages,
                        this.settings.intrigueAiModel,
                        100,
                        { temperature: 0.0, top_p: 1.0 }
                    );
                    return result && result.toLowerCase().includes("yes");
                } catch (err) {
                    console.error("Intrigue check error:", err);
                    return false;
                }
            } else if (this.settings.useIntriguingCheck) {
                if (content.includes("?") || content.split(/\s+/).length > 10) return true;
                const triggers = this.settings.triggerWords
                    .split(",")
                    .map((t) => t.trim().toLowerCase())
                    .filter(Boolean);
                for (const t of triggers) {
                    if (content.toLowerCase().includes(t)) return true;
                }
                return false;
            }
            return Math.random() < 0.5;
        }
        return false;
    }

    startProactiveChecking() {
        if (this._proactiveCheckInterval) return;
        this._proactiveCheckInterval = setInterval(() => {
            if (!this.settings.autopilotEnabled) return;
            this.checkProactiveMessages();
        }, 60000);
    }

    stopProactiveChecking() {
        if (this._proactiveCheckInterval) {
            clearInterval(this._proactiveCheckInterval);
            this._proactiveCheckInterval = null;
        }
    }

    checkProactiveMessages() {
        const now = new Date();
        const currentTimeStr = now.toTimeString().slice(0, 5);
        const startStr = this.settings.proactiveActiveTimeStart || "07:00";
        const endStr = this.settings.proactiveActiveTimeEnd || "17:00";
        if (!this.isTimeInRange(currentTimeStr, startStr, endStr)) {
            return;
        }
        for (const channelId of this.settings.proactiveModeChannels) {
            if (!this.isChannelWhitelisted(channelId)) continue;
            const channelMsgs = this.shortTermMemory.filter((m) => m.channelId === channelId);
            let lastMsgTime = 0;
            if (channelMsgs.length > 0) {
                lastMsgTime = channelMsgs[channelMsgs.length - 1].timestamp;
            } else {
                const MessageStore = BdApi.findModuleByProps("getMessages");
                if (!MessageStore) continue;
                const bdMessagesObj = MessageStore.getMessages?.(channelId);
                if (!bdMessagesObj) continue;
                const bdMessages = bdMessagesObj.toArray?.() || [];
                if (bdMessages.length === 0) {
                    lastMsgTime = 0;
                } else {
                    const lastBDMsg = bdMessages[bdMessages.length - 1];
                    if (lastBDMsg.timestamp?._d instanceof Date) {
                        lastMsgTime = lastBDMsg.timestamp._d.getTime();
                    } else {
                        lastMsgTime = lastBDMsg.timestamp;
                    }
                }
            }
            const diff = Date.now() - lastMsgTime;
            if (!(channelId in this.nextProactiveWait)) {
                this.nextProactiveWait[channelId] = this.randomProactiveWait();
            }
            if (diff >= this.nextProactiveWait[channelId]) {
                this.triggerProactiveMessage(channelId).catch((err) =>
                    console.error("[AutoPilot] Proactive error:", err)
                );
                delete this.nextProactiveWait[channelId];
            }
        }
    }

    triggerProactiveMessage(channelId) {
        const channelMsgs = this.shortTermMemory.filter((m) => m.channelId === channelId);
        let systemContent = "";
        if (channelMsgs.length === 0) {
            systemContent = `The current channel is ${channelId}. You should do a friendly check-in or conversation starter.`;
        } else {
            systemContent =
                "You should do a friendly check-in or conversation starter. Use a proactive, casual tone.";
        }
        this.shortTermMemoryPush({
            channelId,
            role: "system",
            content: systemContent,
            ephemeral: true,
            timestamp: Date.now(),
            messageId: this.generateUniqueId()
        });
        const dedupeKey = `${channelId}~proactive~${Date.now()}`;
        const originalInstancing = this.settings.disableChannelInstancingForMemories;
        this.settings.disableChannelInstancingForMemories = false;

        return this.handleReplyFlow(channelId, "", dedupeKey, "proactive").finally(() => {
            this.settings.disableChannelInstancingForMemories = originalInstancing;
        });
    }

    randomProactiveWait() {
        const min = this.settings.proactiveWaitMinMs;
        const max = this.settings.proactiveWaitMaxMs;
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }

    isTimeInRange(current, start, end) {
        return current >= start && current <= end;
    }

    patchSendMessages() {
        if (!this.sendMessageModule) return;
        const un = BdApi.Patcher.before(
            this.getName(),
            this.sendMessageModule,
            "sendMessage",
            (_, args) => {
                const [channelId, msgObj] = args;
                if (!this.settings.autopilotEnabled) return;
                if (!this.isChannelWhitelisted(channelId)) return;
                if (!msgObj?.content) return;
                if (msgObj.skipMemory) return;

                const c = msgObj.content.trim();
                const authorId = this.currentUserId || "me";
                const authorName = this.currentUserName || "Me";

                this.shortTermMemoryPush({
                    channelId,
                    role: "assistant",
                    authorId,
                    authorName,
                    content: c,
                    timestamp: Date.now(),
                    messageId: `out_${Date.now()}`
                });
                this.checkAndStoreGlobalMemory(authorId, authorName, c);
            }
        );
        this._unpatches.push(un);
    }

    patchChannelTextArea() {
        const ChannelTextArea = BdApi.findModule((m) => {
            return m?.type?.render?.toString?.()?.includes?.("CHANNEL_TEXT_AREA");
        });
        if (!ChannelTextArea) {
            BdApi.showToast("[AutoPilot] Cannot find ChannelTextArea module.", { type: "error" });
            return;
        }
        const un = BdApi.Patcher.after(
            this.getName(),
            ChannelTextArea.type,
            "render",
            (that, [props], ret) => {
                try {
                    const chatBar = this.findInTree(
                        ret,
                        (node) =>
                            Array.isArray(node?.children) &&
                            node.children.some((c) => c?.props?.className?.includes("attachButton")),
                        ["children", "props"]
                    );
                    if (!chatBar) return;
                    const textAreaState = this.findInTree(
                        chatBar,
                        (node) => node?.props?.channel,
                        ["children"]
                    );
                    if (!textAreaState?.props?.channel) return;
                    const channel = textAreaState.props.channel;
                    chatBar.children.splice(
                        -1,
                        0,
                        BdApi.React.createElement(
                            "div",
                            { style: { display: "flex", gap: "4px" } },
                            BdApi.React.createElement(WhitelistToggleButton, {
                                channel,
                                plugin: this
                            }),
                            BdApi.React.createElement(ProactiveModeToggleButton, {
                                channel,
                                plugin: this
                            })
                        )
                    );
                } catch (err) {
                    console.error("[AutoPilot] patchChannelTextArea error:", err);
                }
            }
        );
        this._unpatches.push(un);
    }

    shortTermMemoryPush(msg) {
        if (msg.content) {
            msg.content = this.stripWatermark(msg.content);
        }
        this.shortTermMemory.push(msg);
        const count = this.shortTermMemory.filter((m) => m.channelId === msg.channelId).length;
        if (count > this.settings.shortTermMemoryLimit) {
            this.processShortTermMemoryForChannel(msg.channelId).catch((err) =>
                console.error("[AutoPilot] Error processing short-term memory:", err)
            );
        }
    }

    addImportantMemory(content) {
        if (!this.settings.importantMemoryEnabled) return;
        while (this.importantMemory.length >= this.settings.importantMemoryLimit) {
            this.importantMemory.shift();
        }
        this.importantMemory.push({ content, timestamp: Date.now() });
        this.saveAllMemoriesToFile();
    }

    checkAndStoreGlobalMemory(authorId, authorName, content) {
        const lower = content.toLowerCase();
        if (
            lower.includes("add to global memory:") ||
            lower.includes("i consent to add this to global memory:")
        ) {
            let raw = "";
            const idx1 = lower.indexOf("add to global memory:");
            if (idx1 >= 0) {
                raw = content.slice(idx1 + "add to global memory:".length).trim();
            }
            const idx2 = lower.indexOf("i consent to add this to global memory:");
            if (idx2 >= 0) {
                raw = content.slice(
                    idx2 + "i consent to add this to global memory:".length
                ).trim();
            }
            if (!raw) raw = content;
            const rec = {
                id: this.generateUniqueId(),
                authorId,
                authorName,
                content: raw,
                timestamp: Date.now()
            };
            this.globalMemory.push(rec);
            this.saveAllMemoriesToFile();
            BdApi.showToast("Global memory entry added.", { type: "info" });
        }
    }

    isChannelWhitelisted(channelId) {
        return this.settings.whitelist.includes(channelId);
    }

    isMyUserId(authorId) {
        return authorId && authorId === this.currentUserId;
    }

    normalizeContent(txt) {
        let out = txt.replace(/\s+/g, " ");
        out = out.replace(/([\?\!\.])\1+/g, "$1");
        return out.trim();
    }

    stripMetadata(text) {
        return text.replace(/\[[^\]]+\]\s*(?:\[[^\]]+\]\s*)?:\s*/gm, "");
    }

    stripWatermark(text) {
        const watermark = "\n-# " + this.settings.aiWatermarkText;
        if (text.endsWith(watermark)) {
            return text.slice(0, text.length - watermark.length);
        }
        return text;
    }

    generateUniqueId() {
        return Date.now().toString(36) + Math.random().toString(36).substring(2);
    }

    isDuplicateMessage(key) {
        const now = Date.now();
        const t = this.respondedRecently.get(key);
        if (t && now - t < this.settings.dedupeSeconds * 1000) {
            return true;
        }
        return false;
    }

    markAsResponded(key) {
        this.respondedRecently.set(key, Date.now());
    }

    canRespondNow(channelId) {
        const cd = this.settings.responseCooldownMs;
        const globalCd = this.settings.globalResponseCooldownMs;
        const now = Date.now();
        const lastChannel = this.lastResponseTimestamps[channelId] || 0;
        const lastGlobal = this.lastGlobalResponseTimestamp || 0;
        return now - lastChannel >= cd && now - lastGlobal >= globalCd;
    }

    async waitForUserTypingToPause(channelId, userId) {
        const key = `${channelId}_${userId}`;
        let lastMsgTime = this.lastUserMessage.get(key) || Date.now();
        while (true) {
            await this.sleep(100);
            const currentMsgTime = this.lastUserMessage.get(key) || lastMsgTime;
            if (currentMsgTime > lastMsgTime) {
                lastMsgTime = currentMsgTime;
            }
            if (Date.now() - lastMsgTime >= 2000) {
                return;
            }
        }
    }

    sleep(ms) {
        return new Promise((res) => setTimeout(res, ms));
    }

    buildShortTermConversation(channelId, upToTime, limit = 10) {
        let allMsgs;
        if (this.settings.disableChannelInstancingForMemories) {
            allMsgs = this.shortTermMemory.filter((m) => m.timestamp <= upToTime);
        } else {
            allMsgs = this.shortTermMemory.filter(
                (m) => m.channelId === channelId && m.timestamp <= upToTime
            );
        }
        allMsgs.sort((a, b) => a.timestamp - b.timestamp);
        if (this.settings.disableChannelInstancingForMemories) {
            const sameChannel = allMsgs.filter((m) => m.channelId === channelId);
            if (sameChannel.length > 0) {
                const lastInitiatingMsg = sameChannel[sameChannel.length - 1];
                allMsgs = allMsgs.filter((m) => m !== lastInitiatingMsg);
                allMsgs.push(lastInitiatingMsg);
            }
        }
        if (limit > 0) {
            allMsgs = allMsgs.slice(-limit);
        }
        const conversationArray = [];
        for (const m of allMsgs) {
            const item = {
                role: m.ephemeral ? "system" : m.role,
                content: "",
                channelId: m.channelId,
                authorName: m.authorName
            };
            if (m.ephemeral) {
                item.content = m.content;
            } else {
                let context = `[${m.authorName} (ID: ${m.authorId})]`;
                if (this.settings.disableChannelInstancingForMemories && m.channelId) {
                    context += ` [Channel: ${m.channelId}]`;
                }
                if (m.type === "image" && m.imageUrl) {
                    const msgContent = [];
                    if (m.content && m.content.trim() !== "") {
                        msgContent.push({
                            type: "text",
                            text: `${context}: ${m.content}`
                        });
                    } else {
                        msgContent.push({
                            type: "text",
                            text: context
                        });
                    }
                    msgContent.push({
                        type: "image_url",
                        image_url: { url: m.imageUrl }
                    });
                    item.content = msgContent;
                } else {
                    item.content = `${context}: ${m.content}`;
                }
            }
            conversationArray.push(item);
        }
        return conversationArray;
    }

    async alreadyAnsweredCheck(channelId, newUserMsg) {
        const shortTermArray = this.buildShortTermConversation(channelId, Date.now(), 10);
        const conversation = shortTermArray.map((m) => m.content).join("\n");
        const sysPrompt = `
You are a specialized conversation analyzer. You have a transcript of a recent conversation 
between a user and an assistant, followed by a new user message.

Your task:
1. Determine if the new user message has already been fully addressed or answered by the assistant's prior responses.
2. If yes, respond "yes". Otherwise, respond "no".

Only output "yes" or "no".
        `.trim();
        const reply = await this.callOpenAiChatApi(
            [{ role: "system", content: sysPrompt }, {
                role: "user",
                content: `
Conversation so far:
${conversation}
New user message:
${newUserMsg}`
            }],
            "gpt-4o-mini",
            100,
            { temperature: 0.0, top_p: 1.0 }
        );
        if (!reply) return false;
        const normalized = reply.trim().toLowerCase();
        return normalized.includes("yes");
    }

    async simulateTypingAndSend(channelId, text, processingStartTime) {
        if (!this.sendMessageModule || !text) return;
        const base = parseInt(this.settings.wpm, 10) || 100;
        const varWpm = parseInt(this.settings.wpmVariance, 10) || 5;
        const actual = base + (Math.random() * (varWpm * 2) - varWpm);
        const words = text.split(/\s+/).filter(Boolean).length;
        const totalMsExpected = (words / actual) * 60000;
        const elapsed = Date.now() - processingStartTime;
        const remainingDelay = totalMsExpected - elapsed;

        if (this.settings.enableTypingIndicator && this.typingModule) {
            this.typingModule.startTyping(channelId);
            const typingInterval = setInterval(() => {
                try {
                    this.typingModule.startTyping(channelId);
                } catch (_) {}
            }, 5000);
            if (remainingDelay > 0) {
                await this.sleep(remainingDelay);
            }
            clearInterval(typingInterval);
            const finalText = this.appendWatermark(text);
            await this.sendMessageModule.sendMessage(channelId, { content: finalText });
            try {
                this.typingModule.stopTyping(channelId);
            } catch (_) {}
        } else {
            if (remainingDelay > 0) {
                await this.sleep(remainingDelay);
            }
            const finalText = this.appendWatermark(text);
            await this.sendMessageModule.sendMessage(channelId, { content: finalText });
        }
    }

    async sendMessageInChunks(channelId, text, processingStartTime) {
        if (!this.sendMessageModule || !text) return;
        const base = parseInt(this.settings.wpm, 10) || 100;
        const varWpm = parseInt(this.settings.wpmVariance, 10) || 5;
        const actual = base + (Math.random() * (varWpm * 2) - varWpm);
        const words = text.split(/\s+/).filter(Boolean).length;
        const totalMsExpected = (words / actual) * 60000;
        const elapsed = Date.now() - processingStartTime;
        const remainingDelay = totalMsExpected - elapsed;

        if (remainingDelay > 0) {
            await this.sleep(remainingDelay);
        }
        const segments = this.chunkTextByWords(text, 60);
        for (const seg of segments) {
            await this.sendMessageModule.sendMessage(channelId, { content: seg });
            await this.sleep(100);
        }
    }

    chunkTextByWords(text, chunkSize = 60) {
        const words = text.split(/\s+/);
        const chunks = [];
        let current = "";
        for (const w of words) {
            const potential = current ? `${current} ${w}` : w;
            if (potential.length <= chunkSize) {
                current = potential;
            } else {
                if (current) chunks.push(current);
                if (w.length > chunkSize) {
                    chunks.push(w);
                    current = "";
                } else {
                    current = w;
                }
            }
        }
        if (current) chunks.push(current);
        return chunks;
    }

    getLocalUserPresenceString() {
        if (!this.PresenceStore || !this.currentUserId) {
            return "streaming nothing, playing nothing, and listening to nothing";
        }
        const activities = this.PresenceStore.getActivities(this.currentUserId) || [];
        let streamingPart = "streaming nothing";
        let playingPart = "playing nothing";
        let listeningPart = "listening to nothing";

        for (const act of activities) {
            switch (act.type) {
                case 1:
                    streamingPart = `streaming ${act.name || "something"}`;
                    break;
                case 0:
                    playingPart = `playing ${act.name || "something"}`;
                    break;
                case 2:
                    if (act.name?.toLowerCase() === "spotify") {
                        const track = act.details || "unknown track";
                        const artist = act.state || "unknown artist";
                        listeningPart = `listening to "${track}" by ${artist} on Spotify`;
                    } else {
                        listeningPart = `listening to ${act.name || "something"}`;
                    }
                    break;
                default:
                    break;
            }
        }
        return `${streamingPart}, ${playingPart}, and ${listeningPart}`;
    }

    getChannelObject(channelId) {
        const ChannelStore = BdApi.findModuleByProps("getChannel", "getDMFromUserId");
        if (ChannelStore) {
            return ChannelStore.getChannel(channelId);
        }
        return null;
    }

    toggleChannelWhitelist(channelId) {
        const idx = this.settings.whitelist.indexOf(channelId);
        if (idx >= 0) {
            this.settings.whitelist.splice(idx, 1);
            BdApi.showToast(`Removed ${channelId} from AutoPilot whitelist.`, { type: "info" });
        } else {
            this.settings.whitelist.push(channelId);
            BdApi.showToast(`Added ${channelId} to AutoPilot whitelist.`, { type: "info" });
        }
        this.saveSettings();
    }

    toggleChannelProactiveMode(channelId) {
        const idx = this.settings.proactiveModeChannels.indexOf(channelId);
        if (idx >= 0) {
            this.settings.proactiveModeChannels.splice(idx, 1);
            BdApi.showToast(`Removed ${channelId} from Proactive mode.`, { type: "info" });
        } else {
            this.settings.proactiveModeChannels.push(channelId);
            BdApi.showToast(`Added ${channelId} to Proactive mode.`, { type: "info" });
        }
        this.saveSettings();
    }

    findInTree(tree, filter, walkable = []) {
        if (!tree || typeof tree !== "object") return null;
        if (filter(tree)) return tree;
        if (Array.isArray(tree)) {
            for (const child of tree) {
                const found = this.findInTree(child, filter, walkable);
                if (found) return found;
            }
        } else {
            for (const key in tree) {
                if (walkable.length && !walkable.includes(key)) continue;
                if (Object.prototype.hasOwnProperty.call(tree, key)) {
                    const found = this.findInTree(tree[key], filter, walkable);
                    if (found) return found;
                }
            }
        }
        return null;
    }

    openMemoryBrowser() {
        const overlay = document.createElement("div");
        overlay.style.position = "fixed";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100vw";
        overlay.style.height = "100vh";
        overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
        overlay.style.display = "flex";
        overlay.style.justifyContent = "center";
        overlay.style.alignItems = "center";
        overlay.style.zIndex = "9999";

        const modal = document.createElement("div");
        modal.style.background = "var(--background-secondary)";
        modal.style.border = "1px solid var(--background-modifier-accent)";
        modal.style.borderRadius = "4px";
        modal.style.padding = "16px";
        modal.style.maxHeight = "80vh";
        modal.style.maxWidth = "80vw";
        modal.style.overflowY = "auto";

        const title = document.createElement("h2");
        title.innerText = "Channel Memory Browser";
        title.style.color = "var(--text-normal)";
        modal.appendChild(title);

        const closeButton = document.createElement("button");
        closeButton.innerText = "Close";
        closeButton.style.marginBottom = "12px";
        closeButton.onclick = () => {
            document.body.removeChild(overlay);
        };
        modal.appendChild(closeButton);

        const channelEntries = [...this.mediumTermMemory, ...this.longTermMemory];
        channelEntries.sort((a, b) => a.timestamp - b.timestamp);

        if (channelEntries.length === 0) {
            const noEntries = document.createElement("div");
            noEntries.innerText = "No channel memory entries.";
            noEntries.style.color = "var(--text-normal)";
            modal.appendChild(noEntries);
        } else {
            channelEntries.forEach((entry) => {
                const entryDiv = document.createElement("div");
                entryDiv.style.border = "1px solid var(--background-modifier-accent)";
                entryDiv.style.borderRadius = "4px";
                entryDiv.style.padding = "8px";
                entryDiv.style.marginBottom = "8px";
                entryDiv.style.background = "var(--background-tertiary)";

                const header = document.createElement("div");
                header.style.display = "flex";
                header.style.justifyContent = "space-between";
                header.style.alignItems = "center";
                header.style.marginBottom = "4px";

                const info = document.createElement("span");
                info.innerText = `${new Date(entry.timestamp).toLocaleString()} - ${entry.authorName} [${entry.type}] [Channel:${entry.channelId}]`;
                info.style.color = "var(--text-normal)";
                header.appendChild(info);

                const deleteBtn = document.createElement("button");
                deleteBtn.innerText = "Delete";
                deleteBtn.onclick = () => {
                    if (entry.type === "medium_summary") {
                        this.mediumTermMemory = this.mediumTermMemory.filter((m) => m.id !== entry.id);
                    } else if (entry.type === "long_summary") {
                        this.longTermMemory = this.longTermMemory.filter((m) => m.id !== entry.id);
                    }
                    this.saveAllMemoriesToFile();
                    entryDiv.remove();
                };
                header.appendChild(deleteBtn);

                entryDiv.appendChild(header);

                const content = document.createElement("div");
                content.innerText = entry.content;
                content.style.color = "var(--text-normal)";
                entryDiv.appendChild(content);

                modal.appendChild(entryDiv);
            });
        }

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }

    openGlobalMemoryBrowser() {
        const overlay = document.createElement("div");
        overlay.style.position = "fixed";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100vw";
        overlay.style.height = "100vh";
        overlay.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
        overlay.style.display = "flex";
        overlay.style.justifyContent = "center";
        overlay.style.alignItems = "center";
        overlay.style.zIndex = "9999";

        const modal = document.createElement("div");
        modal.style.background = "var(--background-secondary)";
        modal.style.border = "1px solid var(--background-modifier-accent)";
        modal.style.borderRadius = "4px";
        modal.style.padding = "16px";
        modal.style.maxHeight = "80vh";
        modal.style.maxWidth = "80vw";
        modal.style.overflowY = "auto";

        const title = document.createElement("h2");
        title.innerText = "Global Memory Browser";
        title.style.color = "var(--text-normal)";
        modal.appendChild(title);

        const closeButton = document.createElement("button");
        closeButton.innerText = "Close";
        closeButton.style.marginBottom = "12px";
        closeButton.onclick = () => {
            document.body.removeChild(overlay);
        };
        modal.appendChild(closeButton);

        if (this.globalMemory.length === 0) {
            const noEntries = document.createElement("div");
            noEntries.innerText = "No global memory entries.";
            noEntries.style.color = "var(--text-normal)";
            modal.appendChild(noEntries);
        } else {
            this.globalMemory.forEach((entry) => {
                const entryDiv = document.createElement("div");
                entryDiv.style.border = "1px solid var(--background-modifier-accent)";
                entryDiv.style.borderRadius = "4px";
                entryDiv.style.padding = "8px";
                entryDiv.style.marginBottom = "8px";
                entryDiv.style.background = "var(--background-tertiary)";

                const header = document.createElement("div");
                header.style.display = "flex";
                header.style.justifyContent = "space-between";
                header.style.alignItems = "center";
                header.style.marginBottom = "4px";

                const info = document.createElement("span");
                info.innerText = `${new Date(entry.timestamp).toLocaleString()} - ${entry.authorName}`;
                info.style.color = "var(--text-normal)";
                header.appendChild(info);

                const deleteBtn = document.createElement("button");
                deleteBtn.innerText = "Delete";
                deleteBtn.onclick = () => {
                    this.globalMemory = this.globalMemory.filter((m) => m.id !== entry.id);
                    this.saveAllMemoriesToFile();
                    entryDiv.remove();
                };
                header.appendChild(deleteBtn);

                entryDiv.appendChild(header);

                const content = document.createElement("div");
                content.innerText = entry.content;
                content.style.color = "var(--text-normal)";
                entryDiv.appendChild(content);

                modal.appendChild(entryDiv);
            });
        }

        overlay.appendChild(modal);
        document.body.appendChild(overlay);
    }

    getSettingsPanel() {
        if (this._duplicateInstance) {
            const div = document.createElement("div");
            div.style.padding = "16px";
            div.innerText = `This copy of AutoPilot is disabled (duplicate for user: ${this.currentUserName}).`;
            return div;
        }
        if (!document.getElementById("autopilot-css")) {
            BdApi.injectCSS(
                "autopilot-css",
                `
            .autopilot-settings-panel {
                background: var(--background-secondary);
                border: 1px solid var(--background-modifier-accent);
                border-radius: 4px;
                padding: 16px;
                color: var(--text-normal);
            }
            .autopilot-settings-panel label {
                font-weight: 600;
                color: var(--text-normal);
            }
            .autopilot-settings-panel input,
            .autopilot-settings-panel textarea,
            .autopilot-settings-panel select {
                background: var(--background-tertiary);
                border: 1px solid var(--background-modifier-accent);
                color: var(--text-normal);
                border-radius: 4px;
                padding: 4px 8px;
            }
            .autopilot-settings-panel button {
                background: var(--background-tertiary);
                border: 1px solid var(--background-modifier-accent);
                color: var(--text-normal);
                border-radius: 4px;
                padding: 4px 8px;
                cursor: pointer;
            }
            .autopilot-settings-panel hr {
                border: none;
                border-top: 1px solid var(--background-modifier-accent);
                margin: 12px 0;
            }
        `
            );
        }

        const panel = document.createElement("div");
        panel.className = "autopilot-settings-panel";
        panel.style.display = "flex";
        panel.style.flexDirection = "column";
        panel.style.gap = "12px";

        panel.appendChild(
            this.createTextField(
                "Owner ID",
                "Set your Discord user ID for owner commands.",
                this.settings.ownerId,
                (val) => {
                    this.settings.ownerId = val.trim();
                    this.saveSettings();
                }
            )
        );
        panel.appendChild(
            this.createToggle(
                "Use Global Config",
                "Share config across all accounts or keep separate.",
                this.settings.useGlobalConfig,
                (ch) => {
                    this.settings.useGlobalConfig = ch;
                    this.saveGlobalScopeConfigFlag();
                    this.loadSettings();
                    this.loadAllMemoriesFromFile();
                    BdApi.showToast(`Scope changed. Now using ${ch ? "GLOBAL" : "PER-USER"} scope.`, {
                        type: "info"
                    });
                }
            )
        );
        panel.appendChild(
            this.createToggle(
                "Autopilot Enabled",
                "Master toggle for this user.",
                this.settings.autopilotEnabled,
                (ch) => {
                    this.settings.autopilotEnabled = ch;
                    this.saveSettings();
                }
            )
        );
        panel.appendChild(
            this.createToggle(
                "Enable AI Watermark",
                "Appends a watermark to each outgoing AI-generated message.",
                this.settings.aiWatermarkEnabled,
                (ch) => {
                    this.settings.aiWatermarkEnabled = ch;
                    this.saveSettings();
                }
            )
        );
        panel.appendChild(
            this.createTextField(
                "AI Watermark Text",
                "Text used for watermark.",
                this.settings.aiWatermarkText,
                (val) => {
                    this.settings.aiWatermarkText = val;
                    this.saveSettings();
                }
            )
        );
        panel.appendChild(
            this.createNumberInput(
                "Per-Channel Response Cooldown (ms)",
                "Minimum time between responses in the same channel.",
                this.settings.responseCooldownMs,
                0,
                60000,
                (num) => {
                    this.settings.responseCooldownMs = num;
                    this.saveSettings();
                }
            )
        );
        panel.appendChild(
            this.createNumberInput(
                "Global Response Cooldown (ms)",
                "Minimum time between responses across all channels.",
                this.settings.globalResponseCooldownMs,
                0,
                60000,
                (num) => {
                    this.settings.globalResponseCooldownMs = num;
                    this.saveSettings();
                }
            )
        );
        panel.appendChild(
            this.createNumberInput(
                "Typing Speed (WPM)",
                "Words per minute for simulated typing.",
                this.settings.wpm,
                10,
                2000,
                (num) => {
                    this.settings.wpm = num;
                    this.saveSettings();
                }
            )
        );
        panel.appendChild(
            this.createNumberInput(
                "WPM Variance",
                "Random +/- to WPM for variation.",
                this.settings.wpmVariance,
                0,
                50,
                (num) => {
                    this.settings.wpmVariance = num;
                    this.saveSettings();
                }
            )
        );
        panel.appendChild(
            this.createToggle(
                "Enable Typing Indicator",
                "Starts typing indicator while 'thinking'.",
                this.settings.enableTypingIndicator,
                (ch) => {
                    this.settings.enableTypingIndicator = ch;
                    this.saveSettings();
                }
            )
        );
        panel.appendChild(
            this.createToggle(
                "Enable Chunking",
                "Split longer replies into multiple messages.",
                this.settings.enableChunking,
                (ch) => {
                    this.settings.enableChunking = ch;
                    this.saveSettings();
                }
            )
        );
        panel.appendChild(
            this.createTextField(
                "OpenAI API Key",
                "Used for GPT-based replies & embeddings.",
                this.settings.openAiApiKey,
                (val) => {
                    this.settings.openAiApiKey = val.trim();
                    this.saveSettings();
                }
            )
        );
        panel.appendChild(
            this.createTextField(
                "Perplexity API Token",
                "Used for /search. Leave blank if not needed.",
                this.settings.perplexityApiToken,
                (val) => {
                    this.settings.perplexityApiToken = val.trim();
                    this.saveSettings();
                }
            )
        );
        panel.appendChild(
            this.createTextField(
                "Reply Model",
                "Main model for AI replies (e.g. gpt-3.5-turbo).",
                this.settings.llmModel,
                (val) => {
                    this.settings.llmModel = val.trim() || "gpt-3.5-turbo";
                    this.saveSettings();
                }
            )
        );
        panel.appendChild(
            this.createTextArea(
                "System Prompt",
                "Base instructions for the AI.",
                this.settings.systemPrompt,
                (txt) => {
                    this.settings.systemPrompt = txt;
                    this.saveSettings();
                }
            )
        );
        panel.appendChild(
            this.createToggle(
                "Use Memory Summaries",
                "Automated summarization of short->medium->long logs.",
                this.settings.useMemorySummaries,
                (ch) => {
                    this.settings.useMemorySummaries = ch;
                    this.saveSettings();
                }
            )
        );
        if (this.settings.useMemorySummaries) {
            panel.appendChild(
                this.createTextField(
                    "Summary Model",
                    "Model for summarizing (e.g. gpt-4o-mini).",
                    this.settings.summaryModel,
                    (val) => {
                        this.settings.summaryModel = val.trim() || "gpt-4o-mini";
                        this.saveSettings();
                    }
                )
            );
            panel.appendChild(
                this.createNumberInput(
                    "Short-Term Memory Limit (msgs)",
                    "Max messages before summarizing to medium-term.",
                    this.settings.shortTermMemoryLimit,
                    1,
                    100,
                    (num) => {
                        this.settings.shortTermMemoryLimit = num;
                        this.saveSettings();
                    }
                )
            );
            panel.appendChild(
                this.createNumberInput(
                    "Short-Term Memory Retention (msgs)",
                    "Messages retained in short-term after summarizing.",
                    this.settings.shortTermMemoryRetention,
                    0,
                    50,
                    (num) => {
                        this.settings.shortTermMemoryRetention = num;
                        this.saveSettings();
                    }
                )
            );
            panel.appendChild(
                this.createNumberInput(
                    "Medium-Term Memory Trigger (count)",
                    "Number of medium summaries before pushing to long-term.",
                    this.settings.mediumTermMemoryTriggerCount,
                    1,
                    50,
                    (num) => {
                        this.settings.mediumTermMemoryTriggerCount = num;
                        this.saveSettings();
                    }
                )
            );
            panel.appendChild(
                this.createNumberInput(
                    "Medium-Term Memory Limit",
                    "Max medium summaries before purging older ones.",
                    this.settings.mediumTermMemoryLimit,
                    1,
                    100,
                    (num) => {
                        this.settings.mediumTermMemoryLimit = num;
                        this.saveSettings();
                    }
                )
            );
            panel.appendChild(
                this.createNumberInput(
                    "Long-Term Memory Trigger (count)",
                    "Number of long summaries before further summarization.",
                    this.settings.longTermMemoryTriggerCount,
                    1,
                    50,
                    (num) => {
                        this.settings.longTermMemoryTriggerCount = num;
                        this.saveSettings();
                    }
                )
            );
            panel.appendChild(
                this.createNumberInput(
                    "Long-Term Memory Limit",
                    "Max long summaries (-1 for unlimited).",
                    this.settings.longTermMemoryLimit,
                    -1,
                    100,
                    (num) => {
                        this.settings.longTermMemoryLimit = num;
                        this.saveSettings();
                    }
                )
            );
            panel.appendChild(
                this.createNumberInput(
                    "Max Split Char Threshold",
                    "If snippet is larger, attempt LLM-based splitting.",
                    this.settings.maxSplitCharThreshold,
                    500,
                    50000,
                    (num) => {
                        this.settings.maxSplitCharThreshold = num;
                        this.saveSettings();
                    }
                )
            );
        }
        panel.appendChild(
            this.createToggle(
                "Enable Long-Term Memory",
                "Store persistent channel summaries with embeddings.",
                this.settings.longTermStorageEnabled,
                (ch) => {
                    this.settings.longTermStorageEnabled = ch;
                    this.saveSettings();
                }
            )
        );
        panel.appendChild(
            this.createToggle(
                "Disable Channel Instancing for Memories",
                "Merge memory retrieval across channels.",
                this.settings.disableChannelInstancingForMemories,
                (ch) => {
                    this.settings.disableChannelInstancingForMemories = ch;
                    this.saveSettings();
                }
            )
        );
        panel.appendChild(
            this.createButton("Open Memory Browser", "View or remove channel memory data.", () => {
                this.openMemoryBrowser();
            })
        );
        panel.appendChild(
            this.createButton("Open Global Memory", "View or remove global memory entries.", () => {
                this.openGlobalMemoryBrowser();
            })
        );

        panel.appendChild(document.createElement("hr"));
        const impMemHeader = document.createElement("h3");
        impMemHeader.innerText = "Important Memory Settings";
        panel.appendChild(impMemHeader);
        panel.appendChild(
            this.createToggle(
                "Important Memory Enabled",
                "Stores /addmemory data in system prompt.",
                this.settings.importantMemoryEnabled,
                (ch) => {
                    this.settings.importantMemoryEnabled = ch;
                    this.saveSettings();
                }
            )
        );
        panel.appendChild(
            this.createNumberInput(
                "Important Memory Limit",
                "Maximum important memory items to store.",
                this.settings.importantMemoryLimit,
                1,
                100,
                (num) => {
                    this.settings.importantMemoryLimit = num;
                    this.saveSettings();
                }
            )
        );

        const respondModes = ["always", "mention", "random", "human", "attentive"];
        panel.appendChild(
            this.createSelect(
                "Respond Mode",
                "How the AI decides to respond automatically.",
                respondModes,
                this.settings.respondMode,
                (val) => {
                    this.settings.respondMode = val;
                    this.saveSettings();
                }
            )
        );

        if (this.settings.respondMode === "random") {
            panel.appendChild(
                this.createNumberInput(
                    "Respond Chance (%)",
                    "Chance for random mode responses.",
                    Math.floor(this.settings.respondChance * 100),
                    0,
                    100,
                    (v) => {
                        this.settings.respondChance = v / 100;
                        this.saveSettings();
                    }
                )
            );
        }
        if (this.settings.respondMode === "human") {
            panel.appendChild(
                this.createTextField(
                    "Trigger Words",
                    "Comma-separated words for naive checks if AI check is off.",
                    this.settings.triggerWords,
                    (val) => {
                        this.settings.triggerWords = val;
                        this.saveSettings();
                    }
                )
            );
            panel.appendChild(
                this.createToggle(
                    "Naive Intrigue Check",
                    "Checks for '?' or 10+ words if AI check is off.",
                    this.settings.useIntriguingCheck,
                    (ch) => {
                        this.settings.useIntriguingCheck = ch;
                        this.saveSettings();
                    }
                )
            );
        }
        panel.appendChild(
            this.createToggle(
                "Use AI Intrigue Check",
                "Ask a small LLM if message is worth responding to.",
                this.settings.useAiIntrigueCheck,
                (ch) => {
                    this.settings.useAiIntrigueCheck = ch;
                    this.saveSettings();
                }
            )
        );
        if (this.settings.useAiIntrigueCheck) {
            panel.appendChild(
                this.createTextField(
                    "Intrigue AI Model",
                    "Model used for intrigue check (e.g. gpt-4o-mini).",
                    this.settings.intrigueAiModel,
                    (val) => {
                        this.settings.intrigueAiModel = val.trim();
                        this.saveSettings();
                    }
                )
            );
            panel.appendChild(
                this.createTextArea(
                    "Intrigue System Prompt",
                    "Guidance for the intrigue check. The snippet is appended automatically.",
                    this.settings.intrigueSystemPrompt,
                    (val) => {
                        this.settings.intrigueSystemPrompt = val.trim();
                        this.saveSettings();
                    }
                )
            );
        }
        panel.appendChild(
            this.createToggle(
                "Allow Intrigue Sessions",
                "Once 'yes' is returned, keep responding until idle.",
                this.settings.allowIntrigueSessions,
                (ch) => {
                    this.settings.allowIntrigueSessions = ch;
                    this.saveSettings();
                }
            )
        );
        panel.appendChild(
            this.createNumberInput(
                "Session Idle Timeout (ms)",
                "No messages over this interval => session ends.",
                this.settings.sessionIdleMs,
                10000,
                600000,
                (val) => {
                    this.settings.sessionIdleMs = val;
                    this.saveSettings();
                }
            )
        );
        panel.appendChild(
            this.createFloatInput(
                "Reply AI Temperature",
                "Temperature for main replies.",
                this.settings.replyTemperature,
                0,
                1,
                (val) => {
                    this.settings.replyTemperature = val;
                    this.saveSettings();
                }
            )
        );
        panel.appendChild(
            this.createFloatInput(
                "Reply AI Top_P",
                "Top_P for main replies.",
                this.settings.replyTopP,
                0,
                1,
                (val) => {
                    this.settings.replyTopP = val;
                    this.saveSettings();
                }
            )
        );
        panel.appendChild(
            this.createFloatInput(
                "Other AI Temperature",
                "Temperature for summarization & intrigue checks.",
                this.settings.otherTemperature,
                0,
                1,
                (val) => {
                    this.settings.otherTemperature = val;
                    this.saveSettings();
                }
            )
        );
        panel.appendChild(
            this.createFloatInput(
                "Other AI Top_P",
                "Top_P for summarization & intrigue checks.",
                this.settings.otherTopP,
                0,
                1,
                (val) => {
                    this.settings.otherTopP = val;
                    this.saveSettings();
                }
            )
        );

        panel.appendChild(document.createElement("hr"));
        const proHeader = document.createElement("h3");
        proHeader.innerText = "Proactive Mode";
        panel.appendChild(proHeader);

        panel.appendChild(
            this.createNumberInput(
                "Proactive Wait Minimum (minutes)",
                "Minimum inactivity before a check-in.",
                Math.round(this.settings.proactiveWaitMinMs / 60000),
                1,
                1440,
                (val) => {
                    this.settings.proactiveWaitMinMs = val * 60000;
                    this.saveSettings();
                }
            )
        );
        panel.appendChild(
            this.createNumberInput(
                "Proactive Wait Maximum (minutes)",
                "Maximum inactivity before a check-in.",
                Math.round(this.settings.proactiveWaitMaxMs / 60000),
                1,
                1440,
                (val) => {
                    this.settings.proactiveWaitMaxMs = val * 60000;
                    this.saveSettings();
                }
            )
        );

        const statusContainer = document.createElement("div");
        statusContainer.id = "proactiveStatusContainer";
        statusContainer.style.fontSize = "0.9em";
        statusContainer.style.marginTop = "8px";
        statusContainer.style.color = "var(--text-normal)";
        statusContainer.innerText = "Loading proactive status...";
        panel.appendChild(statusContainer);

        const updateProactiveStatus = () => {
            let statusHTML = "";
            for (const channelId of this.settings.proactiveModeChannels) {
                if (!this.isChannelWhitelisted(channelId)) continue;
                let channelName = channelId;
                const channelObj = this.getChannelObject(channelId);
                if (channelObj && channelObj.name) {
                    channelName = channelObj.name;
                }
                let lastMsgTime = 0;
                const channelMsgs = this.shortTermMemory.filter((m) => m.channelId === channelId);
                if (channelMsgs.length > 0) {
                    lastMsgTime = channelMsgs[channelMsgs.length - 1].timestamp;
                } else {
                    lastMsgTime = Date.now();
                }
                if (!(channelId in this.nextProactiveWait)) {
                    this.nextProactiveWait[channelId] = this.randomProactiveWait();
                }
                const waitMs = this.nextProactiveWait[channelId];
                const elapsed = Date.now() - lastMsgTime;
                const remainingMs = Math.max(0, waitMs - elapsed);
                const minutes = Math.floor(remainingMs / 60000);
                const seconds = Math.floor((remainingMs % 60000) / 1000);
                statusHTML += `<div>${channelName}: ${minutes}m ${seconds}s remaining</div>`;
            }
            statusContainer.innerHTML = statusHTML || "No proactive channels active.";
        };
        const statusInterval = setInterval(updateProactiveStatus, 1000);

        panel.appendChild(
            this.createTextField(
                "Proactive Start Time (HH:MM)",
                "Earliest time for proactive mode.",
                this.settings.proactiveActiveTimeStart,
                (val) => {
                    this.settings.proactiveActiveTimeStart = val.trim() || "07:00";
                    this.saveSettings();
                }
            )
        );
        panel.appendChild(
            this.createTextField(
                "Proactive End Time (HH:MM)",
                "Latest time for proactive mode.",
                this.settings.proactiveActiveTimeEnd,
                (val) => {
                    this.settings.proactiveActiveTimeEnd = val.trim() || "17:00";
                    this.saveSettings();
                }
            )
        );

        panel.appendChild(
            this.createNumberInput(
                "Max Split Character Threshold",
                "If a conversation snippet is larger, attempt splitting before summarizing.",
                this.settings.maxSplitCharThreshold,
                500,
                50000,
                (num) => {
                    this.settings.maxSplitCharThreshold = num;
                    this.saveSettings();
                }
            )
        );
        panel.appendChild(
            this.createNumberInput(
                "Max Split Word Threshold",
                "If a snippet is larger in words, attempt splitting before summarizing.",
                this.settings.maxSplitWordThreshold,
                50,
                1000,
                (num) => {
                    this.settings.maxSplitWordThreshold = num;
                    this.saveSettings();
                }
            )
        );

        const disclaim = document.createElement("div");
        disclaim.style.fontSize = "0.85em";
        disclaim.style.color = "var(--text-danger)";
        disclaim.innerText =
            "Warning: Potential TOS issues. Use responsibly. Data is stored locally in autopilot_memories_{UserID}.json.";
        panel.appendChild(disclaim);

        return panel;
    }

    createToggle(labelText, description, currentValue, onChange) {
        const c = document.createElement("div");
        c.style.display = "flex";
        c.style.flexDirection = "column";

        const lbl = document.createElement("label");
        lbl.innerText = labelText;
        c.appendChild(lbl);

        const row = document.createElement("div");
        row.style.display = "flex";
        row.style.alignItems = "center";
        row.style.gap = "8px";
        c.appendChild(row);

        const chk = document.createElement("input");
        chk.type = "checkbox";
        chk.checked = currentValue;
        row.appendChild(chk);

        const desc = document.createElement("span");
        desc.style.fontSize = "0.9em";
        desc.style.opacity = "0.8";
        desc.innerText = description;
        row.appendChild(desc);

        chk.onchange = () => onChange(chk.checked);
        return c;
    }

    createTextField(labelText, description, currentValue, onChange) {
        const c = document.createElement("div");
        c.style.display = "flex";
        c.style.flexDirection = "column";
        c.style.gap = "4px";

        const lbl = document.createElement("label");
        lbl.innerText = labelText;
        c.appendChild(lbl);

        const inp = document.createElement("input");
        inp.type = "text";
        inp.value = currentValue;
        c.appendChild(inp);

        if (description) {
            const d = document.createElement("span");
            d.style.fontSize = "0.9em";
            d.style.opacity = "0.8";
            d.innerText = description;
            c.appendChild(d);
        }

        inp.onchange = () => onChange(inp.value);
        return c;
    }

    createTextArea(labelText, description, currentValue, onChange) {
        const c = document.createElement("div");
        c.style.display = "flex";
        c.style.flexDirection = "column";
        c.style.gap = "4px";

        const lbl = document.createElement("label");
        lbl.innerText = labelText;
        c.appendChild(lbl);

        const ta = document.createElement("textarea");
        ta.rows = 3;
        ta.value = currentValue;
        c.appendChild(ta);

        if (description) {
            const sp = document.createElement("span");
            sp.style.fontSize = "0.9em";
            sp.style.opacity = "0.8";
            sp.innerText = description;
            c.appendChild(sp);
        }

        ta.onchange = () => onChange(ta.value);
        return c;
    }

    createNumberInput(labelText, description, currentValue, minVal, maxVal, onChange) {
        const c = document.createElement("div");
        c.style.display = "flex";
        c.style.flexDirection = "column";
        c.style.gap = "4px";

        const lbl = document.createElement("label");
        lbl.innerText = labelText;
        c.appendChild(lbl);

        const inp = document.createElement("input");
        inp.type = "number";
        inp.value = currentValue;
        inp.min = minVal;
        inp.max = maxVal;
        c.appendChild(inp);

        if (description) {
            const d = document.createElement("span");
            d.style.fontSize = "0.9em";
            d.style.opacity = "0.8";
            d.innerText = description;
            c.appendChild(d);
        }

        inp.onchange = () => {
            const val = parseInt(inp.value, 10);
            if (!isNaN(val)) onChange(val);
        };
        return c;
    }

    createFloatInput(labelText, description, currentValue, minVal, maxVal, onChange) {
        const c = document.createElement("div");
        c.style.display = "flex";
        c.style.flexDirection = "column";
        c.style.gap = "4px";

        const lbl = document.createElement("label");
        lbl.innerText = labelText;
        c.appendChild(lbl);

        const inp = document.createElement("input");
        inp.type = "number";
        inp.value = currentValue;
        inp.min = minVal;
        inp.max = maxVal;
        inp.step = "0.01";
        c.appendChild(inp);

        if (description) {
            const d = document.createElement("span");
            d.style.fontSize = "0.9em";
            d.style.opacity = "0.8";
            d.innerText = description;
            c.appendChild(d);
        }

        inp.onchange = () => {
            const val = parseFloat(inp.value);
            if (!isNaN(val)) onChange(val);
        };
        return c;
    }

    createSelect(labelText, description, options, currentValue, onChange) {
        const c = document.createElement("div");
        c.style.display = "flex";
        c.style.flexDirection = "column";
        c.style.gap = "4px";

        const lbl = document.createElement("label");
        lbl.innerText = labelText;
        c.appendChild(lbl);

        const sel = document.createElement("select");
        for (const op of options) {
            const o = document.createElement("option");
            o.value = op;
            o.innerText = op;
            if (op === currentValue) o.selected = true;
            sel.appendChild(o);
        }
        c.appendChild(sel);

        if (description) {
            const sp = document.createElement("span");
            sp.style.fontSize = "0.9em";
            sp.style.opacity = "0.8";
            sp.innerText = description;
            c.appendChild(sp);
        }

        sel.onchange = () => onChange(sel.value);
        return c;
    }

    createButton(labelText, description, onClick) {
        const c = document.createElement("div");
        c.style.display = "flex";
        c.style.flexDirection = "column";
        c.style.gap = "4px";

        const btn = document.createElement("button");
        btn.innerText = labelText;
        btn.onclick = onClick;
        c.appendChild(btn);

        if (description) {
            const sp = document.createElement("span");
            sp.style.fontSize = "0.9em";
            sp.style.opacity = "0.8";
            sp.innerText = description;
            c.appendChild(sp);
        }
        return c;
    }
};

const React = BdApi.React;
function WhitelistToggleButton({ channel, plugin }) {
    const [tick, setTick] = React.useState(0);
    const inWhitelist = plugin.isChannelWhitelisted(channel.id);

    const handleClick = () => {
        plugin.toggleChannelWhitelist(channel.id);
        setTick((x) => x + 1);
    };

    const label = inWhitelist ? "Remove from AutoPilot" : "Add to AutoPilot";
    return React.createElement(
        "div",
        {
            style: { marginRight: "4px", display: "flex", alignItems: "center" },
            onClick: handleClick
        },
        React.createElement(
            "div",
            {
                style: {
                    width: "24px",
                    height: "24px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: inWhitelist ? "#3ba55d" : "#7289da"
                },
                title: label
            },
            React.createElement("div", {
                style: { width: "20px", height: "20px" },
                dangerouslySetInnerHTML: { __html: plugin.whitelistIcon }
            })
        )
    );
}

function ProactiveModeToggleButton({ channel, plugin }) {
    const [tick, setTick] = React.useState(0);
    const inProactive = plugin.settings.proactiveModeChannels.includes(channel.id);

    const handleClick = () => {
        plugin.toggleChannelProactiveMode(channel.id);
        setTick((x) => x + 1);
    };

    const label = inProactive ? "Disable Proactive Mode" : "Enable Proactive Mode";
    return React.createElement(
        "div",
        {
            style: { marginRight: "8px", display: "flex", alignItems: "center" },
            onClick: handleClick
        },
        React.createElement(
            "div",
            {
                style: {
                    width: "24px",
                    height: "24px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: inProactive ? "#faa61a" : "#7289da"
                },
                title: label
            },
            React.createElement("div", {
                style: { width: "20px", height: "20px" },
                dangerouslySetInnerHTML: { __html: plugin.proactiveIcon }
            })
        )
    );
}
