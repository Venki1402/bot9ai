const { Sequelize, DataTypes } = require("sequelize");

const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "./chat_history.sqlite",
});

const Conversation = sequelize.define("Conversation", {
  userId: DataTypes.STRING,
  message: DataTypes.TEXT,
  response: DataTypes.TEXT,
});

sequelize.sync();

module.exports = {
  sequelize,
  Conversation,
};
