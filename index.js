const { Client, GatewayIntentBits, Collection, REST, Routes } = require('discord.js');
const express = require('express');

// Configuração do bot
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent
    ]
});

const PREFIX = 'w!';

// === SLASH COMMANDS ===
const commands = [
    { name: 'ping', description: 'Verifica se o WebHyperTD2 está online' }
];

async function registerCommands() {
    const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);
    try {
        console.log('Registrando slash commands...');
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('Slash commands registrados com sucesso!');
    } catch (error) {
        console.error('Erro ao registrar comandos:', error);
    }
}

client.once('ready', async () => {
    console.log(`Online como ${client.user.tag}`);
    await registerCommands();
});

client.on('interactionCreate', async (interaction) => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === 'ping') {
        await interaction.reply('WebHyperTD2 online!');
    }
});

// === EMBED PADRÃO PARA PUNIÇÕES ===
const punishmentEmbed = (userTag, avatarURL, reason, type, color, duration = null, moderator = null) => {
    const fields = [
        { name: 'Razão', value: reason || 'Sem razão informada', inline: false }
    ];
    if (duration) fields.unshift({ name: 'Duração', value: duration, inline: true });
    if (moderator) fields.unshift({ name: 'Moderador', value: moderator, inline: true });

    return {
        color: color,
        author: {
            name: userTag,
            icon_url: avatarURL
        },
        thumbnail: { url: avatarURL },
        fields: fields,
        title: type,
        timestamp: new Date(),
        footer: { text: 'Moderação do WebHyperTD2' }
    };
};

// === EMBED PARA ROLE ===
const roleEmbed = (userTag, avatarURL, roleName, type, color, moderator, joinedDays) => {
    return {
        color: color,
        author: {
            name: userTag,
            icon_url: avatarURL
        },
        thumbnail: { url: avatarURL },
        fields: [
            { name: 'Cargo', value: roleName, inline: true },
            { name: 'Ação', value: type, inline: true },
            { name: 'Moderador', value: moderator, inline: true },
            { name: 'Dias no Servidor', value: `${joinedDays} dias`, inline: true },
            { name: 'Mensagens', value: 'Não disponível', inline: true }
        ],
        title: 'Atualização de Cargo',
        timestamp: new Date(),
        footer: { text: 'Moderação do WebHyperTD2' }
    };
};

