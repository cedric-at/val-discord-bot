require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActivityType
} = require("discord.js");

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const activeQueues = new Map();

function createQueueEmbed(host, players) {
    const slots = [];

    for (let i = 0; i < 5; i++) {
        if (players[i]) {
            slots.push(`${i + 1}. <@${players[i]}>`);
        } else {
            slots.push(`${i + 1}. Empty`);
        }
    }

    return new EmbedBuilder()
        .setColor("#7289da")
        .setTitle("🎮 Valorant Queue")
        .setDescription(
            `👑 Host
• <@${host}>

🎯 Party
${slots.join("\n")}

Players: ${players.length}/5`
        );
}

client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    const content = message.content.toLowerCase();

    if (
        content === "!queue" ||
        content === "!val" ||
        content === "!valo"
    ) {

        const channelId = message.channel.id;

        if (activeQueues.has(channelId)) {
            return message.reply(
                "⚠️ There is already an active queue in this channel."
            );
        }

        const players = [message.author.id];

        const embed = createQueueEmbed(
            message.author.id,
            players
        );

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
                .setCustomId("join")
                .setLabel("Join")
                .setStyle(ButtonStyle.Success),

            new ButtonBuilder()
                .setCustomId("leave")
                .setLabel("Leave")
                .setStyle(ButtonStyle.Danger),

            new ButtonBuilder()
                .setCustomId("cancel")
                .setLabel("Cancel")
                .setStyle(ButtonStyle.Secondary)
        );

        const queueMessage = await message.channel.send({
            embeds: [embed],
            components: [row]
        });

        activeQueues.set(channelId, {
            host: message.author.id,
            players: [message.author.id],
            messageId: queueMessage.id
        });

        setTimeout(async () => {
            const queue = activeQueues.get(channelId);

            if (!queue) return;

            activeQueues.delete(channelId);

            if (queue.players.length >= 2) {
                message.channel.send(
                    "🔥 Time to queue."
                );
            } else {
                try {
                    await queueMessage.delete();
                } catch {}

                message.channel.send(
                    "❌ Queue failed. Not enough players joined."
                );
            }
        }, 5 * 60 * 1000);
    }
});

client.on("interactionCreate", async (interaction) => {
    if (!interaction.isButton()) return;

    const channelId = interaction.channel.id;
    const queue = activeQueues.get(channelId);

    if (!queue) {
        return interaction.reply({
            content: "Queue no longer exists.",
            ephemeral: true
        });
    }

    const players = queue.players;

    if (interaction.customId === "join") {

        if (players.includes(interaction.user.id)) {
            return interaction.reply({
                content: "You're already in the queue.",
                ephemeral: true
            });
        }

        if (players.length >= 5) {
            return interaction.reply({
                content: "Party is already full.",
                ephemeral: true
            });
        }

        players.push(interaction.user.id);

        await interaction.update({
            embeds: [createQueueEmbed(queue.host, players)]
        });

        if (players.length === 5) {
            interaction.channel.send(
                "🔥 Party is full! Time to queue."
            );
        }
    }

    if (interaction.customId === "leave") {

        const index = players.indexOf(
            interaction.user.id
        );

        if (index === -1) {
            return interaction.reply({
                content: "You're not in the queue.",
                ephemeral: true
            });
        }

        if (interaction.user.id === queue.host) {

            activeQueues.delete(channelId);

            await interaction.message.delete();

            return interaction.channel.send(
                "❌ Queue cancelled by the host."
            );
        }

        players.splice(index, 1);

        if (players.length === 0) {

            activeQueues.delete(channelId);

            await interaction.message.delete();

            return interaction.channel.send(
                "❌ Queue cancelled because nobody is left in the party."
            );
        }

        await interaction.update({
            embeds: [createQueueEmbed(queue.host, players)]
        });
    }

    if (interaction.customId === "cancel") {

        if (interaction.user.id !== queue.host) {
            return interaction.reply({
                content: "Only the host can cancel the queue.",
                ephemeral: true
            });
        }

        activeQueues.delete(channelId);

        await interaction.message.delete();

        return interaction.channel.send(
            "❌ Queue cancelled by the host."
        );
    }
});


// ---------- DAY DATE AND TIME CHANNELS ----------
const DATE_CHANNEL_ID = "1567048907907670066";
const TIME_CHANNEL_ID = "1567050676528357476";

function updateDateTimeChannels(client) {
    const dateChannel = client.channels.cache.get(DATE_CHANNEL_ID);
    const timeChannel = client.channels.cache.get(TIME_CHANNEL_ID);

    if (!dateChannel || !timeChannel) return;

    const now = new Date();

    const dateText = now.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        timeZone: "Asia/Taipei"
    });

    const timeText = now.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
        timeZone: "Asia/Taipei"
    });

    dateChannel.setName(`📅 ${dateText}`)
        .catch(console.error);

    timeChannel.setName(`🕒 ${timeText} CST`)
        .catch(console.error);
}
// ---------- DAY DATE AND TIME CHANNELS ----------


client.once("clientReady", async () => {
    console.log(`Logged in as ${client.user.tag}`);

    client.user.setActivity("!queue | !val | !valo", {
        type: ActivityType.Listening,
    });

    // Update immediately on startup
    await updateDateTimeChannels(client);

    // Update every 5 minutes
    setInterval(() => {
        updateDateTimeChannels(client);
    }, 5 * 60 * 1000);
});

client.login(process.env.TOKEN);