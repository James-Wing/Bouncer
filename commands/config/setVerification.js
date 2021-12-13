const ReactionModel = require("../../models/ReactionRole");
const { MessageEmbed } = require('discord.js');

module.exports = {
    name: 'setverification',
    aliases: ['verification', 'set-verification', 'setverify', 'set-verify'],
    cooldown: 10,
    permissions: ['ADMINISTRATOR'],
    botPermissions: ['SEND_MESSAGES', 'MANAGE_MESSAGES', 'KICK_MEMBERS'],
    run: async (message, args, client) => {
        if(!args[0] || args[0] === 'help') {
            return message.channel.send({ content:'```This commands set the verification system for the current message guild. \n\nArg 1 - Reaction\n\nArg 2 - Role ID\n\nArg 3 - Interval (days)\n\nArg 4 - Channel ID\n\nArg 5 - Message to send if a user has failed to react in half the given time```' });
        };

        var trueOrFalse = [];
        if(/(\u00a9|\u00ae|[\u2000-\u3300]|\ud83c[\ud000-\udfff]|\ud83d[\ud000-\udfff]|\ud83e[\ud000-\udfff])/gi.test(args[0]) === false) {
            trueOrFalse.push(false);
        }

        if(trueOrFalse.length > 0) {
            return message.channel.send({ content:'Your reaction is not a valid emoji! (Custom emojis unavailable)' })
        }
        
        if(!args[1]) return message.channel.send({ content: 'You must provide a role ID!' });
        if(!args[2]) return message.channel.send({ content:'You must provide an interval (days)!' })
        if(isNaN(args[2])) return message.channel.send({ content:'The supplied interval must be a number!' });
        if(!args[3] || isNaN(args[3])) return message.channel.send({ content:'You must provide a channel ID for the reaction message to be sent to!' });
        if(!args[4]) return message.channel.send({ content:'You must provide a message to be sent to the new member once their time is half up!' });
        const query = {"Guild": message.guild.id};
        const projection = {};

        return ReactionModel.findOne(query, projection).then(async data => {
            if(data) {
                const msg = await client.channels.cache.get(args[3]).send({
                    embeds: [
                        new MessageEmbed({
                            title: 'Verification Embed',
                            description: `React with ${args[0]} to verify in **${message.guild.name}**!`
                        })
                    ]
                });
                await msg.react(args[0]).catch(e => {return;});
                await message.guild.channels.cache.get(data.ChannelID).messages.fetch(data.MessageID).then(async M => {
                    await M.delete();
                }).catch(async E => {
                    await message.guild.owner.user.send('Bouncer was unable to find and delete the old reaction message, this is not a requirement and will not cause any issues.');
                    await console.log(E);
                })
                const update = {
                    Reaction: args[0],
                    Role: args[1],
                    Interval: args[2],
                    MessageID: msg.id,
                    ChannelID: args[3],
                    Message: args.slice(4).join(" "),
                }
                await ReactionModel.findOneAndUpdate(query, update).catch(err => {
                    console.log(err);
                    message.channel.send('There was an error updating your verification, please try running the command again!');
                });
            } else {
                const msg = await client.channels.cache.get(args[3]).send({
                    embeds: [
                        new MessageEmbed({
                            title: 'Verification Embed',
                            description: `React with ${args[0]} to verify in **${message.guild.name}**!`,
                        })
                    ]
                })
                await msg.react(args[0]).catch(e => {return;});
                const newData = await new ReactionModel(
                    {
                        Reaction: args[0],
                        Role: args[1],
                        Interval: args[2],
                        MessageID: msg.id,
                        ChannelID: args[3],
                        Message: args.slice(4).join(" "),
                        Guild: message.guild.id,
                    }
                )

                await newData.save();
            }
        }).catch(async err => {
            await console.log(err);
            await message.channel.send({ content: 'Bouncer ran into an error, please try again!' });
        })
    }
}