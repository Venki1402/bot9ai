const express = require("express");
const path = require("path");
require("dotenv").config();
const OpenAI = require("openai");
const { Message } = require("./database");
const { getRooms, bookRoom } = require("./hotelFunctions");

const app = express();
const PORT = process.env.PORT || 9000;

app.use(express.json());
app.use(express.static("public"));

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

app.get("/test", (req, res) => {
  res.send("Server is working");
});

app.post("/chat", async (req, res) => {
  try {
    const { message, sessionId } = req.body;

    // Save user message to database
    await Message.create({ content: message, sender: "user", sessionId });

    // Retrieve conversation history
    const history = await Message.findAll({
      where: { sessionId },
      order: [["createdAt", "ASC"]],
      limit: 10,
    });

    // Format history for OpenAI API
    const messages = history.map((msg) => ({
      role: msg.sender === "user" ? "user" : "assistant",
      content: msg.content,
    }));

    // Add the new user message
    messages.push({ role: "user", content: message });

    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: messages,
      functions: [
        {
          name: "get_rooms",
          description: "Get available hotel rooms",
          parameters: { type: "object", properties: {} },
        },
        {
          name: "book_room",
          description: "Book a hotel room",
          parameters: {
            type: "object",
            properties: {
              roomId: { type: "integer" },
              fullName: { type: "string" },
              email: { type: "string" },
              nights: { type: "integer" },
            },
            required: ["roomId", "fullName", "email", "nights"],
          },
        },
      ],
      function_call: "auto",
    });

    let botReply = response.choices[0].message.content;

    if (response.choices[0].message.function_call) {
      const functionName = response.choices[0].message.function_call.name;
      const functionArgs = JSON.parse(
        response.choices[0].message.function_call.arguments
      );

      let functionResult;
      if (functionName === "get_rooms") {
        functionResult = await getRooms();
      } else if (functionName === "book_room") {
        functionResult = await bookRoom(
          functionArgs.roomId,
          functionArgs.fullName,
          functionArgs.email,
          functionArgs.nights
        );
      }

      const secondResponse = await openai.chat.completions.create({
        model: "gpt-3.5-turbo-0613",
        messages: [
          ...messages,
          response.choices[0].message,
          {
            role: "function",
            name: functionName,
            content: JSON.stringify(functionResult),
          },
        ],
      });

      botReply = secondResponse.choices[0].message.content;
    }

    // Save bot message to database
    await Message.create({ content: botReply, sender: "bot", sessionId });

    res.json({ reply: botReply });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "An error occurred" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on port http://localhost:${PORT}`);
});
