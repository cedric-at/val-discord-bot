require("dotenv").config();

const {
    Client,
    GatewayIntentBits,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle
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
        content.includes("val") ||
        content.includes("valo")
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
            if (!activeQueues.has(channelId)) return;

            try {
                await queueMessage.delete();
            } catch { }

            activeQueues.delete(channelId);

            message.channel.send(
                "⌛ Valorant queue expired after 1 hour."
            );
        }, 60 * 60 * 1000);
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

client.once("clientReady", () => {
    console.log(`Logged in as ${client.user.tag}`);
});

client.login(process.env.TOKEN);