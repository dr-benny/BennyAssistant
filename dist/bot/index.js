"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const discord_js_1 = require("discord.js");
const dotenv = require("dotenv");
dotenv.config();
const client = new discord_js_1.Client({ intents: [discord_js_1.GatewayIntentBits.Guilds] });
client.once("ready", () => {
    console.log(`logged in as ${client.user?.tag}`);
});
client.login(process.env.DISCORD_TOKEN);
//# sourceMappingURL=index.js.map