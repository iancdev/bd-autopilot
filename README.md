# BD-AutoPilot Plugin for BetterDiscord

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/iancdev/BDAutoPilot/releases)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

BD-AutoPilot is a BetterDiscord Plugin that connects OpenAI LLMs with Discord chats, allowing semi-autonomous/full autonomous conversations with users across DMs, group chats and servers. It features human-like interaction with robust memory management, natural speech patterns, and multimodal support.

## Features

### Core Functionality
- **AI-Powered Responses**: Intelligently respond to messages using GPT models
- **Channel Whitelist**: Enable AutoPilot only in specified channels
- **Per-Channel Memory Instancing**: Maintain separate conversational contexts for each channel
- **Configuration Flexibility**: Choose between per-user account settings or global configuration
- **Multiple Response Modes**: Choose how the AI decides when to respond
  - Always, Mention, Random, Human-like, or Attentive modes
- **Proactive Mode**: Allow the AI to initiate conversations in specific channels
- **Typing Indicators**: Realistic typing simulation with adjustable speed
- **Message Chunking**: Split longer replies into multiple messages

### Memory Management
- **Robust Multi-tiered Memory System**:
  - Short-term memory for recent conversations
  - Medium-term memory for important context
  - Long-term memory with semantic search capabilities
  - Global memory for cross-channel information
  - Important memory for critical details
  - Personality memory to maintain consistent persona
- **Vector-Based Memory Retrieval**: Enables unlimited memory retrieval and infinite conversational context without impacting token usage
- **Contextual Awareness**: Allows for conversational references from any point in the past
- **Automated Summarization**: Condense conversations for efficient storage
- **Semantic Search**: Find relevant memories using embeddings
- **Owner Commands**: Special commands for memory management

### Advanced Features
- **Intelligent Tool Capabilities**: 
  - Built-in `/search` command using Perplexity API for real-time data retrieval
  - Intelligent message splitting for natural conversation flow
- **Human-like Interaction**:
  - Natural speech patterns and reply cadence
  - Automatic human-like response decision making
  - Multimodal support for rich media interactions
- **Memory Commands**: Add important information with `/addmemory`
- **AI Watermarking**: Optional disclosure for AI-generated messages
- **Adjustable Response Parameters**: Fine-tune temperature and other model settings
- **Privacy Controls**: Local storage for all memory and configurations

## Requirements

- BetterDiscord installed ([Installation Guide](https://betterdiscord.app/))
- OpenAI API key for GPT model access
- (Optional) Perplexity API token for web search functionality

## Installation

1. Download the `AutoPilot.plugin.js` file
2. Place it in your BetterDiscord plugins folder:
   - Windows: `%AppData%\BetterDiscord\plugins\`
   - Mac: `~/Library/Application Support/BetterDiscord/plugins/`
   - Linux: `~/.config/BetterDiscord/plugins/`
3. Enable the plugin in BetterDiscord settings
4. Configure your API keys and preferences

## Configuration

### Basic Setup
1. Open Discord Settings > Plugins
2. Find AutoPilot and click the gear icon
3. Choose between per-user or global configuration (affects all accounts)
4. Enter your OpenAI API key
5. (Optional) Enter your Perplexity API token for search functionality
6. Adjust system prompt and other settings
7. Toggle "Autopilot Enabled" to activate

### Channel Management
- Click the checklist icon in any channel to add/remove from whitelist
- Click the clock icon to enable/disable proactive mode for that channel

### Response Settings
- **Response Mode**: Choose how the AI decides when to respond
  - `always`: Respond to all messages
  - `mention`: Only respond when mentioned
  - `random`: Random chance to respond based on percentage
  - `human`: Intelligent response based on message content
  - `attentive`: Wait for user to finish typing before responding
- **AI Temperature**: Control creativity vs. determinism (0.0-1.0)
- **AI Top_P**: Adjust token selection strategy (0.0-1.0)

### Memory Settings
- **Short-Term Memory Limit**: Maximum messages before summarization
- **Medium-Term Memory Trigger**: When to condense medium-term to long-term
- **Long-Term Memory Limit**: Maximum long-term memories to retain
- **Enable Memory Summaries**: Toggle automatic memory condensation
- **Important Memory**: Store critical information for all conversations

### Proactive Settings
- **Wait Time**: Minimum and maximum time before proactive messages
- **Active Hours**: Set time range when proactive messages are allowed

## Owner Commands
Specify your Discord user ID in settings to use these commands:

- `!pushtoltm`: Manually push medium-term to long-term memory
- `!pushtomtm`: Manually push short-term to medium-term memory
- `!convoend`: Process all memory tiers (useful at end of conversation)
- `!addpersonality`: Add new personality traits to the AI

## User Commands
These can be used in any message:

- `!end session`: End the current AI conversation session
- `/search [query]`: Search the web using Perplexity (if configured)
- `/addmemory [info];`: Add important information to memory

## Memory Browser
Access the Memory Browser from plugin settings to:
- View all stored memory entries
- Delete individual memory items
- Review conversation summaries

## Privacy & Data Storage
- All memory and settings are stored locally
- Data is processed through OpenAI's LLMs in accordance with their Privacy Policy
- Optional integration with Perplexity for search functionality
- Dedicated memory file: `autopilot_memories_[UserID].json`
- Per-user or global configuration options
- Optional AI watermarking for transparency

## Technical Notes
- Memory retrievals use embedding-based semantic search
- Auto-splitting of large memory chunks for better summarization
- Channel-specific or cross-channel memory instancing
- Deduplication of similar messages
- Customizable webhooks and intrigue-checking

## Disclaimer
This plugin is for personal use only. Be aware that using automated responses in Discord may violate Discord's Terms of Service in some contexts. Use responsibly.

## Credits
- Developed by iancdev
- Uses OpenAI's API for language model capabilities
- Compatible with BetterDiscord
