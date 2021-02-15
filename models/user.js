const mongoose = require("mongoose");

const { Schema } = mongoose;
const UserSchema = new Schema({
  username: String,
  balance: Number,
  friends: Array,
  transactions: Array,
});

const User = mongoose.model("User", UserSchema);

module.exports = User;
