const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { Sequelize, DataTypes } = require("sequelize");
const axios = require("axios");
const { OpenAI } = require("openai");

// Load environment variables
const dotenv = require("dotenv");
dotenv.config();

// openai configuration
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Set up SQLite database
const sequelize = new Sequelize({
  dialect: "sqlite",
  storage: "./chat_history.sqlite",
});

// Define the ChatMessage model
const Conversation = sequelize.define("Conversation", {
  userId: DataTypes.STRING,
  message: DataTypes.TEXT,
  response: DataTypes.TEXT,
});

// Sync the model with the database
sequelize.sync();

// Function to get room options
async function getRoomOptions() {
  try {
    const response = await axios.get("https://bot9assignement.deno.dev/rooms");
    return response.data;
  } catch (error) {
    console.error("Error fetching room options:", error);
    return [];
  }
}

// Function to book a room
async function bookRoom(roomId, fullName, email, nights) {
  try {
    const response = await axios.post("https://bot9assignement.deno.dev/book", {
      roomId,
      fullName,
      email,
      nights,
    });
    return response.data;
  } catch (error) {
    console.error("Error booking room:", error);
    return null;
  }
}

const app = express();
app.use(cors());
app.use(bodyParser.json());

app.get("/test", (req, res) => {
  res.send("Its Working...!");
});

app.get("/openai", async (req, res) => {
  const response = await openai.chat.completions.create({
    model: "gpt-3.5-turbo",
    messages: [{ role: "user", content: "Do you know about kalki?" }],
    max_tokens: 100,
  });
  console.log(response.choices[0].message.content);
});

// /chat endpoint to handle chat messages
app.post("/chat", async (req, res) => {
  const { message, userId } = req.body;

  try {
    const conversation = await Conversation.findAll({
      where: { userId },
      order: [["createdAt", "DESC"]],
      limit: 5,
    });

    const chatHistory = conversation
      .reverse()
      .map((c) => ({
        role: "user",
        content: c.message,
      }))
      .concat(
        conversation.map((c) => ({
          role: "assistant",
          content: c.response,
        }))
      );

    const functions = [
      {
        name: "get_room_options",
        description: "Get available room options",
        parameters: {
          type: "object",
          properties: {},
        },
      },
      {
        name: "book_room",
        description: "Book a room",
        parameters: {
          type: "object",
          properties: {
            roomId: { type: "number" },
            fullName: { type: "string" },
            email: { type: "string" },
            nights: { type: "number" },
          },
          required: ["roomId", "fullName", "email", "nights"],
        },
      },
    ];

    const completion = await openai.chat.completions.create({
      model: "gpt-3.5-turbo-0613",
      messages: [
        {
          role: "system",
          content: "You are a helpful hotel booking assistant.",
        },
        ...chatHistory,
        { role: "user", content: message },
      ],
      functions,
      function_call: "auto",
    });

    let responseMessage = completion.choices[0].message;

    if (responseMessage.function_call) {
      const functionName = responseMessage.function_call.name;
      const functionArgs = JSON.parse(responseMessage.function_call.arguments);

      let functionResult;
      if (functionName === "get_room_options") {
        functionResult = await getRoomOptions();
      } else if (functionName === "book_room") {
        functionResult = await bookRoom(
          functionArgs.roomId,
          functionArgs.fullName,
          functionArgs.email,
          functionArgs.nights
        );
      }

      const secondCompletion = await openai.chat.completions.create({
        model: "gpt-3.5-turbo-0613",
        messages: [
          {
            role: "system",
            content: "You are a helpful hotel booking assistant.",
          },
          ...chatHistory,
          { role: "user", content: message },
          responseMessage,
          {
            role: "function",
            name: functionName,
            content: JSON.stringify(functionResult),
          },
        ],
      });

      responseMessage = secondCompletion.choices[0].message;
    }

    await Conversation.create({
      userId,
      message,
      response: responseMessage.content,
    });

    res.json({ response: responseMessage.content });
  } catch (error) {
    console.error("Error processing chat:", error);
    res
      .status(500)
      .json({ error: "An error occurred while processing your request." });
  }
});

const port = 8055;
app.listen(port, () => {
  console.log(`Server is running on port http://localhost:${port}`);
});
