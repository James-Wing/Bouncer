const { Schema, model } = require("mongoose");

module.exports = model(
    "Verification",
    new Schema({
        Guild: String,
        MessageID: String,
        Reaction: String,
        Role: String,
        Interval: Number,
        Message: String,
        ChannelID: String,
    })
);