// === TODOS OS COMANDOS ===
client.on('messageCreate', async (message) => {
    if (message.author.bot) return;

    const contentLower = message.content.toLowerCase().trim();
    const args = contentLower.split(/ +/);
    const firstWord = args[0];

    // Comando CLEAR sem prefixo (cl, clear, limpar) — apaga só mensagens do usuário
    if (firstWord === 'cl' || firstWord === 'clear' || firstWord === 'limpar') {
        if (!message.member.permissions.has('ManageMessages')) return; // silencioso se sem permissão

        const amount = 20; // alterado para 20 mensagens do usuário

        try {
            // Busca mensagens recentes no canal
            const fetched = await message.channel.messages.fetch({ limit: 100 });

            // Filtra APENAS mensagens do usuário que executou o comando
            const userMessages = fetched.filter(m => m.author.id === message.author.id).first(amount);

            if (userMessages.size === 0) {
                return; // silencioso — não avisa nada se não encontrar
            }

            // Apaga as mensagens do usuário
            await message.channel.bulkDelete(userMessages, true);

            // Apaga a mensagem do comando também (se possível)
            if (message.deletable) await message.delete().catch(() => {});
        } catch (error) {
            // silencioso em erro também
            console.error('Erro no clear:', error);
        }
        return;
    }

    // Todos os outros comandos exigem o prefixo w!
    if (!contentLower.startsWith(PREFIX)) return;

    const argsWithPrefix = message.content.slice(PREFIX.length).trim().split(/ +/);
    const commandName = argsWithPrefix.shift().toLowerCase();

    // w!ping
    if (commandName === 'ping') {
        await message.reply('WebHyperTD2 online!');
    }

    // w!av [@user] — avatar curto
    if (commandName === 'av') {
        const member = message.mentions.members.first() || message.member;
        const avatarURL = member.user.displayAvatarURL({ size: 1024, dynamic: true });
        const embed = {
            color: 0x9b59b6,
            title: `Avatar de ${member.user.tag}`,
            image: { url: avatarURL },
            footer: { text: 'Clique para ampliar' }
        };
        message.channel.send({ embeds: [embed] });
    }

    // w!killslow ou w!killslowmode — remove slowmode
    if (commandName === 'killslow' || commandName === 'killslowmode') {
        if (!message.member.permissions.has('ManageChannels')) return message.reply('Você não tem permissão para gerenciar canais.');
        await message.channel.setRateLimitPerUser(0);
        message.reply('Slowmode removido deste canal.');
    }

    // w!ban @user [razão]
    if (commandName === 'ban') {
        if (!message.member.permissions.has('BanMembers')) return message.reply('Você não tem permissão para banir.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('Mencione um usuário válido.');
        if (!member.bannable) return message.reply('Não consigo banir esse usuário.');
        const reason = argsWithPrefix.slice(1).join(' ') || 'Sem razão informada';

        try {
            const fetched = await message.channel.messages.fetch({ limit: 100 });
            const userMsgs = fetched.filter(m => m.author.id === member.id).first(4);
            if (userMsgs.length > 0) await message.channel.bulkDelete(userMsgs, true);

            await member.ban({ reason });
            const embed = punishmentEmbed(member.user.tag, member.user.displayAvatarURL({ size: 512, dynamic: true }), reason, 'Usuário Banido Permanentemente', 0xFF0000, null, message.author.tag);
            await message.channel.send({ embeds: [embed] });
        } catch {
            message.reply('Erro ao banir.');
        }
    }

    // w!kick @user [razão]
    if (commandName === 'kick') {
        if (!message.member.permissions.has('KickMembers')) return message.reply('Você não tem permissão para expulsar.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('Mencione um usuário válido.');
        if (!member.kickable) return message.reply('Não consigo expulsar esse usuário.');
        const reason = argsWithPrefix.slice(1).join(' ') || 'Sem razão informada';

        try {
            await member.kick(reason);
            const embed = punishmentEmbed(member.user.tag, member.user.displayAvatarURL({ size: 512, dynamic: true }), reason, 'Usuário Expulso do Servidor', 0xFFA500, null, message.author.tag);
            await message.channel.send({ embeds: [embed] });
        } catch {
            message.reply('Erro ao expulsar.');
        }
    }

    // w!mute @user <tempo> [razão]
    if (commandName === 'mute' || commandName === 'timeout') {
        if (!message.member.permissions.has('ModerateMembers')) return message.reply('Você não tem permissão para mutar.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('Mencione um usuário válido.');
        if (!member.moderatable) return message.reply('Não consigo mutar esse usuário.');
        const time = argsWithPrefix[1];
        if (!time) return message.reply('Informe o tempo (ex: 10m).');
        const reason = argsWithPrefix.slice(2).join(' ') || 'Sem razão informada';

        let durationMs;
        if (time.endsWith('s')) durationMs = parseInt(time) * 1000;
        else if (time.endsWith('m')) durationMs = parseInt(time) * 60000;
        else if (time.endsWith('h')) durationMs = parseInt(time) * 3600000;
        else if (time.endsWith('d')) durationMs = parseInt(time) * 86400000;
        else return message.reply('Tempo inválido (s/m/h/d).');

        if (durationMs > 2419200000) return message.reply('Máximo 28 dias.');

        try {
            const fetched = await message.channel.messages.fetch({ limit: 100 });
            const userMsgs = fetched.filter(m => m.author.id === member.id).first(4);
            if (userMsgs.length > 0) await message.channel.bulkDelete(userMsgs, true);

            await member.timeout(durationMs, reason);
            const embed = punishmentEmbed(member.user.tag, member.user.displayAvatarURL({ size: 512, dynamic: true }), reason, 'Usuário Mutado', 0x3498DB, time, message.author.tag);
            await message.channel.send({ embeds: [embed] });
        } catch {
            message.reply('Erro ao mutar.');
        }
    }

    // w!unmute @user
    if (commandName === 'unmute' || commandName === 'desmutar') {
        if (!message.member.permissions.has('ModerateMembers')) return message.reply('Você não tem permissão para desmutar.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('Mencione um usuário válido.');
        if (!member.communicationDisabledUntil) return message.reply('Usuário não está mutado.');

        try {
            await member.timeout(null);
            const embed = punishmentEmbed(member.user.tag, member.user.displayAvatarURL({ size: 512, dynamic: true }), 'Desmutado', 'Usuário Desmutado', 0x00FF00, null, message.author.tag);
            await message.channel.send({ embeds: [embed] });
        } catch {
            message.reply('Erro ao desmutar.');
        }
    }

    // w!unban <ID> [razão]
    if (commandName === 'unban' || commandName === 'desbanir') {
        if (!message.member.permissions.has('BanMembers')) return message.reply('Você não tem permissão para desbanir.');
        const userId = argsWithPrefix[0];
        if (!userId) return message.reply('Uso: `w!unban <ID>`');

        try {
            const ban = await message.guild.bans.fetch(userId);
            const reason = argsWithPrefix.slice(1).join(' ') || 'Sem razão informada';
            await message.guild.bans.remove(userId, reason);

            const embed = {
                color: 0x00FF00,
                title: 'Usuário Desbanido',
                fields: [
                    { name: 'Usuário', value: `\( {ban.user.tag} ( \){userId})`, inline: true },
                    { name: 'Moderador', value: `${message.author.tag}`, inline: true },
                    { name: 'Razão do desban', value: reason, inline: false }
                ],
                timestamp: new Date(),
                footer: { text: 'Moderação do WebHyperTD2' }
            };
            await message.channel.send({ embeds: [embed] });
        } catch {
            message.reply('Usuário não banido ou erro ao desbanir.');
        }
    }

    // w!slowmode
    if (commandName === 'slowmode') {
        if (!message.member.permissions.has('ManageChannels')) return message.reply('Você não tem permissão para gerenciar canais.');
        if (!argsWithPrefix[0]) return message.reply('Uso: `w!slowmode <segundos>` ou `w!slowmode off`');
        if (argsWithPrefix[0].toLowerCase() === 'off') {
            await message.channel.setRateLimitPerUser(0);
            return message.reply('Slowmode desativado neste canal.');
        }
        const seconds = parseInt(argsWithPrefix[0]);
        if (isNaN(seconds) || seconds < 0 || seconds > 21600) return message.reply('Tempo inválido (0 a 21600 segundos).');
        await message.channel.setRateLimitPerUser(seconds);
        message.reply(`Slowmode ativado: 1 mensagem a cada ${seconds} segundos.`);
    }

    // w!lock
    if (commandName === 'lock') {
        if (!message.member.permissions.has('ManageChannels')) return message.reply('Você não tem permissão para gerenciar canais.');
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: false });
        message.reply('Canal travado.');
    }

    // w!unlock
    if (commandName === 'unlock') {
        if (!message.member.permissions.has('ManageChannels')) return message.reply('Você não tem permissão para gerenciar canais.');
        await message.channel.permissionOverwrites.edit(message.guild.roles.everyone, { SendMessages: null });
        message.reply('Canal destravado.');
    }

    // w!warn @user [razão]
    if (commandName === 'warn') {
        if (!message.member.permissions.has('ModerateMembers')) return message.reply('Você não tem permissão para avisar.');
        const member = message.mentions.members.first();
        if (!member) return message.reply('Mencione um usuário válido.');
        const reason = argsWithPrefix.slice(1).join(' ') || 'Sem razão informada';
        const warnEmbed = {
            color: 0xFFAA00,
            title: 'Aviso Recebido',
            description: `**Servidor:** ${message.guild.name}\n**Razão:** ${reason}\n**Moderador:** ${message.author.tag}`,
            timestamp: new Date(),
            footer: { text: 'Moderação do WebHyperTD2' }
        };
        try {
            await member.send({ embeds: [warnEmbed] });
            message.reply(`${member.user.tag} foi avisado no privado.`);
        } catch {
            message.reply(`${member.user.tag} foi avisado (privado fechado).`);
        }
    }

    // w!av [@user] — avatar curto
    if (commandName === 'av') {
        const member = message.mentions.members.first() || message.member;
        const avatarURL = member.user.displayAvatarURL({ size: 1024, dynamic: true });
        const embed = {
            color: 0x9b59b6,
            title: `Avatar de ${member.user.tag}`,
            image: { url: avatarURL },
            footer: { text: 'Clique para ampliar' }
        };
        message.channel.send({ embeds: [embed] });
    }

    // w!serverinfo ou w!info
    if (commandName === 'serverinfo' || commandName === 'info') {
        const guild = message.guild;
        const embed = {
            color: 0x3498DB,
            title: `Informações do Servidor: ${guild.name}`,
            thumbnail: { url: guild.iconURL({ dynamic: true }) || null },
            fields: [
                { name: 'Dono', value: `<@${guild.ownerId}>`, inline: true },
                { name: 'Criado em', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:D>`, inline: true },
                { name: 'Membros', value: `${guild.memberCount}`, inline: true },
                { name: 'Canais', value: `${guild.channels.cache.size}`, inline: true },
                { name: 'Boosts', value: `${guild.premiumSubscriptionCount || 0} (Nível ${guild.premiumTier})`, inline: true },
                { name: 'ID', value: `${guild.id}`, inline: false }
            ],
            timestamp: new Date(),
            footer: { text: 'Moderação do WebHyperTD2' }
        };
        message.channel.send({ embeds: [embed] });
    }

    // w!role @cargo @user — com embed bonito
    if (commandName === 'role') {
        if (!message.member.permissions.has('ManageRoles')) return message.reply('Você não tem permissão para gerenciar cargos.');
        const role = message.mentions.roles.first();
        const member = message.mentions.members.first();
        if (!role || !member) return message.reply('Uso: `w!role @cargo @user`');
        if (role.position >= message.guild.members.me.roles.highest.position) return message.reply('Cargo maior que o meu.');

        const joinedDays = Math.floor((Date.now() - member.joinedTimestamp) / (1000 * 60 * 60 * 24));

        const type = member.roles.cache.has(role.id) ? 'Removida' : 'Adicionada';
        const color = member.roles.cache.has(role.id) ? 0xFF0000 : 0x00FF00;

        if (member.roles.cache.has(role.id)) {
            await member.roles.remove(role);
        } else {
            await member.roles.add(role);
        }

        const embed = roleEmbed(member.user.tag, member.user.displayAvatarURL({ size: 512, dynamic: true }), role.name, type, color, message.author.tag, joinedDays);
        await message.channel.send({ embeds: [embed] });
    }

    // w!nuke
    if (commandName === 'nuke') {
        if (!message.member.permissions.has('ManageChannels')) return message.reply('Você não tem permissão.');
        const channel = message.channel;
        const position = channel.position;
        const parent = channel.parent;
        try {
            const newChannel = await channel.clone();
            await channel.delete();
            await newChannel.setPosition(position);
            if (parent) await newChannel.setParent(parent);
            newChannel.send('canal moggado');
        } catch {
            message.reply('vc n é digno de usar nuke, plebe imundo');
        }
    }

    // w!doxxar — gera dados dox randomizados em PT-BR
    if (commandName === 'doxxar') {
        // 50% de chance de ser Guilherme Trem Bala Del Rego
        const isGuilherme = Math.random() < 0.5;

        let nome = isGuilherme 
            ? "Guilherme Trem Bala Del Rego" 
            : [
                "João Pedro Silva Santos", "Maria Eduarda Oliveira Lima", "Lucas Gabriel Costa Ferreira",
                "Ana Clara Rodrigues Almeida", "Pedro Henrique Souza Carvalho", "Sophia Beatriz Mendes Rocha",
                "Miguel Arthur Pereira Cardoso", "Laura Valentina Gomes Barbosa", "Enzo Gabriel Martins Ribeiro",
                "Isabella Sophia Castro Nogueira"
              ][Math.floor(Math.random() * 10)];

        const cpf = `\( {Math.floor(100 + Math.random() * 900)}. \){Math.floor(100 + Math.random() * 900)}.\( {Math.floor(100 + Math.random() * 900)}- \){Math.floor(10 + Math.random() * 90)}`;
        const rg = `\( {Math.floor(10 + Math.random() * 90)}. \){Math.floor(100 + Math.random() * 900)}.\( {Math.floor(100 + Math.random() * 900)}- \){Math.floor(1 + Math.random() * 9)} SSP/CE`;
        
        const dia = Math.floor(1 + Math.random() * 28);
        const mes = Math.floor(1 + Math.random() * 12);
        const ano = Math.floor(1995 + Math.random() * 15);
        const dataNasc = `\( {dia.toString().padStart(2, '0')}/ \){mes.toString().padStart(2, '0')}/${ano}`;
        const idade = 2026 - ano;

        const nomesMae = ["Maria", "Francisca", "Ana", "Josefa", "Antonia", "Joana", "Rita", "Lúcia"];
        const sobrenomesMae = ["Silva", "Santos", "Oliveira", "Souza", "Rodrigues", "Ferreira", "Almeida"];
        const mae = `${nomesMae[Math.floor(Math.random() * nomesMae.length)]} ${sobrenomesMae[Math.floor(Math.random() * sobrenomesMae.length)]} ${sobrenomesMae[Math.floor(Math.random() * sobrenomesMae.length)]}`;

        const pai = isGuilherme ? "José Victoriano Marques (falecido)" : "Não informado ou falecido";

        const ruas = ["Rua das Flores", "Avenida Central", "Travessa do Sol", "Rua do Progresso", "Avenida Brasil", "Rua das Acácias", "Travessa São João", "Rua da Paz"];
        const bairros = ["Parque Jenipapo", "Centro", "Jardim América", "Vila União", "Bom Jardim", "Genipapo", "Planalto Ayrton Senna", "Jurema"];
        const rua = ruas[Math.floor(Math.random() * ruas.length)];
        const numero = Math.floor(100 + Math.random() * 900);
        const bairro = bairros[Math.floor(Math.random() * bairros.length)];
        const cidade = "Maranguape";
        const cep = `619\( {Math.floor(40 + Math.random() * 60)}- \){Math.floor(100 + Math.random() * 900)}`;

        const telefones = [
            `+55 (85) 9\( {Math.floor(9000 + Math.random() * 9999)}- \){Math.floor(1000 + Math.random() * 9999)}`,
            `+55 (85) 9\( {Math.floor(8000 + Math.random() * 9999)}- \){Math.floor(2000 + Math.random() * 9999)}`,
            `+55 (85) 9\( {Math.floor(7000 + Math.random() * 9999)}- \){Math.floor(3000 + Math.random() * 9999)}`
        ];

        const ips = ["177.128.94.", "191.252.198.", "187.45.193.", "45.224.128.", "170.79.128."];
        const ip = ips[Math.floor(Math.random() * ips.length)] + Math.floor(10 + Math.random() * 245);

        const provedores = ["Claro NET Virtua Fibra", "Vivo Fibra", "TIM Live", "Oi Fibra", "Brisanet"];
        const provedor = provedores[Math.floor(Math.random() * provedores.length)];

        const redes = [
            `@${nome.toLowerCase().replace(/\s/g, '')} (X/Twitter - ativo)`,
            `lelelevi ou ${nome.split(' ')[0].toLowerCase()} (provável em vários apps)`,
            `Discord: \( {nome.split(' ')[0].toLowerCase()}# \){Math.floor(1000 + Math.random() * 9000)}`,
            `Steam: ${nome.split(' ')[0]}XD (level ${Math.floor(5 + Math.random() * 50)})`
        ];

        const score = Math.floor(300 + Math.random() * 700);
        const dividas = Math.floor(1000 + Math.random() * 14000);
        const credores = ["Banco Inter", "Nubank", "Magazine Luiza", "C6 Bank", "Santander", "Bradesco"];

        const mensagem = `
╔════════════════════════════════════╗
║ 🔍 CONSULTA COMPLETA 🔍 ║
║ Sistema Anti-Block 2025 v3.7 ║
╚════════════════════════════════════╝

👤 NOME: ${nome}
CPF: ${cpf}
RG: ${rg}
DATA DE NASCIMENTO: ${dataNasc}
IDADE: ${idade} anos
GÊNERO: Masculino
MÃE: ${mae}
PAI: ${pai}

📍 ENDEREÇO ATUAL (Estimado)
${rua}, ${numero}
Bairro: ${bairro}
Cidade: ${cidade} - CE
CEP: ${cep}

📱 TELEFONES VINCULADOS
• Principal: ${telefones[0]} (Claro)
• Secundário: ${telefones[1]} (Vivo)
• Recente: ${telefones[2]} (TIM - 2024)

🌐 IP ATUAL / ÚLTIMA CONEXÃO
IP: ${ip}
Última conexão: 20/02/2026 15:12 (-03)
Cidade/Estado: Maranguape / Ceará
Provedor: ${provedor}
Coordenadas aproximadas: -3.\( {Math.floor(8000 + Math.random() * 2000)}, -38. \){Math.floor(6000 + Math.random() * 2000)}

📡 REDES SOCIAIS / LINKS DETECTADOS
• ${redes[0]}
• ${redes[1]}
• Discord: ${redes[2]}
• Steam: ${redes[3]}

💳 SCORE FINANCEIRO (estimado SPC/Serasa)
Score: ${score}/1000
Status: Negativo (${Math.floor(1 + Math.random() * 4)} protestos em aberto)
Dívidas aproximadas: R$ ${dividas.toLocaleString('pt-BR')},00
Principais credores: ${credores[Math.floor(Math.random() * credores.length)]}, ${credores[Math.floor(Math.random() * credores.length)]}

🛡️ OUTRAS INFORMAÇÕES
• CNH: Categoria B - válida até 08/203${Math.floor(0 + Math.random() * 10)}
• Título de Eleitor: ${Math.floor(100000000000 + Math.random() * 900000000000)}/CE
• Tem ${Math.floor(0 + Math.random() * 5)} processos criminais (2023–2025 - em andamento)
• Tipo sanguíneo provável: ${["O+", "A+", "B+", "AB+", "O-", "A-", "B-", "AB-"][Math.floor(Math.random() * 8)]}
• Última nota no iFood: \( {Math.floor(5 + Math.random() * 5)}. \){Math.floor(0 + Math.random() * 10)} 🍔

Consulta concluída em 0.${Math.floor(20 + Math.random() * 80)} segundos.
        `;

        message.channel.send("```" + mensagem + "```");
    }
});

// Login
client.login(process.env.TOKEN);

// Express (mantém o bot acordado 24/7 no Render)
const app = express();
app.get('/', (req, res) => res.send('Bot online! WebHyperTD2 está vivo!'));
app.listen(process.env.PORT || 3000, () => console.log(`Servidor web rodando na porta ${process.env.PORT || 3000}`));
