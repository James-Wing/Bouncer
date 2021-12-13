const fs = require('fs');
const Discord = require('discord.js');
const { Intents } = require('discord.js');
const { prefix, token, Mongo } = require('./config.json');

const myIntents = new Intents();
myIntents.add([Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_BANS, Intents.FLAGS.GUILD_MEMBERS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_INVITES, Intents.FLAGS.DIRECT_MESSAGES])

const client = new Discord.Client({
	intents: myIntents,
});
client.commands = new Discord.Collection();
client.cooldowns = new Discord.Collection();

const commandFolders = fs.readdirSync('./commands');

for (const folder of commandFolders) {
	const commandFiles = fs.readdirSync(`./commands/${folder}`).filter(file => file.endsWith('.js'));
	for (const file of commandFiles) {
		const command = require(`./commands/${folder}/${file}`);
		client.commands.set(command.name, command);
	}
}

const mongoose = require('mongoose');
mongoose.connect(Mongo, {
	useUnifiedTopology: true,
	useNewUrlParser: true,
	useFindAndModify: false,
});

let msg;

client.once('ready', async () => {
	console.log('Ready!');
});

client.on('messageCreate', message => {
	if (!message.content.startsWith(prefix) || message.author.bot) return;

	const args = message.content.slice(prefix.length).trim().split(/ +/);
	const commandName = args.shift().toLowerCase();

	const command = client.commands.get(commandName)
		|| client.commands.find(cmd => cmd.aliases && cmd.aliases.includes(commandName));

	if (!command) return;

	if (command.guildOnly && message.channel.type === 'dm') {
		return message.reply({ content: 'I can\'t execute that command inside DMs!' });
	}

	if (command.permissions) {
		const authorPerms = message.channel.permissionsFor(message.author);
		if (!authorPerms || !authorPerms.has(command.permissions)) {
			return message.reply({ content: 'You can not do this!' });
		}
	}

	if (command.botPermissions) {
		const botPerms = message.channel.permissionsFor(client.user);
		if (!botPerms || !botPerms.has(command.botPermissions)) {
			return message.author.send('I need permissions to do this!').catch(e => console.log(e));
		}
	}

	if (command.args && !args.length) {
		let reply = `You didn't provide any arguments, ${message.author}!`;

		if (command.usage) {
			reply += `\nThe proper usage would be: \`${prefix}${command.name} ${command.usage}\``;
		}

		return message.channel.send(reply);
	}

	const { cooldowns } = client;

	if (!cooldowns.has(command.name)) {
		cooldowns.set(command.name, new Discord.Collection());
	}

	const now = Date.now();
	const timestamps = cooldowns.get(command.name);
	const cooldownAmount = (command.cooldown || 3) * 1000;

	if (timestamps.has(message.author.id)) {
		const expirationTime = timestamps.get(message.author.id) + cooldownAmount;

		if (now < expirationTime) {
			const timeLeft = (expirationTime - now) / 1000;
			return message.reply(`please wait ${timeLeft.toFixed(1)} more second(s) before reusing the \`${command.name}\` command.`);
		}
	}

	timestamps.set(message.author.id, now);
	setTimeout(() => timestamps.delete(message.author.id), cooldownAmount);

	try {
		command.run(message, args, client);
	} catch (error) {
		console.error(error);
		message.reply({ content: 'there was an error trying to execute that command!' });
	}
});
client.on('messageCreate', message => {
	if (message.author.id == '449332956474114048') {
		if (message.content == 'b:test') {
			client.emit('guildMemberAdd', message.member)
		}
	}
});
client.on('guildMemberAdd', async member => {
	const ReactionModel = require('./models/ReactionRole');
	console.log('Event 1: Member Joined (' + member.user.tag + ')');

	const query = { "Guild": member.guild.id }
	const projection = {}
	return ReactionModel.findOne(query, projection).then(async data => {
		console.log(data);
		client.guilds.fetch(data.Guild).then(async Guild => {
			Guild.channels.fetch(data.ChannelID).then(async Channel => {
				if (!data.Reaction.toString()) return client.users.cache.get(member.guild.ownerId).send({ content: 'You have improperly supplied reactions, this error was not caught during the setup command!' });
				Channel.messages.fetch(data.MessageID).then(Message => {
					if (!Guild) return client.users.cache.get(member.guild.ownerId).send({ content: 'Bouncer failed to locate your guild, this will be automatically resolved. If you get this error again, contact ' + client.users.cache.get('449332956474114048').tag + '.' });
					if (!Channel) return client.users.cache.get(Guild.ownerId).send({ content: 'Bouncer failed to locate your specified channel, this issue will be automatically resolved. If you get this error again, please contact ' + client.users.cache.get('449332956474114048').tag + '.' });
					if (!Message) return client.users.cache.get(Guild.ownerId).send({ content: 'Bouncer failed to locate the reaction message. This issue should be automatically resolved. If you get this error again, contact ' + client.users.cache.get('449332956474114048').tag + ' and rerun the set-verification command.' });
					console.log('Event 2: All Data Found.');

					async function intervalCheck(Member) {
						console.log('Event 4: Interval Has Begun')
						let Role = Message.guild.roles.cache.get(data.Role);
						let reactUser = Message.reactions.resolve(data.Reaction.toString()).users.cache.get(Member.user.id);

						if (reactUser || reactUser !== undefined || Member.roles.cache.has(data.Role)) {
							await clearInterval(interval);
							if (Member.roles.cache.has(data.Role)) return console.log('Interval cleared, member has role!');
						} else {
							await Member.user.send({ content: "Bouncer has automatically kicked you from " + Member.guild.name + " for not verifying" }).catch(() => { return; });
							await Member.kick({ reason: 'Bouncer Autokick: User failed to verify!' }).catch(async e => {
								await client.users.cache.get(member.guild.ownerId).send({ content: Member.user.tag + ' failed verification but could not be kicked, Bouncer does not have permission to kick this member.' }).catch(err => { return; });
								await console.log(e);
							});
							await clearInterval(interval);
						}
					}

					async function timeoutCheck(Member) {
						console.log('Event 3: Timeout Has Begun')
						let reactUser = Message.reactions.resolve(data.Reaction.toString()).users.cache.get(Member.user.id);

						if (Message.reactions.resolve(data.Reaction.toString()) === null || Message.reactions.resolve(data.Reaction.toString()) === undefined) {
							await client.users.cache.get(member.guild.ownerId).send({ content: 'For some reason, the reaction information has been returned as null. Please report this error to Little_Winge#0613!' });
							await clearTimeout(timeout);
							return;
						}

						if (reactUser || reactUser !== undefined || Member.roles.cache.has(data.Role)) {
							await clearTimeout(timeout);
							if (Member.roles.cache.has(data.Role)) return console.log('Timeout cleared, member has roles!')
						} else {
							await Member.user.send({ content: data.Message }).catch(async e => {
								await client.users.cache.get(member.guild.ownerId).send({ content: 'Failed to warn ' + Member.user.tag + ' about verification, their time is half up! They likely have DMs off, this is not an error.' }).catch(err => { return; })
								return;
							});
						}
					}

					let intervalTime = data.Interval * 24 * 60 * 60 * 1000;
					let timeoutTime = intervalTime / 2;

					let interval = setInterval(intervalCheck, intervalTime, member);
					let timeout = setTimeout(timeoutCheck, timeoutTime, member);
				}).catch(async err => {
					await console.log(err);
					await client.users.fetch(Guild.ownerId).then(u => {return u.send('Unable to fetch the message, please redo the command and mnaually verify all members.').catch(e => {return;})})
				})
			}).catch(async err => {
				await console.log(err);
				await client.users.fetch(Guild.ownerId).then(u => {return u.send('Unable to fetch the channel, please redo the verification command and manually verify all members.').catch(e => {return;})});
				return;
			})
		}).catch(async err => {
			await console.log(err);
			return;
		});
	}).catch(async err => {
		await console.log(err);
		return;
	})
});
client.on('messageReactionAdd', async (reaction, user) => {
	console.log('Reaction Detected')
	//console.log(reaction);
	const ReactionModel = require('./models/ReactionRole');

	let Member = reaction.message.guild.members.cache.get(user.id);

	const query = { "Guild": reaction.message.guildId/*, "MessageID": reaction.message.id*/ };
	const projection = {};

	return ReactionModel.findOne(query, projection).then(async data => {
		if (!data) return console.log('no data');
		const Role = reaction.message.guild.roles.cache.get(data.Role);
		console.log(Role);
		console.log(data);
		if (!Member.roles.cache.has(Role.id)) {
			Member.roles.add(Role.id);
			console.log('Role added')
		} else {
			return;
		}
	}).catch(async err => {
		await console.log(err);
		return;
	});
});
client.on('messageReactionRemove', async (reaction, user) => {
	const ReactionModel = require('./models/ReactionRole');

	let Member = reaction.message.guild.members.cache.get(user.id);

	const query = { "Guild": reaction.message.guild.id, "MessageID": reaction.message.id };
	const projection = {};

	return ReactionModel.findOne(query, projection).then(async data => {
		if (!data) return;
		const Role = reaction.message.guild.roles.cache.get(data.Role);
		if (Member.roles.cache.has(Role)) {
			Member.roles.remove(Role);
		} else {
			return;
		}
	}).catch(async err => {
		await console.log(err);
		return;
	});
});

client.login(token);